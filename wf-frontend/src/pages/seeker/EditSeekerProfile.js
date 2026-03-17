import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSeekerStats, updateSeekerProfile, uploadSeekerPhoto } from '../../api/seekerAPI';
import useGeolocation from '../../hooks/useGeolocation';
import Spinner from '../../components/common/Spinner';
import { parseJSON, extractError } from '../../utils/helpers';
import { useNotification } from '../../context/NotificationContext';

const EditSeekerProfile = () => {
  const navigate = useNavigate();
  const { addToast } = useNotification();
  const { getLocation, loading: geoLoading } = useGeolocation();

  const [form, setForm] = useState({ full_name:'', bio:'', city:'', state:'', address:'', latitude:'', longitude:'', preferred_categories:[] });
  const [catInput, setCatInput] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getSeekerStats();
        const p = data.data.profile;
        setForm({
          full_name: p.full_name || '', bio: p.bio || '',
          city: p.city || '', state: p.state || '',
          address: p.address || '',
          latitude: p.latitude || '', longitude: p.longitude || '',
          preferred_categories: parseJSON(p.preferred_categories, []),
        });
        if (p.profile_photo_url) setPhotoPreview(p.profile_photo_url);
      } catch (e) {
        addToast(extractError(e), 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleGPS = async () => {
    try {
      const { latitude, longitude } = await getLocation();
      setForm((f) => ({ ...f, latitude, longitude }));
      addToast('📍 Location set', 'success');
    } catch { addToast('Could not detect location', 'error'); }
  };

  const addCat = () => {
    const v = catInput.trim();
    if (v && !form.preferred_categories.includes(v)) {
      setForm((f) => ({ ...f, preferred_categories: [...f.preferred_categories, v] }));
    }
    setCatInput('');
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handlePhotoUpload = async () => {
    if (!photoFile) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('photo', photoFile);
    try {
      await uploadSeekerPhoto(fd);
      addToast('📸 Photo uploaded!', 'success');
      setPhotoFile(null);
    } catch (e) { addToast(extractError(e), 'error'); }
    finally { setUploading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSeekerProfile({ ...form, preferred_categories: JSON.stringify(form.preferred_categories) });
      addToast('✅ Profile saved!', 'success');
      navigate('/dashboard');
    } catch (e) { addToast(extractError(e), 'error'); }
    finally { setSaving(false); }
  };

  if (loading) return <Spinner />;

  const inp = (name, label, type = 'text') => (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:13, fontWeight:500, marginBottom:4 }}>{label}</label>
      <input name={name} type={type} value={form[name]} onChange={handleChange}
        style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, boxSizing:'border-box' }} />
    </div>
  );

  return (
    <div style={{ maxWidth:600, margin:'0 auto' }}>
      <h2 style={{ fontSize:22, fontWeight:700, marginBottom:24 }}>✏️ Edit Seeker Profile</h2>
      <form onSubmit={handleSave}>
        {/* Photo */}
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:16 }}>Profile Photo</h3>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:72, height:72, borderRadius:'50%', background:'#e5e7eb', overflow:'hidden' }}>
              {photoPreview ? <img src={photoPreview} alt="Preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28 }}>👤</div>}
            </div>
            <div>
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display:'none' }} id="sp-photo" />
              <label htmlFor="sp-photo" style={{ padding:'7px 14px', background:'#f3f4f6', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:500 }}>Choose</label>
              {photoFile && <button type="button" onClick={handlePhotoUpload} disabled={uploading} style={{ marginLeft:8, padding:'7px 14px', background:'#6366f1', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:13 }}>{uploading ? '…' : 'Upload'}</button>}
            </div>
          </div>
        </div>

        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:16 }}>Basic Info</h3>
          {inp('full_name', 'Full Name')}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:500, marginBottom:4 }}>Bio</label>
            <textarea name="bio" value={form.bio} onChange={handleChange} rows={3}
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, boxSizing:'border-box', resize:'vertical' }} />
          </div>
        </div>

        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ margin:0, fontSize:16 }}>📍 Location</h3>
            <button type="button" onClick={handleGPS} disabled={geoLoading} style={{ padding:'6px 12px', background:'#eef2ff', color:'#6366f1', border:'none', borderRadius:8, cursor:'pointer', fontSize:13 }}>
              {geoLoading ? '…' : '📡 Auto'}
            </button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {inp('city',  'City')}
            {inp('state', 'State')}
            {inp('latitude',  'Latitude',  'number')}
            {inp('longitude', 'Longitude', 'number')}
          </div>
        </div>

        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:24, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:16 }}>🏷 Preferred Categories</h3>
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <input value={catInput} onChange={(e) => setCatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } }}
              placeholder="e.g. Plumbing, Electrical"
              style={{ flex:1, padding:'8px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14 }} />
            <button type="button" onClick={addCat} style={{ padding:'8px 14px', background:'#6366f1', color:'#fff', border:'none', borderRadius:8, cursor:'pointer' }}>+</button>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {form.preferred_categories.map((c) => (
              <span key={c} style={{ padding:'3px 10px', background:'#e0f2fe', color:'#0369a1', borderRadius:20, fontSize:13, cursor:'pointer' }}
                onClick={() => setForm((f) => ({ ...f, preferred_categories: f.preferred_categories.filter((x) => x !== c) }))}>
                {c} ✕
              </span>
            ))}
          </div>
        </div>

        <div style={{ display:'flex', gap:12 }}>
          <button type="submit" disabled={saving}
            style={{ flex:1, padding:'12px', borderRadius:8, background: saving ? '#9ca3af' : '#6366f1', color:'#fff', border:'none', cursor: saving ? 'not-allowed' : 'pointer', fontWeight:600 }}>
            {saving ? 'Saving…' : '💾 Save'}
          </button>
          <button type="button" onClick={() => navigate('/dashboard')}
            style={{ padding:'12px 20px', borderRadius:8, background:'#f3f4f6', color:'#374151', border:'none', cursor:'pointer' }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditSeekerProfile;
