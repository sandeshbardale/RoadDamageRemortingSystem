const { prisma } = require('../config/prisma');
const { createStatusNotification } = require('../services/notificationService');
const { success, error } = require('../utils/apiResponse');

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

// ─── GET /api/admin/complaints ────────────────────────────────────────────────
const getComplaints = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 10);
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.damageCategory) where.damageCategory = req.query.damageCategory;
    if (req.query.municipalCorporationId) where.municipalCorporationId = req.query.municipalCorporationId;
    if (req.query.isDuplicate !== undefined) where.isDuplicate = req.query.isDuplicate === 'true';

    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(req.query.from);
      if (req.query.to) where.createdAt.lte = new Date(req.query.to + 'T23:59:59.999Z');
    }

    if (req.query.search) {
      where.OR = [
        { complaintId: { contains: req.query.search, mode: 'insensitive' } },
        { description: { contains: req.query.search, mode: 'insensitive' } },
      ];
    }

    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          citizen: { select: { id: true, name: true, email: true, phone: true } },
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
    console.error('Admin get complaints error:', err);
    return error(res, 'Failed to retrieve complaints.', 500);
  }
};

// ─── GET /api/admin/complaints/:id ───────────────────────────────────────────
const getComplaintDetail = async (req, res) => {
  try {
    const complaint = await prisma.complaint.findUnique({
      where: { id: req.params.id },
      include: {
        citizen: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
        municipalCorporation: { select: { id: true, name: true, code: true, city: true, state: true } },
        duplicateOf: { select: { id: true, complaintId: true, status: true, damageCategory: true } },
      },
    });

    if (!complaint) return error(res, 'Complaint not found.', 404, 'NOT_FOUND');

    const history = await prisma.complaintStatusHistory.findMany({
      where: { complaintId: complaint.id },
      orderBy: { createdAt: 'asc' },
      include: { changedBy: { select: { id: true, name: true, role: true } } },
    });

    const mappedHistory = history.map((h) => ({
      ...h,
      _id: h.id,
      changedBy: h.changedBy ? { ...h.changedBy, _id: h.changedBy.id } : null,
    }));

    return success(
      res,
      { complaint: formatComplaint(complaint), history: mappedHistory },
      'Complaint detail retrieved.'
    );
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

    const complaint = await prisma.complaint.findUnique({
      where: { id: req.params.id },
    });
    if (!complaint) return error(res, 'Complaint not found.', 404, 'NOT_FOUND');

    if (complaint.status === status) {
      return error(res, `Complaint is already in ${status} status.`, 400, 'NO_CHANGE');
    }

    const previousStatus = complaint.status;

    const updated = await prisma.complaint.update({
      where: { id: complaint.id },
      data: { status },
      include: {
        citizen: { select: { id: true, name: true, email: true } },
        municipalCorporation: { select: { id: true, name: true, code: true, city: true } },
      },
    });

    // Record status history
    await prisma.complaintStatusHistory.create({
      data: {
        complaintId: complaint.id,
        previousStatus,
        newStatus: status,
        changedById: req.user.id,
        comment: comment || '',
      },
    });

    // Notify citizen
    await createStatusNotification(complaint.citizenId, complaint.complaintId, complaint.id, status);

    return success(res, { complaint: formatComplaint(updated) }, `Status updated to ${status}.`);
  } catch (err) {
    console.error('Update status error:', err);
    return error(res, 'Failed to update status.', 500);
  }
};

