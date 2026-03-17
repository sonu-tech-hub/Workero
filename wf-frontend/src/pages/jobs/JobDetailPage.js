/**
 * JobDetailPage.js
 * Full job lifecycle management:
 * - Job info with status badge
 * - Applications list with AI ranking (for seeker)
 * - Accept/reject application logic
 * - Status transitions: open→assigned→in_progress→completed
 * - Cancel job
 * - Payment flow (create Razorpay order → verify)
 * - Post-completion two-way review trigger
 * - Dispute creation shortcut
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getJobById, getJobApplications, acceptApplication,
  updateJobStatus, cancelJob, applyForJob
} from '../../api/jobAPI';
import { createOrder, verifyPayment, getFeePreview } from '../../api/paymentAPI';
import { getJobReview } from '../../api/reviewAPI';
import Spinner from '../../components/common/Spinner';
import StarRating from '../../components/common/StarRating';
import {
  formatDate, formatCurrency, jobStatusColor, jobStatusLabel,
  calculateCommission, extractError
} from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

const JobDetailPage = () => {
  const { id }       = useParams();
  const { user, isSeeker, isWorker } = useAuth();
  const { addToast } = useNotification();
  const navigate     = useNavigate();

  const [job,          setJob]          = useState(null);
  const [applications, setApplications] = useState([]);
  const [reviews,      setReviews]      = useState([]);
  const [canReview,    setCanReview]    = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [actionLoading,setActionLoading]= useState(false);
  const [error,        setError]        = useState('');
  const [applyNote,    setApplyNote]    = useState('');
  const [applyBid,     setApplyBid]     = useState('');
  const [showApply,    setShowApply]    = useState(false);
  const [payOrder,     setPayOrder]     = useState(null);
  const [paying,       setPaying]       = useState(false);
  const [feePreview,   setFeePreview]   = useState(null);

  const load = useCallback(async () => {
    try {
      const [jRes, rRes] = await Promise.allSettled([
        getJobById(id),
        getJobReview(id),
      ]);
      if (jRes.status === 'fulfilled') {
        setJob(jRes.value.data.data);
      }
      if (rRes.status === 'fulfilled') {
        setReviews(rRes.value.data.data.reviews || []);
        setCanReview(rRes.value.data.data.can_review || false);
      }
      // Load applications only if seeker owns the job
      if (jRes.value?.data.data?.seeker_id === user?.id) {
        const aRes = await getJobApplications(id);
        setApplications(aRes.data.data?.applications || aRes.data.data || []);
      }
    } catch (e) {
      setError(extractError(e));
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  useEffect(() => { load(); }, [load]);

  // Fee preview when job budget changes
  useEffect(() => {
    if (job?.budget) {
      getFeePreview(job.budget)
        .then(({ data }) => setFeePreview(data.data))
        .catch(() => {});
    }
  }, [job?.budget]);

  // ── Apply for job ─────────────────────────────────────────
  const handleApply = async () => {
    setActionLoading(true);
    try {
      await applyForJob(id, { cover_note: applyNote, bid_amount: applyBid ? parseFloat(applyBid) : undefined });
      addToast('✅ Application submitted!', 'success');
      setShowApply(false);
      load();
    } catch (e) {
      addToast(extractError(e), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Accept application ────────────────────────────────────
  const handleAccept = async (applicationId, workerId) => {
    if (!window.confirm('Accept this worker? Other applications will be rejected.')) return;
    setActionLoading(true);
    try {
      await acceptApplication({ job_id: parseInt(id), application_id: applicationId, worker_id: workerId });
      addToast('✅ Worker accepted!', 'success');
      load();
    } catch (e) {
      addToast(extractError(e), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Status update ─────────────────────────────────────────
  const handleStatusUpdate = async (newStatus) => {
    if (!window.confirm(`Set job to "${newStatus}"?`)) return;
    setActionLoading(true);
    try {
      await updateJobStatus(id, { status: newStatus });
      addToast(`Job status updated to ${newStatus}`, 'success');
      setJob((j) => ({ ...j, status: newStatus }));
    } catch (e) {
      addToast(extractError(e), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Cancel job ────────────────────────────────────────────
  const handleCancel = async () => {
    if (!window.confirm('Cancel this job?')) return;
    setActionLoading(true);
    try {
      await cancelJob(id, { reason: 'Cancelled by user' });
      addToast('Job cancelled', 'info');
      setJob((j) => ({ ...j, status: 'cancelled' }));
    } catch (e) {
      addToast(extractError(e), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Razorpay payment ──────────────────────────────────────
  const handlePayment = async () => {
    setPaying(true);
    try {
      const { data } = await createOrder({ job_id: parseInt(id), amount: job.final_amount || job.budget });
      const order = data.data;
      setPayOrder(order);

      if (order.mock) {
        // Mock mode: simulate verification
        addToast('💳 Mock payment: simulating verification…', 'info');
        const mockPayload = {
          razorpay_order_id:   order.order_id,
          razorpay_payment_id: `pay_MOCK${Date.now()}`,
          razorpay_signature:  'mock_signature',
        };
        await verifyPayment(mockPayload);
        addToast('✅ Payment verified (mock)!', 'success');
        load();
      } else {
        // Real Razorpay checkout
        const options = {
          key:    order.key_id || process.env.REACT_APP_RAZORPAY_KEY_ID,
          amount: Math.round((job.final_amount || job.budget) * 100),
          currency: 'INR',
          order_id: order.order_id,
          name:    'WorkerFinder',
          description: `Payment for Job #${id}`,
          handler: async (response) => {
            try {
              await verifyPayment(response);
              addToast('✅ Payment successful!', 'success');
              load();
            } catch { addToast('Payment verification failed', 'error'); }
          },
          prefill: { email: user?.email },
          theme:   { color: '#6366f1' },
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (e) {
      addToast(extractError(e), 'error');
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <Spinner />;
  if (error)   return <div style={{ color:'#ef4444', padding:20 }}>{error}</div>;
  if (!job)    return null;

  const isOwner  = job.seeker_id === user?.id;
  const isAssigned = job.worker_id === user?.id;
  const statusColor = jobStatusColor(job.status);

  // Commission for display
  const commission = calculateCommission(parseFloat(job.final_amount || job.budget || 0));

  return (
    <div style={{ maxWidth:800, margin:'0 auto' }}>
      {/* Job header */}
      <div style={{ background:'#fff', borderRadius:16, padding:28, boxShadow:'0 2px 12px rgba(0,0,0,.08)', marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12, marginBottom:16 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:700, margin:'0 0 4px' }}>{job.title}</h1>
            <div style={{ fontSize:14, color:'#6b7280' }}>
              Posted {formatDate(job.created_at)} · Category: {job.category_name || 'N/A'}
            </div>
          </div>
          <span style={{
            padding:'6px 14px', borderRadius:20, fontWeight:600, fontSize:13,
            background: statusColor + '20', color: statusColor,
            border: `1px solid ${statusColor}`,
          }}>
            {jobStatusLabel(job.status)}
          </span>
        </div>

        {job.description && (
          <p style={{ fontSize:14, color:'#374151', lineHeight:1.7, margin:'0 0 16px' }}>{job.description}</p>
        )}

        <div style={{ display:'flex', flexWrap:'wrap', gap:16, fontSize:14, color:'#6b7280' }}>
          {job.budget      && <span>💰 Budget: <strong style={{ color:'#374151' }}>{formatCurrency(job.budget)}</strong></span>}
          {job.final_amount && <span>💳 Final: <strong style={{ color:'#10b981' }}>{formatCurrency(job.final_amount)}</strong></span>}
          {job.priority    && <span>🚨 Priority: <strong style={{ color:'#374151', textTransform:'capitalize' }}>{job.priority}</strong></span>}
          {job.location_text && <span>📍 {job.location_text}</span>}
          {job.deadline    && <span>📅 Deadline: {formatDate(job.deadline)}</span>}
        </div>

        {/* Fee breakdown */}
        {(isOwner || isAssigned) && commission && (
          <div style={{ marginTop:16, background:'#f9fafb', borderRadius:8, padding:'12px 14px', fontSize:13 }}>
            <div style={{ display:'flex', gap:20, flexWrap:'wrap', color:'#6b7280' }}>
              <span>Platform: {formatCurrency(commission.platform_fee)}</span>
              <span>Trust fee: {formatCurrency(commission.trust_safety_fee)}</span>
              <span>GST: {formatCurrency(commission.gst_amount)}</span>
              <span style={{ color:'#10b981', fontWeight:600 }}>Worker payout: {formatCurrency(commission.worker_payout)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ background:'#fff', borderRadius:12, padding:16, marginBottom:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)', display:'flex', flexWrap:'wrap', gap:10 }}>
        {/* Worker: Apply */}
        {isWorker && job.status === 'open' && !isAssigned && (
          <button onClick={() => setShowApply(!showApply)}
            style={{ padding:'10px 20px', background:'#6366f1', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
            📝 Apply for Job
          </button>
        )}

        {/* Worker: Start work */}
        {isAssigned && job.status === 'assigned' && (
          <button onClick={() => handleStatusUpdate('in_progress')} disabled={actionLoading}
            style={{ padding:'10px 20px', background:'#f59e0b', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
            ▶ Start Work
          </button>
        )}

        {/* Worker: Mark complete */}
        {isAssigned && job.status === 'in_progress' && (
          <button onClick={() => handleStatusUpdate('completed')} disabled={actionLoading}
            style={{ padding:'10px 20px', background:'#10b981', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
            ✅ Mark Completed
          </button>
        )}

        {/* Seeker: Mark complete */}
        {isOwner && job.status === 'in_progress' && (
          <button onClick={() => handleStatusUpdate('completed')} disabled={actionLoading}
            style={{ padding:'10px 20px', background:'#10b981', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
            ✅ Confirm Completed
          </button>
        )}

        {/* Seeker: Pay */}
        {isOwner && job.status === 'completed' && job.payment_status !== 'paid' && (
          <button onClick={handlePayment} disabled={paying}
            style={{ padding:'10px 20px', background:'#059669', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
            {paying ? '⏳ Processing…' : '💳 Pay Worker'}
          </button>
        )}

        {/* Cancel */}
        {(isOwner || isAssigned) && ['open', 'assigned'].includes(job.status) && (
          <button onClick={handleCancel} disabled={actionLoading}
            style={{ padding:'10px 20px', background:'#fee2e2', color:'#ef4444', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
            ✕ Cancel Job
          </button>
        )}

        {/* Dispute */}
        {(isOwner || isAssigned) && ['in_progress', 'completed'].includes(job.status) && (
          <Link to="/disputes/create" state={{ job_id: id, job_title: job.title }}
            style={{ padding:'10px 16px', background:'#fff7ed', color:'#ea580c', borderRadius:8, textDecoration:'none', fontWeight:500, fontSize:14, border:'1px solid #fed7aa' }}>
            ⚖️ Raise Dispute
          </Link>
        )}

        {/* Review */}
        {canReview && job.status === 'completed' && (
          <Link to="/reviews/create" state={{ job_id: id, job_title: job.title, reviewee_id: isOwner ? job.worker_id : job.seeker_id }}
            style={{ padding:'10px 16px', background:'#fef9c3', color:'#854d0e', borderRadius:8, textDecoration:'none', fontWeight:500, fontSize:14, border:'1px solid #fde047' }}>
            ⭐ Leave Review
          </Link>
        )}
      </div>

      {/* Apply panel */}
      {showApply && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:16 }}>Your Application</h3>
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, marginBottom:4 }}>Bid Amount (₹) — optional</label>
            <input type="number" value={applyBid} onChange={(e) => setApplyBid(e.target.value)}
              placeholder={`Job budget: ${formatCurrency(job.budget)}`}
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, boxSizing:'border-box' }} />
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, marginBottom:4 }}>Cover Note</label>
            <textarea value={applyNote} onChange={(e) => setApplyNote(e.target.value)} rows={3}
              placeholder="Why are you the best fit? Mention experience, availability, etc."
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, boxSizing:'border-box', resize:'vertical' }} />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={handleApply} disabled={actionLoading}
              style={{ padding:'10px 20px', background:'#6366f1', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
              {actionLoading ? 'Submitting…' : 'Submit Application'}
            </button>
            <button onClick={() => setShowApply(false)}
              style={{ padding:'10px 16px', background:'#f3f4f6', color:'#374151', border:'none', borderRadius:8, cursor:'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Applications (seeker owner only) */}
      {isOwner && applications.length > 0 && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:18 }}>👷 Applications ({applications.length})</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {applications.map((app) => (
              <div key={app.id} style={{
                padding:'14px 16px', background:'#f9fafb', borderRadius:10,
                border: app.status === 'accepted' ? '2px solid #10b981' : '1px solid #e5e7eb',
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                  <div>
                    <Link to={`/workers/${app.worker_id}`} style={{ fontWeight:600, fontSize:15, color:'#1f2937', textDecoration:'none' }}>
                      {app.worker_name || `Worker #${app.worker_id}`}
                    </Link>
                    {app.worker_rating && <span style={{ marginLeft:8 }}><StarRating rating={app.worker_rating} size={13} /></span>}
                    {app.bid_amount && <span style={{ marginLeft:8, color:'#6366f1', fontWeight:600, fontSize:14 }}>{formatCurrency(app.bid_amount)}</span>}
                    {app.ai_match_score && <span style={{ marginLeft:8, fontSize:12, color:'#8b5cf6' }}>🤖 {app.ai_match_score}%</span>}
                  </div>
                  <span style={{
                    padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:500,
                    background: app.status === 'accepted' ? '#d1fae5' : app.status === 'rejected' ? '#fee2e2' : '#f3f4f6',
                    color:      app.status === 'accepted' ? '#065f46' : app.status === 'rejected' ? '#dc2626' : '#374151',
                  }}>{app.status}</span>
                </div>
                {app.cover_note && (
                  <p style={{ margin:'8px 0 0', fontSize:13, color:'#6b7280' }}>{app.cover_note}</p>
                )}
                {app.status === 'pending' && job.status === 'open' && (
                  <button onClick={() => handleAccept(app.id, app.worker_id)} disabled={actionLoading}
                    style={{ marginTop:10, padding:'8px 16px', background:'#6366f1', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:500, fontSize:13 }}>
                    ✅ Accept
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:16 }}>⭐ Reviews for this job</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {reviews.map((r) => (
              <div key={r.id} style={{ padding:'12px 14px', background:'#f9fafb', borderRadius:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <div>
                    <strong style={{ fontSize:14 }}>Reviewer #{r.reviewer_id}</strong>
                    <div style={{ marginTop:2 }}><StarRating rating={r.rating} size={13} /></div>
                  </div>
                  <span style={{ fontSize:12, color:'#9ca3af' }}>{formatDate(r.created_at)}</span>
                </div>
                {r.review_text && <p style={{ margin:'6px 0 0', fontSize:13, color:'#374151' }}>{r.review_text}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetailPage;
