/**
 * useGeolocation.js
 * Wraps the browser Geolocation API.
 * Returns { coords, error, loading, getLocation }
 */
import { useState, useCallback } from 'react';

const useGeolocation = () => {
  const [coords,  setCoords]  = useState(null); // { latitude, longitude }
  const [error,   setError]   = useState(null);
  const [loading, setLoading] = useState(false);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return Promise.reject('unsupported');
    }

    setLoading(true);
    setError(null);

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords: c }) => {
          const result = { latitude: c.latitude, longitude: c.longitude };
          setCoords(result);
          setLoading(false);
          resolve(result);
        },
        (err) => {
          const msg =
            err.code === 1 ? 'Location access denied. Please allow location to search nearby workers.'
            : err.code === 2 ? 'Location unavailable. Please try again.'
            : 'Location request timed out.';
          setError(msg);
          setLoading(false);
          reject(msg);
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
      );
    });
  }, []);

  return { coords, error, loading, getLocation };
};

export default useGeolocation;
