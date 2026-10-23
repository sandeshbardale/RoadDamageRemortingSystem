const { prisma } = require('../config/prisma');

/**
 * Standard ray-casting algorithm for point-in-polygon test
 * @param {[number, number]} point [longitude, latitude]
 * @param {Array<[number, number]>} ring Array of [lon, lat] coordinates
 */
const isPointInRing = (point, ring) => {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

/**
 * Find which municipal corporation boundary contains a given point.
 * Checks active corporations with GeoJSON boundaries, falls back to nearest/active corporation.
 *
 * @param {number} longitude
 * @param {number} latitude
 * @returns {Promise<{corporation: object|null, assignmentStatus: string}>}
 */
const findMunicipalCorporation = async (longitude, latitude) => {
  try {
    const corporations = await prisma.municipalCorporation.findMany({
      where: { isActive: true },
    });

    for (const corp of corporations) {
      if (corp.boundary && corp.boundary.coordinates) {
        const rings = corp.boundary.coordinates;
        if (Array.isArray(rings) && rings.length > 0) {
          // GeoJSON Polygon coordinates: outer ring is rings[0]
          const outerRing = rings[0];
          if (Array.isArray(outerRing) && isPointInRing([longitude, latitude], outerRing)) {
            corp._id = corp.id;
            return { corporation: corp, assignmentStatus: 'ASSIGNED' };
          }
        }
      }
    }

    // Fallback: assign to the first active corporation
    const fallback = corporations[0] || null;
    if (fallback) fallback._id = fallback.id;
    return { corporation: fallback, assignmentStatus: fallback ? 'UNASSIGNED' : 'UNASSIGNED' };
  } catch (error) {
    console.error('Municipal assignment error:', error.message);
    return { corporation: null, assignmentStatus: 'UNASSIGNED' };
  }
};

module.exports = { findMunicipalCorporation };
