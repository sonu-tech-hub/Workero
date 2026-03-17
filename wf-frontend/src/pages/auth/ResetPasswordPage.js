import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as authAPI from '../../api/authAPI';
import { extractError } from '../../utils/helpers';

const ResetPasswordPage = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const identifier = location.state?.identifier || '';
  const otp        = location.state?.otp || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [done,        setDone]        = useState(false);

  const validate = () => {
    if (newPassword.length < 8) return 'Password must be at least 8 characters';
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) return 'Must contain uppercase, lowercase, and number';
    if (newPassword !== confirm) return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      await authAPI.resetPassword({ identifier, otp, new_password: newPassword });
      setDone(true);
    } catch (e) {
      setError(extractError(e));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={{ maxWidth:420, margin:'60px auto', padding:'0 16px' }}>
        <div style={{ background:'#fff', borderRadius:16, padding:32, textAlign:'center', boxShadow:'0 4px 24px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
          <h2>Password Reset!</h2>
          <p style={{ color:'#6b7280', marginBottom:20 }}>Your password has been updated successfully.</p>
          <button onClick={() => navigate('/login')}
            style={{ padding:'10px 24px', background:'#6366f1', color:'#fff', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer' }}>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth:420, margin:'60px auto', padding:'0 16px' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:32, boxShadow:'0 4px 24px rgba(0,0,0,.08)' }}>
        <h1 style={{ fontSize:24, fontWeight:700, marginBottom:24 }}>Reset Password</h1>
        {error && <div style={{ background:'#fee2e2', borderRadius:8, padding:'10px 14px', marginBottom:16, color:'#dc2626', fontSize:14 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          {[['newPassword', 'New Password', setNewPassword, newPassword], ['confirm', 'Confirm Password', setConfirm, confirm]].map(([id, label, setter, val]) => (
            <div key={id} style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontWeight:500, fontSize:14, marginBottom:4 }}>{label}</label>
              <input type="password" value={val} onChange={(e) => { setter(e.target.value); setError(''); }}
                style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, boxSizing:'border-box' }} />
            </div>
          ))}
          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:'12px', borderRadius:8, background: loading ? '#9ca3af' : '#6366f1', color:'#fff', border:'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight:600 }}>
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
