/**
 * Reverse geocode using Nominatim (client-side call)
 * Only call when user selects a location — not on every map move.
 */
export const reverseGeocode = async (latitude, longitude) => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
    const res = await fetch(url, {
      headers: {
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
    console.warn('Reverse geocode failed, using coordinates fallback:', err.message)
    return {
      formatted: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      road: '',
      area: '',
      city: '',
      state: '',
      postcode: '',
    }
  }
}

/**
 * Fallback to IP geolocation when browser GPS is denied or unavailable
 */
const getIpLocation = async () => {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error('IP geo failed')
    const data = await res.json()
    if (data.latitude && data.longitude) {
      return {
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        accuracy: 1000,
        isIpFallback: true,
      }
    }
  } catch (e) {
    // Try secondary IP provider
    try {
      const res2 = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(5000) })
      const data2 = await res2.json()
      if (data2.success && data2.latitude && data2.longitude) {
        return {
          latitude: parseFloat(data2.latitude),
          longitude: parseFloat(data2.longitude),
          accuracy: 1000,
          isIpFallback: true,
        }
      }
    } catch {}
  }
  return null
}

/**
 * Get user's GPS position using Browser Geolocation API with robust fallbacks
 */
export const getCurrentPosition = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      getIpLocation().then((ipLoc) => {
        if (ipLoc) return resolve(ipLoc)
        reject(new Error('Geolocation is not supported by your browser.'))
      })
      return
    }

    // Try High Accuracy first (GPS)
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        // High accuracy failed or timed out — try Low Accuracy (Wi-Fi/Cell)
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            }),
          async () => {
            // Browser GPS completely failed/denied — try IP geolocation
            const ipLoc = await getIpLocation()
            if (ipLoc) return resolve(ipLoc)

            let message = 'Unable to determine your location. Please select it on the map.'
            if (err.code === err.PERMISSION_DENIED) {
              message = 'Location permission was denied. Please allow location in your browser or click on the map.'
            } else if (err.code === err.TIMEOUT) {
              message = 'Location request timed out. Please click on the map to set your location.'
            }
            reject(new Error(message))
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        )
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    )
  })
}
