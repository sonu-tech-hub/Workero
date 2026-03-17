import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllJobs } from '../../api/jobAPI';
import { getAllCategories } from '../../api/categoryAPI';
import Spinner from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import { formatDate, formatCurrency, jobStatusColor, jobStatusLabel, debounce, extractError } from '../../utils/helpers';
import { useRef } from 'react';

const BrowseJobsPage = () => {
  const [jobs, setJobs]         = useState([]);
  const [categories, setCats]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [catId,  setCatId]      = useState('');
  const [status, setStatus]     = useState('open');
  const [error,  setError]      = useState('');
  const { page, limit, meta, updateMeta, setPage } = usePagination(1, 12);

  useEffect(() => {
    getAllCategories().then(({ data }) => setCats(data.data || [])).catch(() => {});
  }, []);

  const doFetch = async (s = search, cat = catId, st = status, p = page) => {
    setLoading(true);
    try {
      const params = { page: p, limit, ...(s ? { search: s } : {}), ...(cat ? { category_id: cat } : {}), ...(st ? { status: st } : {}) };
      const { data } = await getAllJobs(params);
      setJobs(data.data?.jobs || data.data || []);
      updateMeta(data.data?.pagination);
    } catch (e) {
      setError(extractError(e));
    } finally {
      setLoading(false);
    }
  };

  const debouncedFetch = useRef(debounce(doFetch, 500)).current;
  useEffect(() => { debouncedFetch(search, catId, status, 1); setPage(1); }, [search, catId, status]);
  useEffect(() => { doFetch(search, catId, status, page); }, [page]);

  return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:700, marginBottom:20 }}>💼 Browse Jobs</h2>

      <div style={{ background:'#fff', borderRadius:12, padding:16, marginBottom:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)', display:'flex', gap:12, flexWrap:'wrap' }}>
        <input placeholder="Search jobs…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex:2, minWidth:200, padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14 }} />
        <select value={catId} onChange={(e) => setCatId(e.target.value)}
          style={{ flex:1, minWidth:160, padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, background:'#fff' }}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          style={{ padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, background:'#fff' }}>
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {error && <div style={{ color:'#ef4444', marginBottom:12 }}>{error}</div>}
      {loading ? <Spinner /> : (
        <>
          <div style={{ fontSize:14, color:'#6b7280', marginBottom:12 }}>{meta?.total ?? 0} jobs found</div>
          {jobs.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'#9ca3af' }}><div style={{ fontSize:48 }}>💼</div><p>No jobs found.</p></div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
              {jobs.map((job) => (
                <Link key={job.id} to={`/jobs/${job.id}`} style={{ textDecoration:'none', color:'inherit' }}>
                  <div style={{ background:'#fff', borderRadius:12, padding:18, boxShadow:'0 2px 8px rgba(0,0,0,.06)', height:'100%', boxSizing:'border-box', borderTop:`3px solid ${jobStatusColor(job.status)}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <h3 style={{ fontSize:15, fontWeight:600, margin:0, flex:1 }}>{job.title}</h3>
                      <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background: jobStatusColor(job.status)+'20', color: jobStatusColor(job.status), fontWeight:600, marginLeft:8, flexShrink:0 }}>
                        {jobStatusLabel(job.status)}
                      </span>
                    </div>
                    {job.description && <p style={{ fontSize:13, color:'#6b7280', margin:'0 0 10px', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{job.description}</p>}
                    <div style={{ fontSize:13, color:'#6b7280', display:'flex', flexWrap:'wrap', gap:8 }}>
                      {job.category_name && <span>🏷 {job.category_name}</span>}
                      {job.budget && <span style={{ color:'#6366f1', fontWeight:600 }}>{formatCurrency(job.budget)}</span>}
                      {job.location_text && <span>📍 {job.location_text}</span>}
                      <span>📅 {formatDate(job.created_at)}</span>
                    </div>
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

export default BrowseJobsPage;
