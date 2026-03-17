/**
 * OTPPage.js
 * Logic:
 * - 6-input boxes with auto-advance and paste support
 * - 60-second countdown with "Resend" button
 * - Supports both registration OTP and forgot-password OTP
 */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { extractError } from '../../utils/helpers';

const OTP_LENGTH = 6;

const OTPPage = () => {
  const { verifyOTP, resendOTP } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const identifier = location.state?.identifier || '';
  const type       = location.state?.type || 'register'; // 'register' | 'reset'

  const [digits, setDigits]       = useState(Array(OTP_LENGTH).fill(''));
  const [error,   setError]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);

  // ── Countdown timer ───────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  // ── Input handlers ────────────────────────────────────────
  const handleChange = (i, val) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...digits];
    next[i] = val.slice(-1);
    setDigits(next);
    setError('');
    if (val && i < OTP_LENGTH - 1) inputRefs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const next = [...digits];
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) { setError('Please enter the complete OTP'); return; }

    setLoading(true);
    try {
      if (type === 'reset') {
        navigate('/reset-password', { state: { identifier, otp } });
      } else {
        await verifyOTP(identifier, otp);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(extractError(err));
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // ── Resend ────────────────────────────────────────────────
  const handleResend = async () => {
    setResending(true);
    try {
      await resendOTP(identifier);
      setCountdown(60);
      setDigits(Array(OTP_LENGTH).fill(''));
      setError('');
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{ maxWidth:420, margin:'60px auto', padding:'0 16px' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:32, boxShadow:'0 4px 24px rgba(0,0,0,.08)', textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔐</div>
        <h1 style={{ fontSize:24, fontWeight:700, color:'#1f2937', marginBottom:4 }}>Verify OTP</h1>
        <p style={{ color:'#6b7280', marginBottom:24, fontSize:14 }}>
          A 6-digit code was sent to <strong>{identifier}</strong>
        </p>

        {error && (
          <div style={{ background:'#fee2e2', borderRadius:8, padding:'10px 14px', marginBottom:16, color:'#dc2626', fontSize:14, border:'1px solid #fca5a5' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display:'flex', gap:10, justifyContent:'center', marginBottom:24 }} onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="text" inputMode="numeric" maxLength={1} value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                style={{
                  width:44, height:52, textAlign:'center', fontSize:22, fontWeight:700,
                  borderRadius:8, border: `2px solid ${d ? '#6366f1' : '#d1d5db'}`,
                  outline:'none', background: d ? '#eef2ff' : '#fff',
                  color:'#1f2937',
                }}
              />
            ))}
          </div>

          <button
            type="submit" disabled={loading || digits.join('').length < OTP_LENGTH}
            style={{
              width:'100%', padding:'12px', borderRadius:8,
              background: loading ? '#9ca3af' : '#6366f1',
              color:'#fff', border:'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight:600, fontSize:16,
            }}
          >
            {loading ? 'Verifying…' : 'Verify OTP'}
          </button>
        </form>

        <div style={{ marginTop:20, fontSize:14, color:'#6b7280' }}>
          {countdown > 0 ? (
            <span>Resend in <strong>{countdown}s</strong></span>
          ) : (
            <button
              onClick={handleResend} disabled={resending}
              style={{ background:'none', border:'none', color:'#6366f1', cursor:'pointer', fontWeight:600, fontSize:14 }}
            >
              {resending ? 'Resending…' : 'Resend OTP'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OTPPage;
