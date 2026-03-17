/**
 * MyJobsPage.js
 * Tabbed view for workers (assigned jobs) and seekers (posted jobs)
 * With status filter + pagination
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyJobs } from '../../api/jobAPI';
import Spinner from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import { formatDate, formatCurrency, jobStatusColor, jobStatusLabel, extractError } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

const STATUSES = ['all', 'open', 'assigned', 'in_progress', 'completed', 'cancelled', 'disputed'];

const MyJobsPage = () => {
  const { isWorker } = useAuth();
  const [jobs,   setJobs]   = useState([]);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const { page, limit, meta, updateMeta, setPage } = usePagination(1, 10);

  useEffect(() => {
    setPage(1);
  }, [status]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = { page, limit, ...(status !== 'all' ? { status } : {}) };
        const { data } = await getMyJobs(params);
        setJobs(data.data?.jobs || data.data || []);
        updateMeta(data.data?.pagination);
      } catch (e) {
        setError(extractError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [page, status]);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <h2 style={{ fontSize:22, fontWeight:700, margin:0 }}>📋 My Jobs</h2>
        {!isWorker && (
          <Link to="/jobs/create" style={{ padding:'10px 20px', background:'#6366f1', color:'#fff', borderRadius:8, textDecoration:'none', fontWeight:600, fontSize:14 }}>
            + Post New Job
          </Link>
        )}
      </div>

      {/* Status filter tabs */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            style={{
              padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer', fontSize:13,
              background: status === s ? '#6366f1' : '#f3f4f6',
              color:      status === s ? '#fff'    : '#374151',
              fontWeight: status === s ? 600 : 400, textTransform:'capitalize',
            }}>
            {s === 'all' ? 'All' : jobStatusLabel(s)}
          </button>
        ))}
      </div>

      {error && <div style={{ color:'#ef4444', marginBottom:12 }}>{error}</div>}

      {loading ? <Spinner /> : (
        <>
          {jobs.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, background:'#fff', borderRadius:12, color:'#9ca3af', boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
              <div style={{ fontSize:48, marginBottom:8 }}>📋</div>
              <p>No jobs found{status !== 'all' ? ` with status "${status}"` : ''}.</p>
              {!isWorker && (
                <Link to="/jobs/create" style={{ color:'#6366f1', fontWeight:600 }}>Post your first job →</Link>
              )}
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {jobs.map((job) => (
                <Link key={job.id} to={`/jobs/${job.id}`} style={{ textDecoration:'none', color:'inherit' }}>
                  <div style={{
                    background:'#fff', borderRadius:12, padding:'16px 20px',
                    boxShadow:'0 2px 8px rgba(0,0,0,.06)',
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    flexWrap:'wrap', gap:12,
                    borderLeft:`4px solid ${jobStatusColor(job.status)}`,
                  }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:15, color:'#1f2937', marginBottom:4 }}>{job.title}</div>
                      <div style={{ fontSize:13, color:'#6b7280', display:'flex', gap:12, flexWrap:'wrap' }}>
                        <span>📅 {formatDate(job.created_at)}</span>
                        {job.category_name && <span>🏷 {job.category_name}</span>}
                        {job.budget && <span>💰 {formatCurrency(job.budget)}</span>}
                        {isWorker ? job.seeker_name && <span>👤 {job.seeker_name}</span> : job.worker_name && <span>👷 {job.worker_name}</span>}
                      </div>
                    </div>
                    <span style={{
                      padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:600,
                      background: jobStatusColor(job.status) + '20',
                      color:      jobStatusColor(job.status),
                    }}>
                      {jobStatusLabel(job.status)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <Pagination meta={meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default MyJobsPage;
