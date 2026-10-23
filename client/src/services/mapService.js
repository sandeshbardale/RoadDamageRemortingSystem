/**
 * Reverse geocode using Nominatim (client-side call)
 * Only call when user selects a location — not on every map move.
 */
export const reverseGeocode = async (latitude, longitude) => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'RoadDamageReporting/1.0',
        'Accept-Language': 'en',
      },
    })
    if (!res.ok) throw new Error('Geocoding request failed')
    const data = await res.json()
    const addr = data.address || {}
    return {
      formatted: data.display_name || `${latitude}, ${longitude}`,
      road: addr.road || addr.pedestrian || addr.path || '',
      area: addr.suburb || addr.neighbourhood || addr.village || '',
      city: addr.city || addr.town || addr.municipality || addr.county || '',
      state: addr.state || '',
      postcode: addr.postcode || '',
    }
  } catch (err) {
    console.error('Reverse geocode failed:', err.message)
    return {
      formatted: `${latitude}, ${longitude}`,
      road: '', area: '', city: '', state: '', postcode: '',
    }
  }
}

/**
 * Get user's GPS position using Browser Geolocation API
 */
export const getCurrentPosition = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation is not supported by your browser.'))
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => {
        let message
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = 'Location permission was denied. Please enable location access or enter the location manually.'
            break
          case err.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable. Please enter the location manually.'
            break
          case err.TIMEOUT:
            message = 'Location request timed out. Please try again or enter the location manually.'
            break
          default:
            message = 'Unable to determine your location. Please enter it manually.'
        }
        reject(new Error(message))
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  })
}
