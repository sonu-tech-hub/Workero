import React, { useState, useEffect } from 'react';
import { getAllCategories, getPopularCategories } from '../../api/categoryAPI';
import { Link } from 'react-router-dom';
import Spinner from '../../components/common/Spinner';

const CategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [popular, setPopular]       = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.allSettled([getAllCategories(), getPopularCategories(6)])
      .then(([allRes, popRes]) => {
        if (allRes.status === 'fulfilled') setCategories(allRes.value.data.data || []);
        if (popRes.status === 'fulfilled') setPopular(popRes.value.data.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6'];

  return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:700, marginBottom:20 }}>🏷 Service Categories</h2>

      {popular.length > 0 && (
        <div style={{ marginBottom:28 }}>
          <h3 style={{ fontSize:16, fontWeight:600, marginBottom:12 }}>🔥 Popular Categories</h3>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            {popular.map((c, i) => (
              <Link key={c.id} to={`/workers/search?category_id=${c.id}`} style={{ textDecoration:'none' }}>
                <div style={{ padding:'12px 20px', borderRadius:12, background: COLORS[i % COLORS.length], color:'#fff', fontWeight:600, fontSize:14, cursor:'pointer', display:'flex', gap:8, alignItems:'center' }}>
                  {c.icon || '🔧'} {c.name}
                  <span style={{ fontSize:12, opacity:0.8 }}>({c.worker_count})</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:16 }}>
        {categories.map((c, i) => (
          <Link key={c.id} to={`/workers/search?category_id=${c.id}`} style={{ textDecoration:'none' }}>
            <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)', cursor:'pointer', borderTop:`3px solid ${COLORS[i % COLORS.length]}` }}>
              <div style={{ fontSize:28, marginBottom:8 }}>{c.icon || '🔧'}</div>
              <div style={{ fontWeight:600, fontSize:15, color:'#1f2937' }}>{c.name}</div>
              {c.description && <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>{c.description}</div>}
              <div style={{ fontSize:12, color: COLORS[i % COLORS.length], marginTop:8, fontWeight:500 }}>
                {c.worker_count || 0} workers available
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default CategoriesPage;
