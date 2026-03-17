/**
 * CreateJobPage.js
 * Logic:
 * - AI price suggestion (auto-fetch on category/description change)
 * - AI description quality score + enhancement
 * - Commission preview (platform fee + GST + worker payout)
 * - Direct hire (pre-filled worker_id from state)
 * - Priority selector
 * - GPS location for job
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createJob } from '../../api/jobAPI';
import { getAllCategories } from '../../api/categoryAPI';
import { getAIPriceSuggestion, enhanceJobDescription } from '../../api/aiAPI';
import { calculateCommission, debounce, extractError, formatCurrency } from '../../utils/helpers';
import { useNotification } from '../../context/NotificationContext';

const CreateJobPage = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { addToast } = useNotification();

  // Pre-fill direct hire from WorkerProfile page
  const directWorker = location.state?.direct_worker_id || '';
  const directName   = location.state?.worker_name || '';

  const [form, setForm] = useState({
    title: '', description: '', category_id: '', budget: '',
    location_text: '', latitude: '', longitude: '',
    priority: 'normal', direct_worker_id: directWorker, deadline: ''
  });
  const [categories,  setCategories]  = useState([]);
  const [aiPrice,     setAiPrice]     = useState(null);
  const [commission,  setCommission]  = useState(null);
  const [aiDesc,      setAiDesc]      = useState(null);
  const [enhancing,   setEnhancing]   = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [errors,      setErrors]      = useState({});
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    getAllCategories().then(({ data }) => setCategories(data.data || [])).catch(() => {});
  }, []);

  // AI price suggestion (debounced)
  const fetchPrice = useRef(debounce(async (categoryId, city, budget) => {
    if (!categoryId) return;
    try {
      const cat = categories.find((c) => String(c.id) === String(categoryId));
      const { data } = await getAIPriceSuggestion({
        category: cat?.name || '',
        location: city || '',
        urgency:  form.priority,
      });
      setAiPrice(data.data);
    } catch {}
  }, 700)).current;

  useEffect(() => {
    if (form.category_id) fetchPrice(form.category_id, form.location_text, form.budget);
  }, [form.category_id, form.location_text, form.priority]);

  // Commission preview
  useEffect(() => {
    const amt = parseFloat(form.budget);
    if (amt > 0) setCommission(calculateCommission(amt));
    else         setCommission(null);
  }, [form.budget]);

  // AI description analysis (debounced)
  const analyzeRef = useRef(debounce(async (desc) => {
    if (desc.length < 10) { setAiDesc(null); return; }
    try {
      const { data } = await enhanceJobDescription({ description: desc });
      setAiDesc(data.data);
    } catch {}
  }, 800)).current;

  useEffect(() => { analyzeRef(form.description); }, [form.description]);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((er) => ({ ...er, [e.target.name]: '' }));
    setServerError('');
  };

  const handleEnhance = async () => {
    if (!form.description) return;
    setEnhancing(true);
    try {
      const { data } = await enhanceJobDescription({ description: form.description });
      setAiDesc(data.data);
      addToast('✨ Description analyzed!', 'success');
    } catch { addToast('Could not enhance description', 'error'); }
    finally { setEnhancing(false); }
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim() || form.title.length < 5) e.title = 'Title must be at least 5 characters';
    if (!form.category_id) e.category_id = 'Category is required';
    if (!form.budget || parseFloat(form.budget) <= 0) e.budget = 'Budget must be greater than 0';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length) { setErrors(v); return; }

    setLoading(true);
    try {
      const { data } = await createJob({
        ...form,
        budget: parseFloat(form.budget),
        category_id: parseInt(form.category_id),
        direct_worker_id: form.direct_worker_id ? parseInt(form.direct_worker_id) : undefined,
      });
      addToast('✅ Job posted successfully!', 'success');
      navigate(`/jobs/${data.data?.job_id || data.data?.id}`);
    } catch (err) {
      setServerError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  const inp = (name, label, type = 'text', placeholder = '') => (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontSize:13, fontWeight:500, marginBottom:4, color:'#374151' }}>{label}</label>
      <input name={name} type={type} value={form[name]} onChange={handleChange} placeholder={placeholder}
        style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1.5px solid ${errors[name] ? '#ef4444' : '#d1d5db'}`, fontSize:14, boxSizing:'border-box' }} />
      {errors[name] && <p style={{ color:'#ef4444', fontSize:12, marginTop:3 }}>{errors[name]}</p>}
    </div>
  );

  return (
    <div style={{ maxWidth:700, margin:'0 auto' }}>
      <h2 style={{ fontSize:22, fontWeight:700, marginBottom:24 }}>📋 Post a Job</h2>

      {directName && (
        <div style={{ background:'#eef2ff', border:'1px solid #c7d2fe', borderRadius:10, padding:'12px 16px', marginBottom:20, fontSize:14 }}>
          💼 Direct hire for: <strong>{directName}</strong>
          <button onClick={() => setForm((f) => ({ ...f, direct_worker_id: '' }))}
            style={{ marginLeft:8, background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:12 }}>✕ Remove</button>
        </div>
      )}

      {serverError && (
        <div style={{ background:'#fee2e2', borderRadius:8, padding:'10px 14px', marginBottom:16, color:'#dc2626', fontSize:14 }}>{serverError}</div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 14px', fontSize:16 }}>Job Details</h3>
          {inp('title', 'Job Title *', 'text', 'e.g. Fix bathroom pipe leak')}

          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, marginBottom:4 }}>Description</label>
            <div style={{ position:'relative' }}>
              <textarea name="description" value={form.description} onChange={handleChange} rows={4}
                placeholder="Describe the work in detail — what needs to be done, any special requirements..."
                style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, boxSizing:'border-box', resize:'vertical' }} />
            </div>
            {aiDesc && (
              <div style={{ marginTop:6, padding:'8px 12px', background:'#f0fdf4', borderRadius:8, fontSize:12 }}>
                <div style={{ color:'#059669', fontWeight:500 }}>
                  Quality score: {aiDesc.quality_score}/100 · Words: {aiDesc.word_count}
                </div>
                {aiDesc.improvement_suggestions?.length > 0 && (
                  <ul style={{ margin:'4px 0 0', paddingLeft:16, color:'#6b7280' }}>
                    {aiDesc.improvement_suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                )}
              </div>
            )}
            <button type="button" onClick={handleEnhance} disabled={enhancing || !form.description}
              style={{ marginTop:6, padding:'6px 12px', background:'#f0fdf4', color:'#059669', border:'1px solid #bbf7d0', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:500 }}>
              {enhancing ? '✨ Analyzing…' : '🤖 Analyze with AI'}
            </button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div>
              <label style={{ display:'block', fontSize:13, fontWeight:500, marginBottom:4, color:'#374151' }}>Category *</label>
              <select name="category_id" value={form.category_id} onChange={handleChange}
                style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1.5px solid ${errors.category_id ? '#ef4444' : '#d1d5db'}`, fontSize:14, background:'#fff' }}>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              {errors.category_id && <p style={{ color:'#ef4444', fontSize:12, marginTop:3 }}>{errors.category_id}</p>}
            </div>
            <div>
              <label style={{ display:'block', fontSize:13, fontWeight:500, marginBottom:4 }}>Priority</label>
              <select name="priority" value={form.priority} onChange={handleChange}
                style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, background:'#fff' }}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent 🔥</option>
              </select>
            </div>
          </div>
          {inp('deadline', 'Deadline (optional)', 'date')}
        </div>

        {/* Budget + AI price */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 14px', fontSize:16 }}>💰 Budget</h3>
          {inp('budget', 'Budget Amount (₹) *', 'number', 'Enter your budget')}

          {aiPrice && (
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'12px 14px', marginBottom:12, fontSize:13 }}>
              <strong style={{ color:'#059669' }}>🤖 AI Price Suggestion</strong>
              <div style={{ marginTop:6, display:'flex', gap:16, flexWrap:'wrap', color:'#374151' }}>
                <span>Suggested: <strong>{formatCurrency(aiPrice.suggested_min)}–{formatCurrency(aiPrice.suggested_max)}</strong></span>
                <span>Market rate: <strong>{formatCurrency(aiPrice.market_rate)}</strong></span>
                <span>Hourly: <strong>{formatCurrency(aiPrice.hourly_rate)}/hr</strong></span>
              </div>
              <button type="button" onClick={() => setForm((f) => ({ ...f, budget: aiPrice.market_rate }))}
                style={{ marginTop:6, padding:'4px 10px', background:'#6366f1', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:12 }}>
                Use Market Rate
              </button>
            </div>
          )}

          {/* Commission preview */}
          {commission && (
            <div style={{ background:'#fafafa', borderRadius:8, padding:'12px 14px', fontSize:13, color:'#374151' }}>
              <strong style={{ display:'block', marginBottom:6 }}>Fee Breakdown</strong>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span>Job amount</span><strong>{formatCurrency(commission.job_amount)}</strong>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', color:'#6b7280' }}>
                  <span>Platform fee (10%)</span><span>−{formatCurrency(commission.platform_fee)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', color:'#6b7280' }}>
                  <span>Trust & Safety (2%)</span><span>−{formatCurrency(commission.trust_safety_fee)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', color:'#6b7280' }}>
                  <span>GST (18% on fees)</span><span>{formatCurrency(commission.gst_amount)}</span>
                </div>
                <hr style={{ margin:'4px 0', borderColor:'#e5e7eb' }} />
                <div style={{ display:'flex', justifyContent:'space-between', fontWeight:600, color:'#10b981' }}>
                  <span>Worker receives</span><span>{formatCurrency(commission.worker_payout)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontWeight:600, color:'#374151' }}>
                  <span>You pay (incl. GST)</span><span>{formatCurrency(commission.seeker_total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Location */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:24, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 14px', fontSize:16 }}>📍 Job Location</h3>
          {inp('location_text', 'Location / City', 'text', 'e.g. Bandra West, Mumbai')}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {inp('latitude',  'Latitude (optional)',  'number')}
            {inp('longitude', 'Longitude (optional)', 'number')}
          </div>
        </div>

        <button type="submit" disabled={loading}
          style={{ width:'100%', padding:'13px', borderRadius:8, background: loading ? '#9ca3af' : '#6366f1', color:'#fff', border:'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight:600, fontSize:16 }}>
          {loading ? 'Posting…' : '🚀 Post Job'}
        </button>
      </form>
    </div>
  );
};

export default CreateJobPage;
