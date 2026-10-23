const Complaint              = require('../models/Complaint');
const ComplaintStatusHistory = require('../models/ComplaintStatusHistory');
const { uploadImage }                          = require('../config/cloudinary');
const { reverseGeocode }                       = require('../utils/geocoding');
const { generateComplaintId }                  = require('../utils/complaintId');
const { findMunicipalCorporation }             = require('../services/municipalService');
const { createStatusNotification }             = require('../services/notificationService');
const { analyzeRoadDamage, checkSemanticDuplicate, validateRoadImage } = require('../services/geminiService');
const { success, error }                       = require('../utils/apiResponse');

const DUPLICATE_RADIUS = parseInt(process.env.DUPLICATE_RADIUS_METERS, 10) || 100;

// ─── Haversine distance helper ────────────────────────────────────────────────
const haversine = (lat1, lon1, lat2, lon2) => {
  const R    = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a    = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
};

// ─── POST /api/complaints/check-duplicate ────────────────────────────────────
const checkDuplicate = async (req, res) => {
  try {
    const { latitude, longitude, damageCategory, description } = req.body;
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon)) {
      return error(res, 'Valid latitude and longitude are required.', 400, 'INVALID_COORDS');
    }

    // Step 1 — GeoJSON spatial proximity check
    const nearby = await Complaint.findOne({
      location: {
        $near: { $geometry: { type:'Point', coordinates:[lon,lat] }, $maxDistance: DUPLICATE_RADIUS },
      },
      damageCategory,
      status: { $in:['REPORTED','RECEIVED','IN_PROGRESS'] },
      isDuplicate: false,
    });

    if (nearby) {
      const distance = haversine(lat, lon, nearby.location.coordinates[1], nearby.location.coordinates[0]);

      // Step 2 — Gemini semantic check (only if descriptions available)
      let aiDuplicateReason = null;
      if (description && nearby.description) {
        const aiCheck = await checkSemanticDuplicate(description, damageCategory, nearby.description, nearby.damageCategory);
        if (!aiCheck.isDuplicate && aiCheck.confidence < 50) {
          // AI says they're different — trust AI over proximity
          return success(res, { isDuplicate:false, aiOverride:true, reason: aiCheck.reason }, 'No duplicate found (AI verified).');
        }
        aiDuplicateReason = aiCheck.reason;
      }

      return success(res, {
        isDuplicate: true,
        complaint: {
          complaintId:    nearby.complaintId,
          damageCategory: nearby.damageCategory,
          status:         nearby.status,
          address:        nearby.address,
          createdAt:      nearby.createdAt,
        },
        distance,
        aiReason: aiDuplicateReason,
      }, 'Duplicate complaint found.');
    }

    return success(res, { isDuplicate:false }, 'No duplicate found.');
  } catch (err) {
    console.error('Check duplicate error:', err);
    return error(res, 'Failed to check for duplicates.', 500);
  }
};

