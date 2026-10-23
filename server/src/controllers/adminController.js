const Complaint = require('../models/Complaint');
const ComplaintStatusHistory = require('../models/ComplaintStatusHistory');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { deleteFromCloudinary } = require('../config/cloudinary');
const { createStatusNotification } = require('../services/notificationService');
const { success, error } = require('../utils/apiResponse');

// ─── GET /api/admin/complaints ────────────────────────────────────────────────
const getComplaints = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 10);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.damageCategory) filter.damageCategory = req.query.damageCategory;
    if (req.query.municipalCorporationId) filter.municipalCorporationId = req.query.municipalCorporationId;
    if (req.query.isDuplicate !== undefined) filter.isDuplicate = req.query.isDuplicate === 'true';

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to + 'T23:59:59.999Z');
    }

    if (req.query.search) {
      const regex = { $regex: req.query.search, $options: 'i' };
      filter.$or = [
        { complaintId: regex },
        { 'address.city': regex },
        { 'address.road': regex },
        { 'address.area': regex },
        { 'address.formatted': regex },
      ];
    }

    const [complaints, total] = await Promise.all([
      Complaint.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('citizenId', 'name email phone')
        .populate('municipalCorporationId', 'name code city'),
      Complaint.countDocuments(filter),
    ]);

    return success(res, {
      complaints,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, 'Complaints retrieved.');
  } catch (err) {
    console.error('Admin get complaints error:', err);
    return error(res, 'Failed to retrieve complaints.', 500);
  }
};

// ─── GET /api/admin/complaints/:id ───────────────────────────────────────────
const getComplaintDetail = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('citizenId', 'name email phone createdAt')
      .populate('municipalCorporationId', 'name code city state')
      .populate('duplicateOf', 'complaintId status damageCategory');

    if (!complaint) return error(res, 'Complaint not found.', 404, 'NOT_FOUND');

    const history = await ComplaintStatusHistory.find({ complaintId: complaint._id })
      .sort({ createdAt: 1 })
      .populate('changedBy', 'name role');

    return success(res, { complaint, history }, 'Complaint detail retrieved.');
  } catch (err) {
    console.error('Admin get complaint detail error:', err);
    return error(res, 'Failed to retrieve complaint.', 500);
  }
};

// ─── PATCH /api/admin/complaints/:id/status ───────────────────────────────────
const updateStatus = async (req, res) => {
  try {
    const { status, comment } = req.body;
    const validStatuses = ['REPORTED', 'RECEIVED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

    if (!validStatuses.includes(status)) {
      return error(res, 'Invalid status value.', 400, 'INVALID_STATUS');
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return error(res, 'Complaint not found.', 404, 'NOT_FOUND');

    if (complaint.status === status) {
      return error(res, `Complaint is already in ${status} status.`, 400, 'NO_CHANGE');
    }

    const previousStatus = complaint.status;
    complaint.status = status;
    await complaint.save();

    // Record status history
    await ComplaintStatusHistory.create({
      complaintId: complaint._id,
      previousStatus,
      newStatus: status,
      changedBy: req.user._id,
      comment: comment || '',
    });

    // Notify citizen
    await createStatusNotification(
      complaint.citizenId,
      complaint.complaintId,
      complaint._id,
      status
    );

    const updated = await Complaint.findById(complaint._id)
      .populate('citizenId', 'name email')
      .populate('municipalCorporationId', 'name code city');

    return success(res, { complaint: updated }, `Status updated to ${status}.`);
  } catch (err) {
    console.error('Update status error:', err);
    return error(res, 'Failed to update status.', 500);
  }
};

// ─── GET /api/admin/dashboard ─────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const [statusStats, categoryStats, monthlyStats, totalUsers, recentComplaints] = await Promise.all([
      // Status distribution
      Complaint.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Category distribution
      Complaint.aggregate([
        { $group: { _id: '$damageCategory', count: { $sum: 1 } } },
      ]),
      // Monthly stats — last 12 months
      Complaint.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Total citizens
      User.countDocuments({ role: 'citizen' }),
      // Recent 5 complaints
      Complaint.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('citizenId', 'name')
        .populate('municipalCorporationId', 'name'),
    ]);

    // Build totals from status stats
    const statusMap = {};
    let totalComplaints = 0;
    statusStats.forEach((s) => {
      statusMap[s._id] = s.count;
      totalComplaints += s.count;
    });

    const duplicates = await Complaint.countDocuments({ isDuplicate: true });

    return success(res, {
      totalComplaints,
      reported: statusMap['REPORTED'] || 0,
      received: statusMap['RECEIVED'] || 0,
      inProgress: statusMap['IN_PROGRESS'] || 0,
      resolved: statusMap['RESOLVED'] || 0,
      closed: statusMap['CLOSED'] || 0,
      duplicates,
      totalUsers,
      categoryStats: categoryStats.map((c) => ({ category: c._id, count: c.count })),
      monthlyStats: monthlyStats.map((m) => ({ month: m._id, count: m.count })),
      recentComplaints,
    }, 'Dashboard data retrieved.');
  } catch (err) {
    console.error('Dashboard error:', err);
    return error(res, 'Failed to retrieve dashboard data.', 500);
  }
};

