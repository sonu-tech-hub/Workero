/**
 * RegisterPage.js
 * Logic:
 * - Collects email/mobile, password, user_type, full_name, referral_code
 * - Debounced referral code validation (600 ms)
 * - Strong password validation (min 8, upper, lower, number)
 * - Submits → navigates to OTP verification page
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { validateReferralCode } from '../../api/referralAPI';
import { extractError, debounce } from '../../utils/helpers';

const INITIAL = {
  full_name: '', email: '', mobile: '', password: '',
  user_type: 'seeker', referral_code: ''
};

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]           = useState(INITIAL);
  const [errors, setErrors]       = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [referralValid, setReferralValid] = useState(null); // null | {valid,name}

  // ── Debounced referral code check ─────────────────────────
  const validateRef = useRef(
    debounce(async (code) => {
      if (!code || code.length < 4) { setReferralValid(null); return; }
      try {
        const { data } = await validateReferralCode(code);
        setReferralValid({ valid: true, name: data.data?.referrer_name, bonus: data.data?.bonus_amount });
      } catch {
        setReferralValid({ valid: false });
      }
    }, 600)
  );

  useEffect(() => { validateRef.current(form.referral_code); }, [form.referral_code]);

  // ── Client-side validation ────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.full_name.trim())    e.full_name = 'Name is required';
    if (!form.email && !form.mobile) e.email = 'Email or mobile is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (form.mobile && !/^\d{10}$/.test(form.mobile)) e.mobile = 'Mobile must be 10 digits';
    if (!form.password)            e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'At least 8 characters';
    else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password))
      e.password = 'Must contain uppercase, lowercase, and number';
    return e;
  };

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErrors((er) => ({ ...er, [e.target.name]: '' }));
    setServerError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length) { setErrors(v); return; }

    setSubmitting(true);
    try {
      await register(form);
      navigate('/otp', { state: { identifier: form.email || form.mobile, type: 'register' } });
    } catch (err) {
      setServerError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const field = (name, label, type = 'text', placeholder = '') => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display:'block', fontWeight:500, marginBottom:4, fontSize:14, color:'#374151' }}>
        {label}
      </label>
      <input
        name={name} type={type} value={form[name]}
        onChange={handleChange} placeholder={placeholder}
        style={{
          width:'100%', padding:'10px 14px', borderRadius:8,
          border: `1.5px solid ${errors[name] ? '#ef4444' : '#d1d5db'}`,
          fontSize:14, outline:'none', boxSizing:'border-box',
        }}
      />
      {errors[name] && <p style={{ color:'#ef4444', fontSize:12, marginTop:4 }}>{errors[name]}</p>}
    </div>
  );

  return (
    <div style={{ maxWidth:460, margin:'40px auto', padding:'0 16px' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:32, boxShadow:'0 4px 24px rgba(0,0,0,.08)' }}>
        <h1 style={{ fontSize:24, fontWeight:700, color:'#1f2937', marginBottom:4 }}>Create Account</h1>
        <p style={{ color:'#6b7280', marginBottom:24, fontSize:14 }}>Join WorkerFinder today</p>

        {serverError && (
          <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, padding:'10px 14px', marginBottom:16, color:'#dc2626', fontSize:14 }}>
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* User type selector */}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontWeight:500, marginBottom:6, fontSize:14, color:'#374151' }}>I am a</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {['seeker', 'worker'].map((t) => (
                <button
                  key={t} type="button"
                  onClick={() => setForm((f) => ({ ...f, user_type: t }))}
                  style={{
                    padding:'10px', borderRadius:8, cursor:'pointer',
                    border: form.user_type === t ? '2px solid #6366f1' : '1.5px solid #d1d5db',
                    background: form.user_type === t ? '#eef2ff' : '#fff',
                    fontWeight: form.user_type === t ? 600 : 400,
                    color: form.user_type === t ? '#6366f1' : '#374151',
                    fontSize:14, textTransform:'capitalize',
                  }}
                >
                  {t === 'seeker' ? '🏠 Hire Workers' : '👷 Find Work'}
                </button>
              ))}
            </div>
          </div>

          {field('full_name', 'Full Name', 'text', 'Your full name')}
          {field('email', 'Email Address', 'email', 'you@example.com')}
          {field('mobile', 'Mobile Number', 'tel', '10-digit mobile number')}
          {field('password', 'Password', 'password', 'Min 8 chars, upper/lower/number')}

          {/* Referral code */}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontWeight:500, marginBottom:4, fontSize:14, color:'#374151' }}>
              Referral Code <span style={{ fontWeight:400, color:'#9ca3af' }}>(optional)</span>
            </label>
            <input
              name="referral_code" value={form.referral_code}
              onChange={handleChange} placeholder="Enter referral code"
              style={{
                width:'100%', padding:'10px 14px', borderRadius:8,
                border: `1.5px solid ${referralValid?.valid === false ? '#ef4444' : referralValid?.valid ? '#10b981' : '#d1d5db'}`,
                fontSize:14, boxSizing:'border-box',
              }}
            />
            {referralValid?.valid && (
              <p style={{ color:'#10b981', fontSize:12, marginTop:4 }}>
                ✓ Valid! Referred by {referralValid.name}. Earn ₹{referralValid.bonus} bonus!
              </p>
            )}
            {referralValid?.valid === false && (
              <p style={{ color:'#ef4444', fontSize:12, marginTop:4 }}>✗ Invalid referral code</p>
            )}
          </div>

          <button
            type="submit" disabled={submitting}
            style={{
              width:'100%', padding:'12px', borderRadius:8,
              background: submitting ? '#9ca3af' : '#6366f1',
              color:'#fff', border:'none', cursor: submitting ? 'not-allowed' : 'pointer',
              fontWeight:600, fontSize:16, marginTop:8,
            }}
          >
            {submitting ? 'Creating Account…' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign:'center', marginTop:20, fontSize:14, color:'#6b7280' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color:'#6366f1', fontWeight:600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