// ─── POST /api/complaints ─────────────────────────────────────────────────────
const createComplaint = async (req, res) => {
  try {
    let { damageCategory, customDamageType, description, latitude, longitude } = req.body;

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return error(res, 'Valid latitude and longitude are required.', 400, 'INVALID_COORDS');
    }

    // ── 1. Read image buffer (validate BEFORE saving) ───────────────────────
    let imageData    = { url:null, publicId:null };
    let imageBuffer  = null;
    let imageMimeType = 'image/jpeg';

    if (req.file) {
      imageBuffer   = req.file.buffer;
      imageMimeType = req.file.mimetype;

      // ── Gemini image validation — reject selfies, food, irrelevant images ──
      const validation = await validateRoadImage(imageBuffer, imageMimeType);
      if (!validation.valid) {
        return error(
          res,
          `Invalid image rejected. ${validation.reason || 'The uploaded image does not appear to show road damage.'} (Detected: "${validation.whatIsShown || 'unknown'}"). Please upload a clear photo of road damage.`,
          400,
          'INVALID_IMAGE_CONTENT'
        );
      }

      // Image passed validation — now save it
      try {
        const uploaded = await uploadImage(imageBuffer, imageMimeType);
        imageData = { url: uploaded.url, publicId: uploaded.publicId };
        console.log(`✅ Image saved: ${uploaded.isLocal ? 'locally' : 'Cloudinary'} → ${uploaded.url}`);
      } catch (uploadErr) {
        console.error('Image upload failed (continuing):', uploadErr.message);
      }
    }

    // ── 2. Gemini AI — detect damage type + full analysis ───────────────────
    let geminiAnalysis = { available:false, message:'No image provided.' };
    if (imageBuffer) {
      try {
        geminiAnalysis = await analyzeRoadDamage(imageBuffer, imageMimeType);
        if (geminiAnalysis.available) {
          console.log(`🤖 Gemini detected: ${geminiAnalysis.detectedCategory} (${geminiAnalysis.confidence} confidence) — severity: ${geminiAnalysis.severity}`);

          // AUTO-SET damage category from AI if citizen selected "OTHER" or didn't specify
          if (!damageCategory || damageCategory === 'OTHER') {
            damageCategory = geminiAnalysis.detectedCategory || 'OTHER';
            console.log(`   Auto-set category to: ${damageCategory}`);
          }
        }
      } catch (aiErr) {
        console.error('Gemini analysis error (non-fatal):', aiErr.message);
      }
    }

    // ── 3. Reverse geocode + duplicate check (parallel) ─────────────────────
    const [address, existingNearby] = await Promise.all([
      reverseGeocode(lat, lon),
      Complaint.find({
        location: {
          $near: { $geometry: { type:'Point', coordinates:[lon,lat] }, $maxDistance: DUPLICATE_RADIUS },
        },
        status: { $in:['REPORTED','RECEIVED','IN_PROGRESS'] },
        isDuplicate: false,
      }).limit(5),
    ]);

    // ── 4. Smart duplicate detection — GEO + AI semantic ────────────────────
    let isDuplicate=false, duplicateOf=null, duplicateDistance=null;

    // Filter nearby by same or similar category
    const sameCatNearby = existingNearby.filter(c => c.damageCategory === damageCategory);
    const candidateNearby = sameCatNearby.length > 0 ? sameCatNearby : existingNearby;

    if (candidateNearby.length > 0) {
      const closest = candidateNearby[0];
      const dist    = haversine(lat, lon, closest.location.coordinates[1], closest.location.coordinates[0]);

      let markAsDuplicate = true; // geo says yes by default

      // Run Gemini semantic check if descriptions available
      if (description && closest.description) {
        try {
          const aiCheck = await checkSemanticDuplicate(description, damageCategory, closest.description, closest.damageCategory);
          if (!aiCheck.isDuplicate) {
            markAsDuplicate = false;
            console.log(`🤖 Gemini AI overrode geo-duplicate: ${aiCheck.reason}`);
          } else {
            console.log(`🤖 Gemini confirmed duplicate: ${aiCheck.reason} (${aiCheck.confidence}% confidence)`);
          }
        } catch {}
      }

      if (markAsDuplicate) {
        isDuplicate       = true;
        duplicateOf       = closest._id;
        duplicateDistance = dist;
      }
    }

    // ── 5. Municipal Corporation assignment ──────────────────────────────────
    const { corporation, assignmentStatus } = await findMunicipalCorporation(lon, lat);

    // ── 6. Generate complaint ID ─────────────────────────────────────────────
    const complaintId = await generateComplaintId();

    // ── 7. Create complaint ──────────────────────────────────────────────────
    const complaint = await Complaint.create({
      complaintId,
      citizenId: req.user._id,
      image: imageData,
      damageCategory,
      customDamageType: damageCategory === 'OTHER' ? customDamageType : undefined,
      description,
      location: { type:'Point', coordinates:[lon, lat] },
      address,
      municipalCorporationId: corporation?._id || null,
      assignmentStatus,
      status: 'REPORTED',
      isDuplicate,
      duplicateOf,
      duplicateDistance,
      aiAnalysis: geminiAnalysis.available ? {
        available:         true,
        detectedCategory:  geminiAnalysis.detectedCategory,
        confidence:        geminiAnalysis.confidence,
        damageLabel:       geminiAnalysis.damageLabel,
        severity:          geminiAnalysis.severity,
        estimatedSize:     geminiAnalysis.estimatedSize,
        safetyRisk:        geminiAnalysis.safetyRisk,
        safetyDetail:      geminiAnalysis.safetyDetail,
        recommendedAction: geminiAnalysis.recommendedAction,
        urgency:           geminiAnalysis.urgency,
        additionalNotes:   geminiAnalysis.additionalNotes,
        analyzedAt:        geminiAnalysis.analyzedAt,
      } : { available:false, message: geminiAnalysis.message },
    });

    // ── 8. Status history ────────────────────────────────────────────────────
    await ComplaintStatusHistory.create({
      complaintId: complaint._id,
      previousStatus: null,
      newStatus: 'REPORTED',
      changedBy: req.user._id,
      comment: 'Complaint submitted by citizen.',
    });

    // ── 9. Notification ──────────────────────────────────────────────────────
    await createStatusNotification(req.user._id, complaintId, complaint._id, 'REPORTED');

    const populated = await Complaint.findById(complaint._id)
      .populate('municipalCorporationId', 'name code city')
      .populate('citizenId', 'name email');

    // Build a helpful response message
    let message = `Complaint ${complaintId} submitted successfully.`;
    if (geminiAnalysis.available) {
      message += ` AI detected: ${geminiAnalysis.damageLabel} (${geminiAnalysis.severity} severity).`;
    }
    if (isDuplicate) {
      message += ` Flagged as duplicate (${duplicateDistance}m from existing report).`;
    }

    return success(res, { complaint:populated, aiAnalysis: geminiAnalysis }, message, 201);

  } catch (err) {
    console.error('Create complaint error:', err);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return error(res, messages.join('. '), 400, 'VALIDATION_ERROR');
    }
    return error(res, 'Failed to submit complaint. Please try again.', 500);
  }
};