// ─── GET /api/admin/analytics ─────────────────────────────────────────────────
const getAnalytics = async (req, res) => {
  try {
    const matchFilter = {};
    if (req.query.from || req.query.to) {
      matchFilter.createdAt = {};
      if (req.query.from) matchFilter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) matchFilter.createdAt.$lte = new Date(req.query.to + 'T23:59:59.999Z');
    }

    const [
      total,
      statusDist,
      categoryDist,
      monthlyData,
      municipalDist,
      duplicateCount,
    ] = await Promise.all([
      Complaint.countDocuments(matchFilter),
      Complaint.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Complaint.aggregate([
        { $match: matchFilter },
        { $group: { _id: '$damageCategory', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Complaint.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Complaint.aggregate([
        { $match: { ...matchFilter, municipalCorporationId: { $ne: null } } },
        {
          $group: {
            _id: '$municipalCorporationId',
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'municipalcorporations',
            localField: '_id',
            foreignField: '_id',
            as: 'corporation',
          },
        },
        { $unwind: { path: '$corporation', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            name: { $ifNull: ['$corporation.name', 'Unassigned'] },
            count: 1,
          },
        },
        { $sort: { count: -1 } },
      ]),
      Complaint.countDocuments({ ...matchFilter, isDuplicate: true }),
    ]);

    const resolved = statusDist.find((s) => s._id === 'RESOLVED')?.count || 0;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return success(res, {
      period: { from: req.query.from || null, to: req.query.to || null },
      totalComplaints: total,
      resolutionRate,
      duplicateCount,
      statusDistribution: statusDist.map((s) => ({ status: s._id, count: s.count })),
      categoryDistribution: categoryDist.map((c) => ({ category: c._id, count: c.count })),
      monthlyData: monthlyData.map((m) => ({ month: m._id, count: m.count })),
      municipalDistribution: municipalDist,
    }, 'Analytics data retrieved.');
  } catch (err) {
    console.error('Analytics error:', err);
    return error(res, 'Failed to retrieve analytics.', 500);
  }
};

// ─── GET /api/admin/map ───────────────────────────────────────────────────────
const getMapData = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.damageCategory) filter.damageCategory = req.query.damageCategory;
    if (req.query.municipalCorporationId) filter.municipalCorporationId = req.query.municipalCorporationId;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to + 'T23:59:59.999Z');
    }

    const complaints = await Complaint.find(filter)
      .limit(1000)
      .select('complaintId damageCategory status location address createdAt image isDuplicate municipalCorporationId')
      .populate('municipalCorporationId', 'name code');

    return success(res, { complaints, count: complaints.length }, 'Map data retrieved.');
  } catch (err) {
    console.error('Admin map error:', err);
    return error(res, 'Failed to retrieve map data.', 500);
  }
};

