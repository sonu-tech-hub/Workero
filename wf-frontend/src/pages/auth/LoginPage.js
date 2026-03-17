/**
 * LoginPage.js
 * Logic:
 * - Identifier can be email OR mobile
 * - Shows server error for locked account / wrong credentials
 * - Redirects to previous page (from ProtectedRoute) or /dashboard
 */
import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { extractError } from '../../utils/helpers';

const LoginPage = () => {
  const { loginUser } = useAuth();
  const navigate      = useNavigate();
  const location      = useLocation();
  const from          = location.state?.from?.pathname || '/dashboard';

  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim()) { setError('Email or mobile is required'); return; }
    if (!password)           { setError('Password is required'); return; }

    setLoading(true);
    try {
      const loggedInUser = await loginUser(identifier.trim(), password);
      const roleHome = loggedInUser?.user_type === 'admin' ? '/admin' : '/dashboard';
      const target = from === '/dashboard' ? roleHome : from;
      navigate(target, { replace: true });
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth:420, margin:'60px auto', padding:'0 16px' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:32, boxShadow:'0 4px 24px rgba(0,0,0,.08)' }}>
        <h1 style={{ fontSize:24, fontWeight:700, color:'#1f2937', marginBottom:4 }}>Welcome back</h1>
        <p style={{ color:'#6b7280', marginBottom:24, fontSize:14 }}>Sign in to your account</p>

        {error && (
          <div style={{ background:'#fee2e2', borderRadius:8, padding:'10px 14px', marginBottom:16, color:'#dc2626', fontSize:14, border:'1px solid #fca5a5' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontWeight:500, fontSize:14, marginBottom:4, color:'#374151' }}>
              Email or Mobile
            </label>
            <input
              type="text" value={identifier} onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
              placeholder="email@example.com or 9876543210"
              style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, boxSizing:'border-box' }}
            />
          </div>

          <div style={{ marginBottom:8 }}>
            <label style={{ display:'block', fontWeight:500, fontSize:14, marginBottom:4, color:'#374151' }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Your password"
              style={{ width:'100%', padding:'10px 14px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, boxSizing:'border-box' }}
            />
          </div>

          <div style={{ textAlign:'right', marginBottom:20 }}>
            <Link to="/forgot-password" style={{ fontSize:13, color:'#6366f1', textDecoration:'none' }}>
              Forgot password?
            </Link>
          </div>

          <button
            type="submit" disabled={loading}
            style={{
              width:'100%', padding:'12px', borderRadius:8,
              background: loading ? '#9ca3af' : '#6366f1',
              color:'#fff', border:'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight:600, fontSize:16,
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign:'center', marginTop:20, fontSize:14, color:'#6b7280' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color:'#6366f1', fontWeight:600 }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
