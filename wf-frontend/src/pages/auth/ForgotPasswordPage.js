import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authAPI from '../../api/authAPI';
import { extractError } from '../../utils/helpers';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [sent, setSent]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) { setError('Email or mobile is required'); return; }
    setLoading(true);
    try {
      await authAPI.forgotPassword({ identifier: identifier.trim() });
      setSent(true);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div style={{ maxWidth:420, margin:'60px auto', padding:'0 16px' }}>
        <div style={{ background:'#fff', borderRadius:16, padding:32, textAlign:'center', boxShadow:'0 4px 24px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📧</div>
          <h2 style={{ color:'#1f2937', marginBottom:8 }}>OTP Sent</h2>
          <p style={{ color:'#6b7280', marginBottom:20 }}>
            If an account exists for <strong>{identifier}</strong>, an OTP has been sent.
          </p>
          <button
            onClick={() => navigate('/otp', { state: { identifier, type: 'reset' } })}
            style={{ padding:'10px 24px', background:'#6366f1', color:'#fff', border:'none', borderRadius:8, fontWeight:600, cursor:'pointer' }}
          >
            Enter OTP
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth:420, margin:'60px auto', padding:'0 16px' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:32, boxShadow:'0 4px 24px rgba(0,0,0,.08)' }}>
        <h1 style={{ fontSize:24, fontWeight:700, marginBottom:4 }}>Forgot Password</h1>
        <p style={{ color:'#6b7280', marginBottom:24, fontSize:14 }}>Enter your email or mobile to receive an OTP</p>
        {error && <div style={{ background:'#fee2e2', borderRadius:8, padding:'10px 14px', marginBottom:16, color:'#dc2626', fontSize:14 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <input
            type="text" value={identifier} onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
            placeholder="Email or mobile number"
            style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, boxSizing:'border-box', marginBottom:16 }}
          />
          <button
            type="submit" disabled={loading}
            style={{ width:'100%', padding:'12px', borderRadius:8, background: loading ? '#9ca3af' : '#6366f1', color:'#fff', border:'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight:600 }}
          >
            {loading ? 'Sending…' : 'Send OTP'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
