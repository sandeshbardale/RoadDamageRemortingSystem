const { prisma } = require('../config/prisma');
const { success, error } = require('../utils/apiResponse');

// GET /api/municipal
const getAll = async (req, res) => {
  try {
    const corporations = await prisma.municipalCorporation.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, city: true, state: true, isDemo: true },
    });

    const mapped = corporations.map((c) => ({ ...c, _id: c.id }));
    return success(res, { corporations: mapped }, 'Municipal corporations retrieved.');
  } catch (err) {
    console.error('Get all municipal error:', err);
    return error(res, 'Failed to retrieve municipal corporations.', 500);
  }
};

// GET /api/municipal/:id
const getById = async (req, res) => {
  try {
    const corp = await prisma.municipalCorporation.findUnique({
      where: { id: req.params.id },
    });
    if (!corp) return error(res, 'Municipal corporation not found.', 404);
    corp._id = corp.id;
    return success(res, { corporation: corp }, 'Municipal corporation retrieved.');
  } catch (err) {
    console.error('Get municipal by id error:', err);
    return error(res, 'Failed to retrieve municipal corporation.', 500);
  }
};

module.exports = { getAll, getById };
