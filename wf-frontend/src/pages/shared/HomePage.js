import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const HomePage = () => {
  const { user } = useAuth();

  return (
    <div>
      {/* Hero */}
      <div style={{ textAlign:'center', padding:'60px 20px', background:'linear-gradient(135deg,#6366f1 0%,#818cf8 50%,#0ea5e9 100%)', borderRadius:20, color:'#fff', marginBottom:40 }}>
        <h1 style={{ fontSize:42, fontWeight:800, margin:'0 0 16px' }}>🔧 WorkerFinder</h1>
        <p style={{ fontSize:18, opacity:0.9, maxWidth:560, margin:'0 auto 32px' }}>
          Connect with verified local workers instantly. Plumbers, electricians, carpenters — all nearby.
        </p>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
          {!user ? (
            <>
              <Link to="/register" style={{ padding:'14px 32px', background:'#fff', color:'#f19963', borderRadius:12, textDecoration:'none', fontWeight:700, fontSize:16 }}>
                Get Started Free
              </Link>
              <Link to="/workers/search" style={{ padding:'14px 32px', background:'rgba(234, 24, 24, 0.2)', color:'#fff', borderRadius:12, textDecoration:'none', fontWeight:600, fontSize:16, border:'1px solid rgba(255,255,255,.4)' }}>
                Browse Workers
              </Link>
            </>
          ) : (
            <>
              <Link to="/dashboard" style={{ padding:'14px 32px', background:'#fff', color:'#6366f1', borderRadius:12, textDecoration:'none', fontWeight:700, fontSize:16 }}>
                Go to Dashboard
              </Link>
              <Link to="/jobs/create" style={{ padding:'14px 32px', background:'rgba(255,255,255,.2)', color:'#fff', borderRadius:12, textDecoration:'none', fontWeight:600, fontSize:16, border:'1px solid rgba(255,255,255,.4)' }}>
                Post a Job
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Features */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))', gap:20, marginBottom:40 }}>
        {[
          ['🤖 AI Matching', 'Smart algorithm ranks workers by rating, proximity, and completion rate'],
          ['💰 Smart Pricing', 'AI suggests fair market rates based on category and location'],
          ['✅ Verified Workers', 'Identity and document verification for every worker'],
          ['💳 Secure Payments', 'Razorpay integration with escrow protection'],
          ['⭐ Two-way Reviews', 'Both parties review each other after job completion'],
          ['⚖️ Dispute Resolution', 'Fair dispute process with admin mediation'],
          ['🎁 Referral Rewards', 'Earn bonuses by inviting friends'],
          ['💬 Real-time Chat', 'Instant messaging with media support'],
        ].map(([title, desc]) => (
          <div key={title} style={{ background:'#fff', borderRadius:14, padding:24, boxShadow:'0 2px 10px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize:28, marginBottom:10 }}>{title.split(' ')[0]}</div>
            <h3 style={{ fontSize:15, fontWeight:700, margin:'0 0 6px', color:'#1f2937' }}>{title.slice(3)}</h3>
            <p style={{ fontSize:13, color:'#6b7280', margin:0, lineHeight:1.6 }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
        {[
          ['/workers/search', '🔍 Find Workers', '#6366f1'],
          ['/jobs/browse',    '💼 Browse Jobs', '#0ea5e9'],
          ['/categories',     '🏷 Categories',  '#8b5cf6'],
        ].map(([to, label, color]) => (
          <Link key={to} to={to} style={{ padding:'12px 24px', background: color, color:'#fff', borderRadius:10, textDecoration:'none', fontWeight:600, fontSize:15 }}>
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default HomePage;