// ─── GET /api/admin/dashboard ─────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const [allComplaints, totalUsers, recentComplaints] = await Promise.all([
      prisma.complaint.findMany({
        select: { status: true, damageCategory: true, isDuplicate: true, createdAt: true },
      }),
      prisma.user.count({ where: { role: 'citizen' } }),
      prisma.complaint.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          citizen: { select: { id: true, name: true } },
          municipalCorporation: { select: { id: true, name: true } },
        },
      }),
    ]);

    const statusMap = {};
    const categoryMap = {};
    const monthMap = {};
    let duplicates = 0;

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    allComplaints.forEach((c) => {
      statusMap[c.status] = (statusMap[c.status] || 0) + 1;
      categoryMap[c.damageCategory] = (categoryMap[c.damageCategory] || 0) + 1;
      if (c.isDuplicate) duplicates++;

      if (c.createdAt >= oneYearAgo) {
        const m = c.createdAt.toISOString().slice(0, 7);
        monthMap[m] = (monthMap[m] || 0) + 1;
      }
    });

    const categoryStats = Object.keys(categoryMap).map((cat) => ({
      category: cat,
      count: categoryMap[cat],
    }));

    const monthlyStats = Object.keys(monthMap)
      .sort()
      .map((month) => ({ month, count: monthMap[month] }));

    return success(
      res,
      {
        totalComplaints: allComplaints.length,
        reported: statusMap['REPORTED'] || 0,
        received: statusMap['RECEIVED'] || 0,
        inProgress: statusMap['IN_PROGRESS'] || 0,
        resolved: statusMap['RESOLVED'] || 0,
        closed: statusMap['CLOSED'] || 0,
        duplicates,
        totalUsers,
        categoryStats,
        monthlyStats,
        recentComplaints: recentComplaints.map(formatComplaint),
      },
      'Dashboard data retrieved.'
    );
  } catch (err) {
    console.error('Dashboard error:', err);
    return error(res, 'Failed to retrieve dashboard data.', 500);
  }
};

// ─── GET /api/admin/analytics ─────────────────────────────────────────────────
const getAnalytics = async (req, res) => {
  try {
    const where = {};
    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(req.query.from);
      if (req.query.to) where.createdAt.lte = new Date(req.query.to + 'T23:59:59.999Z');
    }

    const [complaints, corporations] = await Promise.all([
      prisma.complaint.findMany({
        where,
        select: {
          status: true,
          damageCategory: true,
          isDuplicate: true,
          municipalCorporationId: true,
          createdAt: true,
        },
      }),
      prisma.municipalCorporation.findMany({ select: { id: true, name: true } }),
    ]);

    const corpNameMap = {};
    corporations.forEach((corp) => {
      corpNameMap[corp.id] = corp.name;
    });

    const statusMap = {};
    const catMap = {};
    const monthMap = {};
    const muniMap = {};
    let duplicates = 0;

    complaints.forEach((c) => {
      statusMap[c.status] = (statusMap[c.status] || 0) + 1;
      catMap[c.damageCategory] = (catMap[c.damageCategory] || 0) + 1;
      if (c.isDuplicate) duplicates++;

      const m = c.createdAt.toISOString().slice(0, 7);
      monthMap[m] = (monthMap[m] || 0) + 1;

      if (c.municipalCorporationId) {
        const name = corpNameMap[c.municipalCorporationId] || 'Unassigned';
        muniMap[name] = (muniMap[name] || 0) + 1;
      }
    });

    const total = complaints.length;
    const resolved = statusMap['RESOLVED'] || 0;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return success(
      res,
      {
        period: { from: req.query.from || null, to: req.query.to || null },
        totalComplaints: total,
        resolutionRate,
        duplicateCount: duplicates,
        statusDistribution: Object.keys(statusMap).map((k) => ({ status: k, count: statusMap[k] })),
        categoryDistribution: Object.keys(catMap).map((k) => ({ category: k, count: catMap[k] })),
        monthlyData: Object.keys(monthMap)
          .sort()
          .map((m) => ({ month: m, count: monthMap[m] })),
        municipalDistribution: Object.keys(muniMap).map((name) => ({ name, count: muniMap[name] })),
      },
      'Analytics data retrieved.'
    );
  } catch (err) {
    console.error('Analytics error:', err);
    return error(res, 'Failed to retrieve analytics.', 500);
  }
};

