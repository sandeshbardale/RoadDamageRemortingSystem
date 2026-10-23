const MunicipalCorporation = require('../models/MunicipalCorporation');

/**
 * Find which municipal corporation boundary contains a given point.
 * Uses MongoDB $geoIntersects with 2dsphere index on boundary.
 *
 * @param {number} longitude
 * @param {number} latitude
 * @returns {Promise<{corporation: object|null, assignmentStatus: string}>}
 */
const findMunicipalCorporation = async (longitude, latitude) => {
  try {
    const point = {
      type: 'Point',
      coordinates: [longitude, latitude],
    };

    const corporation = await MunicipalCorporation.findOne({
      isActive: true,
      boundary: {
        $geoIntersects: {
          $geometry: point,
        },
      },
    });

    if (corporation) {
      return { corporation, assignmentStatus: 'ASSIGNED' };
    }

    // No polygon found — try to find the closest as a fallback
    const nearest = await MunicipalCorporation.findOne({ isActive: true });
    if (nearest) {
      return { corporation: nearest, assignmentStatus: 'UNASSIGNED' };
    }

    return { corporation: null, assignmentStatus: 'UNASSIGNED' };
  } catch (error) {
    console.error('Municipal assignment error:', error.message);
    return { corporation: null, assignmentStatus: 'UNASSIGNED' };
  }
};

module.exports = { findMunicipalCorporation };
