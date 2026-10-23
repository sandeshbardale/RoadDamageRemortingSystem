const { prisma } = require('../config/prisma');
const { uploadImage } = require('../config/cloudinary');
const { reverseGeocode } = require('../utils/geocoding');
const { generateComplaintId } = require('../utils/complaintId');
const { findMunicipalCorporation } = require('../services/municipalService');
const { createStatusNotification } = require('../services/notificationService');
const { analyzeRoadDamage, checkSemanticDuplicate, validateRoadImage } = require('../services/geminiService');
const { success, error } = require('../utils/apiResponse');

const DUPLICATE_RADIUS = parseInt(process.env.DUPLICATE_RADIUS_METERS, 10) || 100;

// ─── Haversine distance helper (meters) ──────────────────────────────────────
const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

// ─── Helper to format complaint for client consistency ───────────────────────
const formatComplaint = (c) => {
  if (!c) return null;
  return {
    ...c,
    _id: c.id,
    image: {
      url: c.imageUrl || null,
      publicId: c.imagePublicId || null,
    },
    location: {
      type: 'Point',
      coordinates: [c.longitude, c.latitude],
    },
    citizenId: c.citizen ? { ...c.citizen, _id: c.citizen.id } : c.citizenId,
    municipalCorporationId: c.municipalCorporation
      ? { ...c.municipalCorporation, _id: c.municipalCorporation.id }
      : c.municipalCorporationId,
    duplicateOf: c.duplicateOf ? { ...c.duplicateOf, _id: c.duplicateOf.id } : c.duplicateOfId,
  };
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

    // Step 1 — Bounding box candidates from Supabase
    const latDelta = (DUPLICATE_RADIUS / 111000) * 1.5;
    const lonDelta = (DUPLICATE_RADIUS / (111000 * Math.cos((lat * Math.PI) / 180) || 1)) * 1.5;

    const candidates = await prisma.complaint.findMany({
      where: {
        status: { in: ['REPORTED', 'RECEIVED', 'IN_PROGRESS'] },
        damageCategory,
        isDuplicate: false,
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lon - lonDelta, lte: lon + lonDelta },
      },
    });

    const nearbyWithDist = candidates
      .map((c) => ({ complaint: c, distance: haversine(lat, lon, c.latitude, c.longitude) }))
      .filter((item) => item.distance <= DUPLICATE_RADIUS)
      .sort((a, b) => a.distance - b.distance);

    if (nearbyWithDist.length > 0) {
      const { complaint: nearby, distance } = nearbyWithDist[0];

      // Step 2 — Gemini semantic check
      let aiDuplicateReason = null;
      if (description && nearby.description) {
        const aiCheck = await checkSemanticDuplicate(
          description,
          damageCategory,
          nearby.description,
          nearby.damageCategory
        );
        if (!aiCheck.isDuplicate && aiCheck.confidence < 50) {
          return success(
            res,
            { isDuplicate: false, aiOverride: true, reason: aiCheck.reason },
            'No duplicate found (AI verified).'
          );
        }
        aiDuplicateReason = aiCheck.reason;
      }

      return success(
        res,
        {
          isDuplicate: true,
          complaint: {
            complaintId: nearby.complaintId,
            damageCategory: nearby.damageCategory,
            status: nearby.status,
            address: nearby.address,
            createdAt: nearby.createdAt,
          },
          distance,
          aiReason: aiDuplicateReason,
        },
        'Duplicate complaint found.'
      );
    }

    return success(res, { isDuplicate: false }, 'No duplicate found.');
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

    // ── 1. Read image buffer ──────────────────────────────────────────────────
    let imageData = { url: null, publicId: null };
    let imageBuffer = null;
    let imageMimeType = 'image/jpeg';

    if (req.file) {
      imageBuffer = req.file.buffer;
      imageMimeType = req.file.mimetype;

      const validation = await validateRoadImage(imageBuffer, imageMimeType);
      if (!validation.valid) {
        return error(
          res,
          `Invalid image rejected. ${validation.reason || 'The uploaded image does not appear to show road damage.'} (Detected: "${validation.whatIsShown || 'unknown'}"). Please upload a clear photo of road damage.`,
          400,
          'INVALID_IMAGE_CONTENT'
        );
      }

      try {
        const uploaded = await uploadImage(imageBuffer, imageMimeType);
        imageData = { url: uploaded.url, publicId: uploaded.publicId };
      } catch (uploadErr) {
        console.error('Image upload failed (continuing):', uploadErr.message);
      }
    }

    // ── 2. Gemini AI analysis ────────────────────────────────────────────────
    let geminiAnalysis = { available: false, message: 'No image provided.' };
    if (imageBuffer) {
      try {
        geminiAnalysis = await analyzeRoadDamage(imageBuffer, imageMimeType);
        if (geminiAnalysis.available) {
          if (!damageCategory || damageCategory === 'OTHER') {
            damageCategory = geminiAnalysis.detectedCategory || 'OTHER';
          }
        }
      } catch (aiErr) {
        console.error('Gemini analysis error (non-fatal):', aiErr.message);
      }
    }

    // ── 3. Reverse geocode + duplicate check candidates ──────────────────────
    const latDelta = (DUPLICATE_RADIUS / 111000) * 1.5;
    const lonDelta = (DUPLICATE_RADIUS / (111000 * Math.cos((lat * Math.PI) / 180) || 1)) * 1.5;

    const [address, existingCandidates] = await Promise.all([
      reverseGeocode(lat, lon),
      prisma.complaint.findMany({
        where: {
          status: { in: ['REPORTED', 'RECEIVED', 'IN_PROGRESS'] },
          isDuplicate: false,
          latitude: { gte: lat - latDelta, lte: lat + latDelta },
          longitude: { gte: lon - lonDelta, lte: lon + lonDelta },
        },
        take: 10,
      }),
    ]);

    // ── 4. Duplicate detection ────────────────────────────────────────────────
    let isDuplicate = false,
      duplicateOfId = null,
      duplicateDistance = null;

    const nearbyWithDist = existingCandidates
      .map((c) => ({ complaint: c, distance: haversine(lat, lon, c.latitude, c.longitude) }))
      .filter((item) => item.distance <= DUPLICATE_RADIUS)
      .sort((a, b) => a.distance - b.distance);

    if (nearbyWithDist.length > 0) {
      const closest = nearbyWithDist[0].complaint;
      const dist = nearbyWithDist[0].distance;
      let markAsDuplicate = true;

      if (description && closest.description) {
        try {
          const aiCheck = await checkSemanticDuplicate(
            description,
            damageCategory,
            closest.description,
            closest.damageCategory
          );
          if (!aiCheck.isDuplicate) markAsDuplicate = false;
        } catch {}
      }

      if (markAsDuplicate) {
        isDuplicate = true;
        duplicateOfId = closest.id;
        duplicateDistance = dist;
      }
    }

    // ── 5. Municipal Corporation assignment ──────────────────────────────────
    const { corporation, assignmentStatus } = await findMunicipalCorporation(lon, lat);

    // ── 6. Generate complaint ID ─────────────────────────────────────────────
    const complaintId = await generateComplaintId();

    // ── 7. Create complaint ──────────────────────────────────────────────────
    const complaint = await prisma.complaint.create({
      data: {
        complaintId,
        citizenId: req.user.id,
        imageUrl: imageData.url,
        imagePublicId: imageData.publicId,
        damageCategory: damageCategory || 'OTHER',
        customDamageType: damageCategory === 'OTHER' ? customDamageType : null,
        description: description || '',
        latitude: lat,
        longitude: lon,
        address: address || {},
        municipalCorporationId: corporation ? corporation.id : null,
        assignmentStatus,
        status: 'REPORTED',
        isDuplicate,
        duplicateOfId,
        duplicateDistance,
        aiAnalysis: geminiAnalysis.available
          ? {
              available: true,
              detectedCategory: geminiAnalysis.detectedCategory,
              confidence: geminiAnalysis.confidence,
              damageLabel: geminiAnalysis.damageLabel,
              severity: geminiAnalysis.severity,
              estimatedSize: geminiAnalysis.estimatedSize,
              safetyRisk: geminiAnalysis.safetyRisk,
              safetyDetail: geminiAnalysis.safetyDetail,
              recommendedAction: geminiAnalysis.recommendedAction,
              urgency: geminiAnalysis.urgency,
              additionalNotes: geminiAnalysis.additionalNotes,
              analyzedAt: geminiAnalysis.analyzedAt,
            }
          : { available: false, message: geminiAnalysis.message },
      },
      include: {
        citizen: { select: { id: true, name: true, email: true } },
        municipalCorporation: { select: { id: true, name: true, code: true, city: true } },
      },
    });

    // ── 8. Status history ────────────────────────────────────────────────────
    await prisma.complaintStatusHistory.create({
      data: {
        complaintId: complaint.id,
        previousStatus: null,
        newStatus: 'REPORTED',
        changedById: req.user.id,
        comment: 'Complaint submitted by citizen.',
      },
    });

    // ── 9. Notification ──────────────────────────────────────────────────────
    await createStatusNotification(req.user.id, complaintId, complaint.id, 'REPORTED');

    let message = `Complaint ${complaintId} submitted successfully.`;
    if (geminiAnalysis.available) {
      message += ` AI detected: ${geminiAnalysis.damageLabel} (${geminiAnalysis.severity} severity).`;
    }
    if (isDuplicate) {
      message += ` Flagged as duplicate (${duplicateDistance}m from existing report).`;
    }

    return success(res, { complaint: formatComplaint(complaint), aiAnalysis: geminiAnalysis }, message, 201);
  } catch (err) {
    console.error('Create complaint error:', err);
    return error(res, 'Failed to submit complaint. Please try again.', 500);
  }
};

