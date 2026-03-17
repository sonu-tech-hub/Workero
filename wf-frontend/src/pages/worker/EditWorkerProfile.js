/**
 * EditWorkerProfile.js
 * Full worker profile editor:
 * - Personal info, profession, bio, experience, hourly rate
 * - Location (manual + GPS auto-fill)
 * - Skills array (add/remove chips)
 * - Certifications array
 * - Languages array
 * - Profile photo upload (preview + Cloudinary)
 * - Verification document upload
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWorkerStats, updateWorkerProfile, uploadWorkerPhoto, uploadVerificationProof } from '../../api/workerAPI';
import useGeolocation from '../../hooks/useGeolocation';
import Spinner from '../../components/common/Spinner';
import { parseJSON, extractError } from '../../utils/helpers';
import { useNotification } from '../../context/NotificationContext';

const EditWorkerProfile = () => {
  const navigate  = useNavigate();
  const { addToast } = useNotification();
  const { getLocation, loading: geoLoading, error: geoError } = useGeolocation();

  const [form, setForm] = useState({
    full_name:'', bio:'', profession:'', experience_years:'',
    hourly_rate:'', city:'', state:'', address:'',
    latitude:'', longitude:'', service_radius:25, is_available:true,
    skills:[], certifications:[], languages:[]
  });
  const [skillInput, setSkillInput]   = useState('');
  const [certInput,  setCertInput]    = useState('');
  const [langInput,  setLangInput]    = useState('');
  const [loading, setLoading]         = useState(true);
  const [saving,  setSaving]          = useState(false);
  const [photoFile, setPhotoFile]     = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [docFile, setDocFile]         = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc,   setUploadingDoc]   = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getWorkerStats();
        const p = data.data.profile;
        setForm({
          full_name:        p.full_name || '',
          bio:              p.bio || '',
          profession:       p.profession || '',
          experience_years: p.experience_years || '',
          hourly_rate:      p.hourly_rate || '',
          city:             p.city || '',
          state:            p.state || '',
          address:          p.address || '',
          latitude:         p.latitude || '',
          longitude:        p.longitude || '',
          service_radius:   p.service_radius || 25,
          is_available:     !!p.is_available,
          skills:           parseJSON(p.skills, []),
          certifications:   parseJSON(p.certifications, []),
          languages:        parseJSON(p.languages, []),
        });
        if (p.profile_photo_url) setPhotoPreview(p.profile_photo_url);
      } catch (e) {
        setError(extractError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  // ── GPS location ──────────────────────────────────────────
  const handleGPS = async () => {
    try {
      const { latitude, longitude } = await getLocation();
      setForm((f) => ({ ...f, latitude, longitude }));
      addToast('📍 Location detected', 'success');
    } catch (e) {
      addToast(geoError || 'Could not get location', 'error');
    }
  };

  // ── Array helpers ─────────────────────────────────────────
  const addChip  = (field, val, setter) => {
    const v = val.trim();
    if (v && !form[field].includes(v)) {
      setForm((f) => ({ ...f, [field]: [...f[field], v] }));
    }
    setter('');
  };
  const removeChip = (field, v) =>
    setForm((f) => ({ ...f, [field]: f[field].filter((x) => x !== v) }));

  // ── Photo upload ──────────────────────────────────────────
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handlePhotoUpload = async () => {
    if (!photoFile) return;
    setUploadingPhoto(true);
    const fd = new FormData();
    fd.append('photo', photoFile);
    try {
      await uploadWorkerPhoto(fd);
      addToast('📸 Photo uploaded!', 'success');
      setPhotoFile(null);
    } catch (e) {
      addToast(extractError(e), 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── Document upload ───────────────────────────────────────
  const handleDocUpload = async () => {
    if (!docFile) return;
    setUploadingDoc(true);
    const fd = new FormData();
    fd.append('document', docFile);
    try {
      await uploadVerificationProof(fd);
      addToast('📄 Document uploaded for verification!', 'success');
      setDocFile(null);
    } catch (e) {
      addToast(extractError(e), 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  // ── Save profile ──────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateWorkerProfile({
        ...form,
        skills:         JSON.stringify(form.skills),
        certifications: JSON.stringify(form.certifications),
        languages:      JSON.stringify(form.languages),
      });
      addToast('✅ Profile saved!', 'success');
      navigate('/dashboard');
    } catch (e) {
      addToast(extractError(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  const input = (name, label, type = 'text', extra = {}) => (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:'block', fontSize:13, fontWeight:500, marginBottom:4, color:'#374151' }}>{label}</label>
      <input
        name={name} type={type} value={form[name]}
        onChange={handleChange} {...extra}
        style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, boxSizing:'border-box' }}
      />
    </div>
  );

  const ChipInput = ({ field, value, setter, placeholder }) => (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:8 }}>
        <input
          value={value} onChange={(e) => setter(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChip(field, value, setter); } }}
          placeholder={placeholder}
          style={{ flex:1, padding:'8px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14 }}
        />
        <button type="button" onClick={() => addChip(field, value, setter)}
          style={{ padding:'8px 14px', background:'#6366f1', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13 }}>
          + Add
        </button>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {form[field].map((v) => (
          <span key={v} style={{ padding:'3px 10px', background:'#eef2ff', color:'#6366f1', borderRadius:20, fontSize:13, cursor:'pointer' }}
            onClick={() => removeChip(field, v)}>
            {v} ✕
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:700, margin:'0 auto' }}>
      <h2 style={{ fontSize:22, fontWeight:700, marginBottom:24 }}>✏️ Edit Worker Profile</h2>
      {error && <div style={{ background:'#fee2e2', padding:12, borderRadius:8, color:'#dc2626', marginBottom:16 }}>{error}</div>}

      <form onSubmit={handleSave}>
        {/* Photo */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:16 }}>Profile Photo</h3>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', background:'#e5e7eb', flexShrink:0 }}>
              {photoPreview
                ? <img src={photoPreview} alt="Preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32 }}>👤</div>
              }
            </div>
            <div>
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display:'none' }} id="photo-input" />
              <label htmlFor="photo-input" style={{ padding:'8px 16px', background:'#f3f4f6', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:500 }}>Choose Photo</label>
              {photoFile && (
                <button type="button" onClick={handlePhotoUpload} disabled={uploadingPhoto}
                  style={{ marginLeft:8, padding:'8px 16px', background:'#6366f1', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13 }}>
                  {uploadingPhoto ? 'Uploading…' : 'Upload'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Basic info */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:16 }}>Basic Information</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0 }}>
            {input('full_name',        'Full Name')}
            {input('profession',       'Profession / Trade')}
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, marginBottom:4 }}>Bio</label>
            <textarea name="bio" value={form.bio} onChange={handleChange} rows={3}
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, boxSizing:'border-box', resize:'vertical' }} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {input('experience_years', 'Experience (years)', 'number')}
            {input('hourly_rate',      'Hourly Rate (₹)',    'number')}
          </div>
          <div style={{ marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
            <input type="checkbox" name="is_available" checked={form.is_available} onChange={handleChange} id="avail" />
            <label htmlFor="avail" style={{ fontSize:14, fontWeight:500, color:'#374151' }}>Currently Available for Work</label>
          </div>
        </div>

        {/* Location */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ margin:0, fontSize:16 }}>📍 Location</h3>
            <button type="button" onClick={handleGPS} disabled={geoLoading}
              style={{ padding:'6px 14px', background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:500 }}>
              {geoLoading ? '…' : '📡 Auto-detect'}
            </button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {input('city',      'City')}
            {input('state',     'State')}
            {input('latitude',  'Latitude',  'number')}
            {input('longitude', 'Longitude', 'number')}
            {input('service_radius', 'Service Radius (km)', 'number')}
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, marginBottom:4 }}>Full Address</label>
            <textarea name="address" value={form.address} onChange={handleChange} rows={2}
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, boxSizing:'border-box' }} />
          </div>
        </div>

        {/* Skills */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:16 }}>🛠 Skills</h3>
          <ChipInput field="skills" value={skillInput} setter={setSkillInput} placeholder="e.g. Plumbing, AC Repair" />
        </div>

        {/* Certifications */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:16 }}>🎓 Certifications</h3>
          <ChipInput field="certifications" value={certInput} setter={setCertInput} placeholder="e.g. ITI Electrical, ISO Cert" />
        </div>

        {/* Languages */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:16 }}>🗣 Languages</h3>
          <ChipInput field="languages" value={langInput} setter={setLangInput} placeholder="e.g. Hindi, English" />
        </div>

        {/* Verification document */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:24, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 8px', fontSize:16 }}>📄 Verification Document</h3>
          <p style={{ fontSize:13, color:'#6b7280', marginBottom:10 }}>Upload ID / certification for verification badge</p>
          <div style={{ display:'flex', gap:8 }}>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setDocFile(e.target.files[0])} />
            {docFile && (
              <button type="button" onClick={handleDocUpload} disabled={uploadingDoc}
                style={{ padding:'8px 14px', background:'#10b981', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13 }}>
                {uploadingDoc ? 'Uploading…' : 'Upload Doc'}
              </button>
            )}
          </div>
        </div>

        <div style={{ display:'flex', gap:12 }}>
          <button type="submit" disabled={saving}
            style={{ flex:1, padding:'12px', borderRadius:8, background: saving ? '#9ca3af' : '#6366f1', color:'#fff', border:'none', cursor: saving ? 'not-allowed' : 'pointer', fontWeight:600, fontSize:15 }}>
            {saving ? 'Saving…' : '💾 Save Profile'}
          </button>
          <button type="button" onClick={() => navigate('/dashboard')}
            style={{ padding:'12px 20px', borderRadius:8, background:'#f3f4f6', color:'#374151', border:'none', cursor:'pointer', fontWeight:500 }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditWorkerProfile;
