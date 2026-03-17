/**
 * WorkerProfilePage.js
 * Public worker profile:
 * - Profile info, stats, skills, certifications
 * - AI performance badge + insights
 * - Reviews with rating breakdown
 * - "Message" and "Hire" (create job with worker pre-selected) CTAs
 */
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getWorkerProfile } from '../../api/workerAPI';
import { getUserReviews, markReviewHelpful } from '../../api/reviewAPI';
import Spinner from '../../components/common/Spinner';
import StarRating from '../../components/common/StarRating';
import { formatDate, formatCurrency, parseJSON, tierColor, extractError } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

const WorkerProfilePage = () => {
  const { workerId } = useParams();
  const { user, isSeeker } = useAuth();
  const navigate = useNavigate();

  const [worker,  setWorker]  = useState(null);
  const [reviews, setReviews] = useState([]);
  const [revStats, setRevStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [wRes, rRes] = await Promise.all([
          getWorkerProfile(workerId),
          getUserReviews(workerId)
        ]);
        setWorker(wRes.data.data);
        setReviews(rRes.data.data.reviews);
        setRevStats(rRes.data.data.stats);
      } catch (e) {
        setError(extractError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [workerId]);

  const handleHelpful = async (reviewId) => {
    try {
      await markReviewHelpful(reviewId);
      setReviews((r) => r.map((rv) => rv.id === reviewId ? { ...rv, helpful_count: (rv.helpful_count || 0) + 1 } : rv));
    } catch {}
  };

  if (loading) return <Spinner />;
  if (error)   return <div style={{ color:'#ef4444', padding:20 }}>{error}</div>;
  if (!worker) return null;

  const skills = parseJSON(worker.skills, []);
  const certs  = parseJSON(worker.certifications, []);
  const langs  = parseJSON(worker.languages, []);
  const perf   = worker.ai_performance || {};

  const ratingBar = (label, count, total) => (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
      <span style={{ width:50, fontSize:12, color:'#6b7280' }}>{label}</span>
      <div style={{ flex:1, background:'#f3f4f6', borderRadius:4, height:8, overflow:'hidden' }}>
        <div style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%', background:'#f59e0b', height:'100%', borderRadius:4 }} />
      </div>
      <span style={{ width:24, fontSize:12, color:'#9ca3af', textAlign:'right' }}>{count}</span>
    </div>
  );

  return (
    <div style={{ maxWidth:800, margin:'0 auto' }}>
      {/* Hero */}
      <div style={{ background:'#fff', borderRadius:16, padding:28, boxShadow:'0 2px 12px rgba(0,0,0,.08)', marginBottom:20 }}>
        <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
          <div style={{ width:88, height:88, borderRadius:'50%', background:'#e5e7eb', overflow:'hidden', flexShrink:0 }}>
            {worker.profile_photo_url
              ? <img src={worker.profile_photo_url} alt={worker.full_name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36 }}>👤</div>
            }
          </div>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <h1 style={{ fontSize:22, fontWeight:700, margin:0 }}>{worker.full_name}</h1>
              {worker.is_verified && <span style={{ background:'#d1fae5', color:'#065f46', fontSize:12, padding:'2px 10px', borderRadius:20, fontWeight:600 }}>✅ Verified</span>}
              {worker.is_available && <span style={{ background:'#d1fae5', color:'#065f46', fontSize:12, padding:'2px 10px', borderRadius:20 }}>🟢 Available</span>}
              {perf.tier && <span style={{ background:'#f3f4f6', color: tierColor(perf.tier), fontSize:12, padding:'2px 10px', borderRadius:20, fontWeight:600 }}>🏅 {perf.tier}</span>}
            </div>
            <p style={{ color:'#6b7280', margin:'4px 0 8px', fontSize:14 }}>{worker.profession}</p>
            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', fontSize:14, color:'#6b7280' }}>
              <span><StarRating rating={worker.average_rating} size={15} /> {parseFloat(worker.average_rating || 0).toFixed(1)}</span>
              <span>💼 {worker.total_jobs_completed || 0} jobs done</span>
              <span>📍 {worker.city || 'N/A'}</span>
              {worker.hourly_rate && <span style={{ color:'#6366f1', fontWeight:600 }}>{formatCurrency(worker.hourly_rate)}/hr</span>}
            </div>
          </div>
        </div>

        {worker.bio && <p style={{ marginTop:16, fontSize:14, color:'#374151', lineHeight:1.6 }}>{worker.bio}</p>}

        {/* Action buttons */}
        <div style={{ display:'flex', gap:10, marginTop:16, flexWrap:'wrap' }}>
          {user && isSeeker && (
            <>
              <button
                onClick={() => navigate('/jobs/create', { state: { direct_worker_id: worker.user_id, worker_name: worker.full_name } })}
                style={{ padding:'10px 20px', background:'#6366f1', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600, fontSize:14 }}>
                💼 Hire This Worker
              </button>
              <Link to={`/messages?with=${worker.user_id}`} style={{ padding:'10px 20px', background:'#f3f4f6', color:'#374151', borderRadius:8, textDecoration:'none', fontWeight:500, fontSize:14 }}>
                💬 Message
              </Link>
            </>
          )}
          {!user && (
            <Link to="/login" style={{ padding:'10px 20px', background:'#6366f1', color:'#fff', borderRadius:8, textDecoration:'none', fontWeight:600 }}>
              Login to Hire
            </Link>
          )}
        </div>
      </div>

      {/* AI badges + insights */}
      {perf.badges?.length > 0 && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:16 }}>🏆 Achievements</h3>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {perf.badges.map((b, i) => <span key={i} style={{ padding:'4px 12px', background:'#eef2ff', color:'#6366f1', borderRadius:20, fontSize:13 }}>{b}</span>)}
          </div>
          {perf.completion_rate !== undefined && (
            <p style={{ margin:'10px 0 0', fontSize:13, color:'#6b7280' }}>
              Completion rate: <strong>{perf.completion_rate}%</strong> · Grade: <strong>{perf.performance_grade}</strong>
            </p>
          )}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:12, marginBottom:20 }}>
        {[
          ['Experience', `${worker.experience_years || 0} yrs`],
          ['Jobs Done',  worker.total_jobs_completed || 0],
          ['Avg Rating', parseFloat(worker.average_rating || 0).toFixed(1)],
          ['Member Since', formatDate(worker.member_since)],
        ].map(([l, v]) => (
          <div key={l} style={{ background:'#fff', borderRadius:10, padding:16, textAlign:'center', boxShadow:'0 2px 6px rgba(0,0,0,.05)' }}>
            <div style={{ fontWeight:700, fontSize:18, color:'#1f2937' }}>{v}</div>
            <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Skills / Certs / Languages */}
      {[['🛠 Skills', skills], ['🎓 Certifications', certs], ['🗣 Languages', langs]].map(([title, arr]) =>
        arr.length > 0 && (
          <div key={title} style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
            <h3 style={{ margin:'0 0 10px', fontSize:16 }}>{title}</h3>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {arr.map((v) => (
                <span key={v} style={{ padding:'4px 12px', background:'#f3f4f6', borderRadius:20, fontSize:13, color:'#374151' }}>{v}</span>
              ))}
            </div>
          </div>
        )
      )}

      {/* Reviews */}
      <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
        <h3 style={{ margin:'0 0 16px', fontSize:18 }}>⭐ Reviews ({revStats?.total || 0})</h3>
        {revStats && (
          <div style={{ display:'flex', gap:24, flexWrap:'wrap', marginBottom:20 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:40, fontWeight:700, color:'#1f2937' }}>{revStats.average_rating}</div>
              <StarRating rating={revStats.average_rating} size={20} />
            </div>
            <div style={{ flex:1, minWidth:160 }}>
              {[['5 ⭐', revStats.rating_breakdown?.five_star], ['4 ⭐', revStats.rating_breakdown?.four_star], ['3 ⭐', revStats.rating_breakdown?.three_star], ['2 ⭐', revStats.rating_breakdown?.two_star], ['1 ⭐', revStats.rating_breakdown?.one_star]].map(([l, c]) =>
                ratingBar(l, c || 0, revStats.total)
              )}
            </div>
          </div>
        )}
        {reviews.length === 0 && <p style={{ color:'#9ca3af', textAlign:'center' }}>No reviews yet</p>}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {reviews.map((r) => (
            <div key={r.id} style={{ padding:'14px 16px', background:'#f9fafb', borderRadius:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <strong style={{ fontSize:14 }}>{r.reviewer_name || 'User'}</strong>
                  <div style={{ marginTop:2 }}><StarRating rating={r.rating} size={13} /></div>
                </div>
                <span style={{ fontSize:12, color:'#9ca3af' }}>{formatDate(r.created_at)}</span>
              </div>
              {r.review_text && <p style={{ margin:'8px 0 0', fontSize:13, color:'#374151' }}>{r.review_text}</p>}
              {(r.punctuality_rating || r.quality_rating || r.behavior_rating) && (
                <div style={{ display:'flex', gap:16, marginTop:6, fontSize:12, color:'#6b7280' }}>
                  {r.punctuality_rating && <span>Punctuality: {r.punctuality_rating}/5</span>}
                  {r.quality_rating    && <span>Quality: {r.quality_rating}/5</span>}
                  {r.behavior_rating   && <span>Behavior: {r.behavior_rating}/5</span>}
                </div>
              )}
              <button
                onClick={() => handleHelpful(r.id)}
                style={{ marginTop:8, background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#6b7280' }}>
                👍 Helpful ({r.helpful_count || 0})
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkerProfilePage;
