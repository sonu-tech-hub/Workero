/**
 * useFetch.js
 * Generic data-fetching hook.
 * Usage: const { data, loading, error, refetch } = useFetch(apiFn, [...args]);
 */
import { useState, useEffect, useCallback, useRef } from 'react';

const useFetch = (apiFn, params = [], options = {}) => {
  const { immediate = true, onSuccess, onError } = options;

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error,   setError]   = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const execute = useCallback(async (...overrideParams) => {
    setLoading(true);
    setError(null);
    try {
      const args = overrideParams.length ? overrideParams : params;
      const res  = await apiFn(...args);
      const result = res.data;
      if (mountedRef.current) {
        setData(result);
        onSuccess?.(result);
      }
      return result;
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Something went wrong';
      if (mountedRef.current) {
        setError(msg);
        onError?.(msg);
      }
      throw err;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFn, ...params]);

  useEffect(() => {
    if (immediate) execute();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, error, refetch: execute };
};

export default useFetch;