// ─── GET /api/admin/map ───────────────────────────────────────────────────────
const getMapData = async (req, res) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.damageCategory) where.damageCategory = req.query.damageCategory;
    if (req.query.municipalCorporationId) where.municipalCorporationId = req.query.municipalCorporationId;
    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(req.query.from);
      if (req.query.to) where.createdAt.lte = new Date(req.query.to + 'T23:59:59.999Z');
    }

    const complaints = await prisma.complaint.findMany({
      where,
      take: 1000,
      include: {
        municipalCorporation: { select: { id: true, name: true, code: true } },
      },
    });

    return success(
      res,
      { complaints: complaints.map(formatComplaint), count: complaints.length },
      'Map data retrieved.'
    );
  } catch (err) {
    console.error('Admin map error:', err);
    return error(res, 'Failed to retrieve map data.', 500);
  }
};

// ─── GET /api/admin/reports ───────────────────────────────────────────────────
const getReports = async (req, res) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.damageCategory) where.damageCategory = req.query.damageCategory;
    if (req.query.municipalCorporationId) where.municipalCorporationId = req.query.municipalCorporationId;
    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(req.query.from);
      if (req.query.to) where.createdAt.lte = new Date(req.query.to + 'T23:59:59.999Z');
    }

    const complaints = await prisma.complaint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        citizen: { select: { id: true, name: true, email: true } },
        municipalCorporation: { select: { id: true, name: true, code: true, city: true } },
      },
    });

    const categoryMap = {};
    const statusMap = {};
    const monthMap = {};

    complaints.forEach((c) => {
      categoryMap[c.damageCategory] = (categoryMap[c.damageCategory] || 0) + 1;
      statusMap[c.status] = (statusMap[c.status] || 0) + 1;
      const m = c.createdAt.toISOString().slice(0, 7);
      monthMap[m] = (monthMap[m] || 0) + 1;
    });

    return success(
      res,
      {
        summary: { total: complaints.length },
        complaints: complaints.map(formatComplaint),
        categoryStats: Object.keys(categoryMap).map((k) => ({ category: k, count: categoryMap[k] })),
        statusStats: Object.keys(statusMap).map((k) => ({ status: k, count: statusMap[k] })),
        monthlyStats: Object.keys(monthMap)
          .sort()
          .map((m) => ({ month: m, count: monthMap[m] })),
      },
      'Report data retrieved.'
    );
  } catch (err) {
    console.error('Reports error:', err);
    return error(res, 'Failed to retrieve report data.', 500);
  }
};

// ─── GET /api/admin/reports/export ────────────────────────────────────────────
const exportReports = async (req, res) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.damageCategory) where.damageCategory = req.query.damageCategory;
    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(req.query.from);
      if (req.query.to) where.createdAt.lte = new Date(req.query.to + 'T23:59:59.999Z');
    }

    const complaints = await prisma.complaint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        citizen: { select: { id: true, name: true, email: true, phone: true } },
        municipalCorporation: { select: { id: true, name: true, code: true, city: true } },
      },
    });

    const headers = [
      'Complaint ID',
      'Status',
      'Damage Category',
      'Description',
      'Address',
      'City',
      'State',
      'Latitude',
      'Longitude',
      'Municipal Corporation',
      'Citizen Name',
      'Citizen Email',
      'Is Duplicate',
      'Created At',
    ].join(',');

    const rows = complaints.map((c) => {
      const address = c.address || {};
      const cells = [
        c.complaintId,
        c.status,
        c.damageCategory,
        `"${(c.description || '').replace(/"/g, '""')}"`,
        `"${(address.formatted || '').replace(/"/g, '""')}"`,
        address.city || '',
        address.state || '',
        c.latitude,
        c.longitude,
        c.municipalCorporation?.name || 'Unassigned',
        c.citizen?.name || '',
        c.citizen?.email || '',
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
      prisma.complaint.findMany({
        where: { isDuplicate: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          duplicateOf: { select: { id: true, complaintId: true, status: true, damageCategory: true } },
          citizen: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.complaint.count({ where: { isDuplicate: true } }),
    ]);

    return success(
      res,
      {
        duplicates: duplicates.map(formatComplaint),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
      'Duplicate complaints retrieved.'
    );
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