// ─── GET /api/complaints/my ───────────────────────────────────────────────────
const getMyComplaints = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 10);
    const skip = (page - 1) * limit;

    const where = { citizenId: req.user.id };
    if (req.query.status) where.status = req.query.status;
    if (req.query.damageCategory) where.damageCategory = req.query.damageCategory;

    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          municipalCorporation: { select: { id: true, name: true, code: true, city: true } },
        },
      }),
      prisma.complaint.count({ where }),
    ]);

    return success(
      res,
      {
        complaints: complaints.map(formatComplaint),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
      'Complaints retrieved.'
    );
  } catch (err) {
    console.error('Get my complaints error:', err);
    return error(res, 'Failed to retrieve complaints.', 500);
  }
};

// ─── GET /api/complaints/:id ──────────────────────────────────────────────────
const getComplaintById = async (req, res) => {
  try {
    const complaint = await prisma.complaint.findUnique({
      where: { id: req.params.id },
      include: {
        municipalCorporation: { select: { id: true, name: true, code: true, city: true, state: true } },
        citizen: { select: { id: true, name: true, email: true } },
        duplicateOf: { select: { id: true, complaintId: true, status: true } },
      },
    });

    if (!complaint) return error(res, 'Complaint not found.', 404, 'NOT_FOUND');
    if (req.user.role === 'citizen' && complaint.citizenId !== req.user.id) {
      return error(res, 'Access denied.', 403, 'FORBIDDEN');
    }

    return success(res, { complaint: formatComplaint(complaint) }, 'Complaint retrieved.');
  } catch (err) {
    console.error('Get complaint by id error:', err);
    return error(res, 'Failed to retrieve complaint.', 500);
  }
};

