import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { extractError } from '../../utils/helpers';

const ChangePasswordPage = () => {
  const { changePassword } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]     = useState({ current_password:'', new_password:'', confirm:'' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    if (!form.current_password) return 'Current password is required';
    if (form.new_password.length < 8) return 'New password must be at least 8 characters';
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.new_password)) return 'Must have uppercase, lowercase, and number';
    if (form.new_password !== form.confirm) return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      await changePassword(form.current_password, form.new_password);
      setSuccess(true);
    } catch (e) {
      setError(extractError(e));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ maxWidth:420, margin:'60px auto', padding:'0 16px' }}>
        <div style={{ background:'#fff', borderRadius:16, padding:32, textAlign:'center', boxShadow:'0 4px 24px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
          <h2>Password Changed!</h2>
          <p style={{ color:'#6b7280', marginBottom:20 }}>Your password has been updated.</p>
          <button onClick={() => navigate('/dashboard')}
            style={{ padding:'10px 24px', background:'#6366f1', color:'#fff', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer' }}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const fieldDef = [
    ['current_password', 'Current Password'],
    ['new_password',     'New Password'],
    ['confirm',          'Confirm New Password'],
  ];

  return (
    <div style={{ maxWidth:420, margin:'40px auto', padding:'0 16px' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:32, boxShadow:'0 4px 24px rgba(0,0,0,.08)' }}>
        <h1 style={{ fontSize:22, fontWeight:700, marginBottom:24 }}>Change Password</h1>
        {error && <div style={{ background:'#fee2e2', borderRadius:8, padding:'10px 14px', marginBottom:16, color:'#dc2626', fontSize:14 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          {fieldDef.map(([name, label]) => (
            <div key={name} style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontWeight:500, fontSize:14, marginBottom:4 }}>{label}</label>
              <input
                type="password" value={form[name]}
                onChange={(e) => { setForm((f) => ({ ...f, [name]: e.target.value })); setError(''); }}
                style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, boxSizing:'border-box' }}
              />
            </div>
          ))}
          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:'12px', borderRadius:8, background: loading ? '#9ca3af' : '#6366f1', color:'#fff', border:'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight:600 }}>
            {loading ? 'Changing…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
