/**
 * CreateReviewPage.js
 * Two-way post-job review:
 * - Overall rating (star selector)
 * - Sub-ratings: punctuality, quality, behavior
 * - Review text
 * - Photo upload (up to 5)
 * - Pre-filled from navigation state (job_id, reviewee_id)
 */
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createReview } from '../../api/reviewAPI';
import StarRating from '../../components/common/StarRating';
import { extractError } from '../../utils/helpers';
import { useNotification } from '../../context/NotificationContext';

const CreateReviewPage = () => {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { addToast } = useNotification();

  const { job_id, job_title, reviewee_id } = location.state || {};

  const [rating,      setRating]      = useState(5);
  const [punctuality, setPunctuality] = useState(5);
  const [quality,     setQuality]     = useState(5);
  const [behavior,    setBehavior]    = useState(5);
  const [text,        setText]        = useState('');
  const [photos,      setPhotos]      = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  if (!job_id || !reviewee_id) {
    return (
      <div style={{ textAlign:'center', padding:40 }}>
        <div style={{ fontSize:48 }}>⚠️</div>
        <p>Invalid review link. Please go back to the job.</p>
      </div>
    );
  }

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 5);
    setPhotos(files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating < 1) { setError('Please select a rating'); return; }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('job_id',             job_id);
      fd.append('reviewee_id',        reviewee_id);
      fd.append('rating',             rating);
      fd.append('review_text',        text);
      fd.append('punctuality_rating', punctuality);
      fd.append('quality_rating',     quality);
      fd.append('behavior_rating',    behavior);
      photos.forEach((f) => fd.append('photos', f));

      await createReview(fd);
      addToast('⭐ Review submitted!', 'success');
      navigate(`/jobs/${job_id}`);
    } catch (e) {
      setError(extractError(e));
    } finally {
      setLoading(false);
    }
  };

  const SubRating = ({ label, value, setter }) => (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <label style={{ fontSize:13, fontWeight:500 }}>{label}</label>
        <StarRating rating={value} max={5} size={20} interactive onChange={setter} />
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:540, margin:'0 auto' }}>
      <h2 style={{ fontSize:22, fontWeight:700, marginBottom:4 }}>⭐ Leave a Review</h2>
      {job_title && <p style={{ color:'#6b7280', marginBottom:20, fontSize:14 }}>For: <strong>{job_title}</strong></p>}

      {error && <div style={{ background:'#fee2e2', borderRadius:8, padding:'10px 14px', marginBottom:16, color:'#dc2626', fontSize:14 }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ background:'#fff', borderRadius:12, padding:24, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          {/* Overall rating */}
          <div style={{ marginBottom:20, textAlign:'center' }}>
            <div style={{ fontSize:14, fontWeight:500, marginBottom:8 }}>Overall Rating *</div>
            <StarRating rating={rating} max={5} size={36} interactive onChange={setRating} />
            <div style={{ fontSize:13, color:'#9ca3af', marginTop:4 }}>
              {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
            </div>
          </div>

          {/* Sub-ratings */}
          <SubRating label="Punctuality"    value={punctuality} setter={setPunctuality} />
          <SubRating label="Work Quality"   value={quality}     setter={setQuality} />
          <SubRating label="Communication"  value={behavior}    setter={setBehavior} />

          {/* Text */}
          <div style={{ marginTop:16 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, marginBottom:4 }}>Review (optional)</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
              placeholder="Share your experience…"
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, boxSizing:'border-box', resize:'vertical' }} />
          </div>

          {/* Photos */}
          <div style={{ marginTop:12 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, marginBottom:4 }}>Photos (optional, up to 5)</label>
            <input type="file" accept="image/*" multiple onChange={handlePhotoChange} />
            {photos.length > 0 && (
              <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
                {photos.map((f, i) => (
                  <div key={i} style={{ width:60, height:60, borderRadius:8, overflow:'hidden', background:'#e5e7eb' }}>
                    <img src={URL.createObjectURL(f)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="submit" disabled={loading}
            style={{ width:'100%', marginTop:20, padding:'12px', borderRadius:8, background: loading ? '#9ca3af' : '#6366f1', color:'#fff', border:'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight:600, fontSize:15 }}>
            {loading ? 'Submitting…' : 'Submit Review'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateReviewPage;