// ─── GET /api/complaints/:id/status-history ───────────────────────────────────
const getStatusHistory = async (req, res) => {
  try {
    const complaint = await prisma.complaint.findUnique({
      where: { id: req.params.id },
      select: { citizenId: true, complaintId: true },
    });

    if (!complaint) return error(res, 'Complaint not found.', 404, 'NOT_FOUND');
    if (req.user.role === 'citizen' && complaint.citizenId !== req.user.id) {
      return error(res, 'Access denied.', 403, 'FORBIDDEN');
    }

    const history = await prisma.complaintStatusHistory.findMany({
      where: { complaintId: req.params.id },
      orderBy: { createdAt: 'asc' },
      include: { changedBy: { select: { id: true, name: true, role: true } } },
    });

    const mapped = history.map((h) => ({
      ...h,
      _id: h.id,
      changedBy: h.changedBy ? { ...h.changedBy, _id: h.changedBy.id } : null,
    }));

    return success(res, { history: mapped }, 'Status history retrieved.');
  } catch (err) {
    console.error('Get status history error:', err);
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

    const latDelta = (rad / 111000) * 1.5;
    const lonDelta = (rad / (111000 * Math.cos((lat * Math.PI) / 180) || 1)) * 1.5;

    const candidates = await prisma.complaint.findMany({
      where: {
        isDuplicate: false,
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lon - lonDelta, lte: lon + lonDelta },
      },
      take: 100,
    });

    const filtered = candidates
      .filter((c) => haversine(lat, lon, c.latitude, c.longitude) <= rad)
      .slice(0, 50)
      .map(formatComplaint);

    return success(res, { complaints: filtered, count: filtered.length }, 'Nearby complaints retrieved.');
  } catch (err) {
    console.error('Get nearby complaints error:', err);
    return error(res, 'Failed to retrieve nearby complaints.', 500);
  }
};

// ─── GET /api/complaints/map ──────────────────────────────────────────────────
const getMapComplaints = async (req, res) => {
  try {
    const where = { isDuplicate: false };
    if (req.query.status) where.status = req.query.status;
    if (req.query.damageCategory) where.damageCategory = req.query.damageCategory;

    const complaints = await prisma.complaint.findMany({
      where,
      take: 500,
      orderBy: { createdAt: 'desc' },
    });

    return success(res, { complaints: complaints.map(formatComplaint) }, 'Map data retrieved.');
  } catch (err) {
    console.error('Get map complaints error:', err);
    return error(res, 'Failed to retrieve map data.', 500);
  }
};

module.exports = {
  checkDuplicate,
  createComplaint,
  getMyComplaints,
  getComplaintById,
  getStatusHistory,
  getNearbyComplaints,
  getMapComplaints,
};