// ─── GET /api/complaints/my ───────────────────────────────────────────────────
const getMyComplaints = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 10);
    const skip  = (page - 1) * limit;
    const filter = { citizenId: req.user._id };
    if (req.query.status)         filter.status         = req.query.status;
    if (req.query.damageCategory) filter.damageCategory = req.query.damageCategory;

    const [complaints, total] = await Promise.all([
      Complaint.find(filter).sort({ createdAt:-1 }).skip(skip).limit(limit)
        .populate('municipalCorporationId', 'name code city'),
      Complaint.countDocuments(filter),
    ]);
    return success(res, { complaints, pagination:{ page, limit, total, pages:Math.ceil(total/limit) } }, 'Complaints retrieved.');
  } catch (err) {
    console.error('Get my complaints error:', err);
    return error(res, 'Failed to retrieve complaints.', 500);
  }
};

// ─── GET /api/complaints/:id ──────────────────────────────────────────────────
const getComplaintById = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('municipalCorporationId', 'name code city state')
      .populate('citizenId', 'name email')
      .populate('duplicateOf', 'complaintId status');
    if (!complaint) return error(res, 'Complaint not found.', 404, 'NOT_FOUND');
    if (req.user.role === 'citizen' && complaint.citizenId._id.toString() !== req.user._id.toString()) {
      return error(res, 'Access denied.', 403, 'FORBIDDEN');
    }
    return success(res, { complaint }, 'Complaint retrieved.');
  } catch (err) {
    return error(res, 'Failed to retrieve complaint.', 500);
  }
};

// ─── GET /api/complaints/:id/status-history ───────────────────────────────────
const getStatusHistory = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id).select('citizenId complaintId');
    if (!complaint) return error(res, 'Complaint not found.', 404, 'NOT_FOUND');
    if (req.user.role === 'citizen' && complaint.citizenId.toString() !== req.user._id.toString()) {
      return error(res, 'Access denied.', 403, 'FORBIDDEN');
    }
    const history = await ComplaintStatusHistory.find({ complaintId: req.params.id })
      .sort({ createdAt:1 }).populate('changedBy', 'name role');
    return success(res, { history }, 'Status history retrieved.');
  } catch (err) {
    return error(res, 'Failed to retrieve status history.', 500);
  }
};

// ─── GET /api/complaints/nearby ───────────────────────────────────────────────
const getNearbyComplaints = async (req, res) => {
  try {
    const { latitude, longitude, radius = 1000 } = req.query;
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const rad = Math.min(50000, parseInt(radius, 10) || 1000);
    if (isNaN(lat) || isNaN(lon)) {
      return error(res, 'Valid latitude and longitude are required.', 400, 'INVALID_COORDS');
    }
    const complaints = await Complaint.find({
      location: { $near: { $geometry: { type:'Point', coordinates:[lon,lat] }, $maxDistance:rad } },
      isDuplicate: false,
    }).limit(50).select('complaintId damageCategory status location address createdAt image aiAnalysis');
    return success(res, { complaints, count:complaints.length }, 'Nearby complaints retrieved.');
  } catch (err) {
    return error(res, 'Failed to retrieve nearby complaints.', 500);
  }
};

// ─── GET /api/complaints/map ──────────────────────────────────────────────────
const getMapComplaints = async (req, res) => {
  try {
    const filter = { isDuplicate:false };
    if (req.query.status)         filter.status         = req.query.status;
    if (req.query.damageCategory) filter.damageCategory = req.query.damageCategory;
    const complaints = await Complaint.find(filter).limit(500)
      .select('complaintId damageCategory status location address createdAt image');
    return success(res, { complaints }, 'Map data retrieved.');
  } catch (err) {
    return error(res, 'Failed to retrieve map data.', 500);
  }
};

module.exports = {
  checkDuplicate, createComplaint, getMyComplaints,
  getComplaintById, getStatusHistory, getNearbyComplaints, getMapComplaints,
};
