/**
 * DisputesPage.js
 * Shows user's disputes list + details modal
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getUserDisputes } from '../../api/disputeAPI';
import Spinner from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import { formatDate, extractError } from '../../utils/helpers';

const STATUS_COLORS = { open:'#3b82f6', under_review:'#f59e0b', resolved:'#10b981', closed:'#6b7280' };

const DisputesPage = () => {
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [filterStatus, setFStatus] = useState('');
  const { page, limit, meta, updateMeta, setPage } = usePagination(1, 10);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await getUserDisputes({ page, limit, ...(filterStatus ? { status: filterStatus } : {}) });
        setDisputes(data.data?.disputes || []);
        updateMeta(data.data?.pagination);
      } catch (e) {
        setError(extractError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [page, filterStatus]);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <h2 style={{ fontSize:22, fontWeight:700, margin:0 }}>⚖️ My Disputes</h2>
        <Link to="/disputes/create" style={{ padding:'10px 18px', background:'#f97316', color:'#fff', borderRadius:8, textDecoration:'none', fontWeight:600, fontSize:14 }}>
          + Raise Dispute
        </Link>
      </div>

      <div style={{ marginBottom:16, display:'flex', gap:8, flexWrap:'wrap' }}>
        {['', 'open', 'under_review', 'resolved', 'closed'].map((s) => (
          <button key={s} onClick={() => { setFStatus(s); setPage(1); }}
            style={{ padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer', fontSize:13,
              background: filterStatus === s ? '#6366f1' : '#f3f4f6',
              color:      filterStatus === s ? '#fff' : '#374151',
              fontWeight: filterStatus === s ? 600 : 400,
            }}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {error && <div style={{ color:'#ef4444', marginBottom:12 }}>{error}</div>}
      {loading ? <Spinner /> : (
        <>
          {disputes.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, background:'#fff', borderRadius:12, color:'#9ca3af', boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
              <div style={{ fontSize:48 }}>⚖️</div>
              <p>No disputes found.</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {disputes.map((d) => (
                <div key={d.id} onClick={() => navigate(`/disputes/${d.id}`)}
                  style={{ background:'#fff', borderRadius:12, padding:'16px 20px', boxShadow:'0 2px 8px rgba(0,0,0,.06)', cursor:'pointer', borderLeft:`4px solid ${STATUS_COLORS[d.status] || '#6b7280'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:15, color:'#1f2937' }}>{d.job_title || `Job #${d.job_id}`}</div>
                      <div style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>{d.reason?.slice(0, 80)}…</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:600, background: (STATUS_COLORS[d.status]||'#6b7280') + '20', color: STATUS_COLORS[d.status]||'#6b7280' }}>{d.status?.replace('_',' ')}</span>
                      <span style={{ fontSize:12, color:'#9ca3af' }}>{formatDate(d.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination meta={meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default DisputesPage;
