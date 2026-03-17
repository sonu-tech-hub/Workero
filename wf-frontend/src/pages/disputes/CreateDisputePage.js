import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createDispute } from '../../api/disputeAPI';
import { getJobById } from '../../api/jobAPI';
import { extractError } from '../../utils/helpers';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/common/Spinner';

const CreateDisputePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const { user, isWorker } = useAuth();
  const { job_id, job_title, against_user_id } = location.state || {};

  const [form, setForm] = useState({
    job_id: job_id || '',
    against_user: against_user_id || '',
    reason: '',
    description: ''
  });
  const [files, setFiles]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  useEffect(() => {
    // If we have the opponent's ID from navigation, we don't need to fetch.
    if (against_user_id) {
      setLoading(false);
      return;
    }

    // If there's no job ID, we can't fetch anything. Show an error.
    if (!job_id) {
      setError('Job ID is missing. Cannot create a dispute.');
      setLoading(false);
      return;
    }

    // If the user context isn't loaded yet, wait for it to re-trigger the effect.
    if (!user) return;

    const fetchOpponent = async () => {
      try {
        const { data } = await getJobById(job_id);
        const job = data.data;
        const opponentId = isWorker ? job.seeker_id : job.worker_id;

        if (opponentId) {
          setForm(f => ({ ...f, against_user: opponentId }));
        } else {
          setError('Could not determine the other user in this job.');
        }
      } catch (e) {
        setError(extractError(e));
      } finally {
        setLoading(false);
      }
    };

    fetchOpponent();
  }, [job_id, against_user_id, user, isWorker]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.job_id) { setError('Job ID is required'); return; }
    if (!form.against_user) { setError('Against User ID is required'); return; }
    if (!form.reason || form.reason.length < 10) { setError('Reason must be at least 10 characters'); return; }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('job_id',       form.job_id);
      fd.append('against_user', form.against_user);
      fd.append('reason',       form.reason);
      fd.append('description',  form.description);
      // Temporarily disable file uploads to prevent a backend database error.
      files.forEach((f) => fd.append('evidence', f));

      await createDispute(fd);
      addToast('⚖️ Dispute raised!', 'success');
      navigate('/disputes');
    } catch (e) {
      setError(extractError(e));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div style={{ maxWidth:540, margin:'0 auto' }}>
      <h2 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>⚖️ Raise a Dispute</h2>
      {job_title && <p style={{ color:'#6b7280', marginBottom:20, fontSize:14 }}>For job: <strong>{job_title}</strong></p>}

      {error && <div style={{ background:'#fee2e2', borderRadius:8, padding:'10px 14px', marginBottom:16, color:'#dc2626', fontSize:14 }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ background:'#fff', borderRadius:12, padding:24, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
        {[
          ['job_id',       'Job ID *',        'number'],
          ['against_user', 'Against User ID *','number'],
        ].map(([name, label, type]) => (
          <div key={name} style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, marginBottom:4 }}>{label}</label>
            <input name={name} type={type} value={form[name]} onChange={handleChange}
              readOnly
              style={{
                width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db',
                fontSize:14, boxSizing:'border-box', background: '#f3f4f6', cursor: 'not-allowed'
              }} />
          </div>
        ))}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:500, marginBottom:4 }}>Reason *</label>
          <input name="reason" value={form.reason} onChange={handleChange} placeholder="Brief reason (min 10 chars)"
            style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, boxSizing:'border-box' }} />
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:500, marginBottom:4 }}>Description (optional)</label>
          <textarea name="description" value={form.description} onChange={handleChange} rows={4}
            placeholder="Provide detailed explanation of the issue…"
            style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, boxSizing:'border-box', resize:'vertical' }} />
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:500, marginBottom:4 }}>Evidence Photos (optional)</label>
          <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files))} />
        </div>
        <button type="submit" disabled={loading}
          style={{
            width:'100%', padding:'12px', borderRadius:8,
            background: loading ? '#9ca3af' : '#f97316', color:'#fff',
            border:'none', cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight:600
          }}>
          {loading ? 'Submitting…' : 'Submit Dispute'}
        </button>
      </form>
    </div>
  );
};

export default CreateDisputePage;