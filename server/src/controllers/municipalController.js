const MunicipalCorporation = require('../models/MunicipalCorporation');
const { success, error } = require('../utils/apiResponse');

// GET /api/municipal
const getAll = async (req, res) => {
  try {
    const corporations = await MunicipalCorporation.find({ isActive: true })
      .select('name code city state isDemo');
    return success(res, { corporations }, 'Municipal corporations retrieved.');
  } catch (err) {
    return error(res, 'Failed to retrieve municipal corporations.', 500);
  }
};

// GET /api/municipal/:id
const getById = async (req, res) => {
  try {
    const corp = await MunicipalCorporation.findById(req.params.id);
    if (!corp) return error(res, 'Municipal corporation not found.', 404);
    return success(res, { corporation: corp }, 'Municipal corporation retrieved.');
  } catch (err) {
    return error(res, 'Failed to retrieve municipal corporation.', 500);
  }
};

module.exports = { getAll, getById };
