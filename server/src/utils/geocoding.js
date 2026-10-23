const axios = require('axios');

/**
 * Reverse geocode coordinates using Nominatim (OpenStreetMap)
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<object>} address object
 */
const reverseGeocode = async (latitude, longitude) => {
  try {
    const baseUrl = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
    const response = await axios.get(`${baseUrl}/reverse`, {
      params: {
        format: 'json',
        lat: latitude,
        lon: longitude,
        zoom: 18,
        addressdetails: 1,
      },
      headers: {
        'User-Agent': 'RoadDamageReporting/1.0 (road-damage@example.com)',
        'Accept-Language': 'en',
      },
      timeout: 8000,
    });

    const data = response.data;
    const addr = data.address || {};

    return {
      formatted: data.display_name || '',
      road: addr.road || addr.pedestrian || addr.path || '',
      area: addr.suburb || addr.neighbourhood || addr.quarter || addr.village || '',
      city: addr.city || addr.town || addr.municipality || addr.county || '',
      state: addr.state || '',
      postcode: addr.postcode || '',
      country: addr.country || '',
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error.message);
    // Return minimal address on failure — don't block complaint creation
    return {
      formatted: `${latitude}, ${longitude}`,
      road: '',
      area: '',
      city: '',
      state: '',
      postcode: '',
      country: '',
    };
  }
};

module.exports = { reverseGeocode };
