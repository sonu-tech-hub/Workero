/**
 * WorkerSearchPage.js
 * Logic:
 * - Search by profession, city, category, experience range, min rating
 * - Optional GPS location filter with radius
 * - AI-match ranking toggle
 * - Sort by rating, experience, price
 * - Pagination
 * - Debounced search on text fields
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { searchWorkers } from '../../api/workerAPI';
import { getAllCategories } from '../../api/categoryAPI';
import { getAIMatchedWorkers } from '../../api/aiAPI';
import useGeolocation from '../../hooks/useGeolocation';
import usePagination from '../../hooks/usePagination';
import Spinner from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import StarRating from '../../components/common/StarRating';
import { formatCurrency, debounce, extractError } from '../../utils/helpers';

const INITIAL_FILTERS = {
  profession: '', category_id: '', city: '',
  min_experience: '', max_experience: '',
  min_rating: 0, availability: false,
  sort: 'rating', ai_match: false, radius: 50
};

const WorkerSearchPage = () => {
  const [filters, setFilters]   = useState(INITIAL_FILTERS);
  const [workers, setWorkers]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState('');
  const [categories, setCategories] = useState([]);
  const { page, limit, meta, updateMeta, setPage } = usePagination(1, 12);
  const { coords, getLocation, loading: geoLoading, error: geoError } = useGeolocation();

  // Load categories once
  useEffect(() => {
    getAllCategories().then(({ data }) => setCategories(data.data || [])).catch(() => {});
  }, []);

  const doSearch = useCallback(async (f = filters, p = page) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        ...f, page: p, limit,
        ...(coords && f.sort !== 'ai' ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
      };
      Object.keys(params).forEach((k) => {
        if (params[k] === '' || params[k] === false || params[k] === 0) delete params[k];
      });

      let res;
      if (f.ai_match) {
        res = await getAIMatchedWorkers(params);
      } else {
        res = await searchWorkers(params);
      }
      const d = res.data.data;
      setWorkers(d.workers || []);
      updateMeta(d.pagination);
    } catch (e) {
      setError(extractError(e));
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit, coords, updateMeta]);

  const debouncedSearch = useRef(debounce((f, p) => doSearch(f, p), 500)).current;

  useEffect(() => { debouncedSearch(filters, 1); setPage(1); }, [filters]);
  useEffect(() => { doSearch(filters, page); }, [page]);

  const handleFilter = (key, val) => {
    setFilters((f) => ({ ...f, [key]: val }));
  };

  const handleGPS = async () => {
    try {
      await getLocation();
      doSearch(filters, 1);
    } catch { setError(geoError || 'GPS unavailable'); }
  };

  const WorkerCard = ({ w }) => (
    <Link to={`/workers/${w.user_id}`} style={{ textDecoration:'none', color:'inherit' }}>
      <div style={{
        background:'#fff', borderRadius:12, padding:20,
        boxShadow:'0 2px 8px rgba(0,0,0,.06)',
        transition:'box-shadow 0.2s', cursor:'pointer',
        border: w.ai_recommended ? '2px solid #6366f1' : '1px solid transparent',
        position:'relative',
      }}>
        {w.ai_recommended && (
          <span style={{
            position:'absolute', top:10, right:10,
            background:'#6366f1', color:'#fff',
            fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:600,
          }}>🤖 AI Pick</span>
        )}
        <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
          <div style={{ width:52, height:52, borderRadius:'50%', background:'#e5e7eb', overflow:'hidden', flexShrink:0 }}>
            {w.profile_photo_url
              ? <img src={w.profile_photo_url} alt={w.full_name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>👤</div>
            }
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <strong style={{ fontSize:15, color:'#1f2937' }}>{w.full_name}</strong>
              {w.is_verified && <span style={{ fontSize:11, color:'#10b981' }}>✓</span>}
              {w.is_available && <span style={{ fontSize:11, color:'#10b981', background:'#d1fae5', padding:'1px 6px', borderRadius:10 }}>Available</span>}
            </div>
            <div style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>{w.profession}</div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
              <StarRating rating={w.average_rating} size={13} />
              <span style={{ fontSize:12, color:'#9ca3af' }}>({w.review_count || 0})</span>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginTop:12, fontSize:13, color:'#6b7280' }}>
          {w.city && <span>📍 {w.city}</span>}
          {w.experience_years !== undefined && <span>💼 {w.experience_years}y exp</span>}
          {w.distance !== null && w.distance !== undefined && <span>🗺 {w.distance} km</span>}
          {w.hourly_rate && <span style={{ color:'#6366f1', fontWeight:600 }}>{formatCurrency(w.hourly_rate)}/hr</span>}
        </div>

        {w.skills?.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:8 }}>
            {w.skills.slice(0, 4).map((s) => (
              <span key={s} style={{ padding:'2px 8px', background:'#f3f4f6', borderRadius:20, fontSize:11, color:'#374151' }}>{s}</span>
            ))}
          </div>
        )}

        {w.ai_match_score !== undefined && (
          <div style={{ marginTop:8, fontSize:12, color:'#6366f1', fontWeight:500 }}>
            Match score: {w.ai_match_score}%
            {w.ai_match_reasons?.length > 0 && (
              <span style={{ color:'#9ca3af', fontWeight:400 }}> · {w.ai_match_reasons.slice(0, 2).join(', ')}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );

  return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:700, marginBottom:20 }}>🔍 Find Workers</h2>

      {/* Filter panel */}
      <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
          <input
            placeholder="Profession (e.g. Plumber)"
            value={filters.profession}
            onChange={(e) => handleFilter('profession', e.target.value)}
            style={{ padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14 }}
          />
          <select value={filters.category_id} onChange={(e) => handleFilter('category_id', e.target.value)}
            style={{ padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, background:'#fff' }}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            placeholder="City"
            value={filters.city}
            onChange={(e) => handleFilter('city', e.target.value)}
            style={{ padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14 }}
          />
          <select value={filters.sort} onChange={(e) => handleFilter('sort', e.target.value)}
            style={{ padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, background:'#fff' }}>
            <option value="rating">Sort: Rating</option>
            <option value="experience">Sort: Experience</option>
            <option value="price">Sort: Price ↑</option>
          </select>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <label style={{ fontSize:13, fontWeight:500 }}>Min Rating</label>
            <select value={filters.min_rating} onChange={(e) => handleFilter('min_rating', e.target.value)}
              style={{ flex:1, padding:'9px 10px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, background:'#fff' }}>
              {[0,1,2,3,4,4.5].map((r) => <option key={r} value={r}>{r > 0 ? `${r}+ ⭐` : 'Any'}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
              <input type="checkbox" checked={filters.availability} onChange={(e) => handleFilter('availability', e.target.checked)} />
              Available Only
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
              <input type="checkbox" checked={filters.ai_match} onChange={(e) => handleFilter('ai_match', e.target.checked)} />
              🤖 AI Match
            </label>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:12 }}>
          <button onClick={handleGPS} disabled={geoLoading}
            style={{ padding:'8px 16px', background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:500 }}>
            {geoLoading ? '…' : '📡 Use My Location'}
          </button>
          {coords && (
            <span style={{ fontSize:13, color:'#10b981', display:'flex', alignItems:'center', gap:4 }}>
              📍 Location active
              <input type="number" value={filters.radius} onChange={(e) => handleFilter('radius', e.target.value)}
                style={{ width:60, padding:'4px 8px', borderRadius:6, border:'1px solid #d1d5db', fontSize:13 }} />
              km radius
            </span>
          )}
          <button onClick={() => setFilters(INITIAL_FILTERS)}
            style={{ padding:'8px 14px', background:'#fee2e2', color:'#ef4444', border:'none', borderRadius:8, cursor:'pointer', fontSize:13 }}>
            Reset
          </button>
        </div>
      </div>

      {error && <div style={{ color:'#ef4444', marginBottom:12 }}>{error}</div>}

      {loading ? <Spinner /> : (
        <>
          <div style={{ marginBottom:12, fontSize:14, color:'#6b7280' }}>
            {meta?.total ?? 0} workers found
          </div>
          {workers.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'#9ca3af' }}>
              <div style={{ fontSize:48 }}>🔍</div>
              <p>No workers found. Try adjusting your filters.</p>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
              {workers.map((w) => <WorkerCard key={w.user_id} w={w} />)}
            </div>
          )}
          <Pagination meta={meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default WorkerSearchPage;