// ─── GET /api/admin/reports ───────────────────────────────────────────────────
const getReports = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.damageCategory) filter.damageCategory = req.query.damageCategory;
    if (req.query.municipalCorporationId) filter.municipalCorporationId = req.query.municipalCorporationId;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to + 'T23:59:59.999Z');
    }

    const [complaints, categoryStats, statusStats, monthlyStats] = await Promise.all([
      Complaint.find(filter)
        .sort({ createdAt: -1 })
        .populate('citizenId', 'name email')
        .populate('municipalCorporationId', 'name code city'),
      Complaint.aggregate([{ $match: filter }, { $group: { _id: '$damageCategory', count: { $sum: 1 } } }]),
      Complaint.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Complaint.aggregate([
        { $match: filter },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    return success(res, {
      summary: { total: complaints.length },
      complaints,
      categoryStats: categoryStats.map((c) => ({ category: c._id, count: c.count })),
      statusStats: statusStats.map((s) => ({ status: s._id, count: s.count })),
      monthlyStats: monthlyStats.map((m) => ({ month: m._id, count: m.count })),
    }, 'Report data retrieved.');
  } catch (err) {
    console.error('Reports error:', err);
    return error(res, 'Failed to retrieve report data.', 500);
  }
};

// ─── GET /api/admin/reports/export ────────────────────────────────────────────
const exportReports = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.damageCategory) filter.damageCategory = req.query.damageCategory;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to + 'T23:59:59.999Z');
    }

    const complaints = await Complaint.find(filter)
      .sort({ createdAt: -1 })
      .populate('citizenId', 'name email phone')
      .populate('municipalCorporationId', 'name code city');

    const headers = [
      'Complaint ID', 'Status', 'Damage Category', 'Description',
      'Address', 'City', 'State', 'Latitude', 'Longitude',
      'Municipal Corporation', 'Citizen Name', 'Citizen Email',
      'Is Duplicate', 'Created At',
    ].join(',');

    const rows = complaints.map((c) => {
      const lon = c.location?.coordinates?.[0] || '';
      const lat = c.location?.coordinates?.[1] || '';
      const cells = [
        c.complaintId,
        c.status,
        c.damageCategory,
        `"${(c.description || '').replace(/"/g, '""')}"`,
        `"${(c.address?.formatted || '').replace(/"/g, '""')}"`,
        c.address?.city || '',
        c.address?.state || '',
        lat,
        lon,
        c.municipalCorporationId?.name || 'Unassigned',
        c.citizenId?.name || '',
        c.citizenId?.email || '',
        c.isDuplicate ? 'Yes' : 'No',
        c.createdAt.toISOString(),
      ];
      return cells.join(',');
    });

    const csv = [headers, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="road-damage-report-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (err) {
    console.error('Export error:', err);
    return error(res, 'Failed to export report.', 500);
  }
};

// ─── GET /api/admin/duplicates ────────────────────────────────────────────────
const getDuplicates = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 10);
    const skip = (page - 1) * limit;

    const [duplicates, total] = await Promise.all([
      Complaint.find({ isDuplicate: true })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('duplicateOf', 'complaintId status damageCategory')
        .populate('citizenId', 'name email'),
      Complaint.countDocuments({ isDuplicate: true }),
    ]);

    return success(res, {
      duplicates,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, 'Duplicate complaints retrieved.');
  } catch (err) {
    console.error('Get duplicates error:', err);
    return error(res, 'Failed to retrieve duplicates.', 500);
  }
};

module.exports = {
  getComplaints,
  getComplaintDetail,
  updateStatus,
  getDashboard,
  getAnalytics,
  getMapData,
  getReports,
  exportReports,
  getDuplicates,
};
