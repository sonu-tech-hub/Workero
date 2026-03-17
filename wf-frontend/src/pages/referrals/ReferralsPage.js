import React, { useState, useEffect } from 'react';
import { getReferralInfo, getAllReferrals } from '../../api/referralAPI';
import Spinner from '../../components/common/Spinner';
import { formatDate, formatCurrency, extractError } from '../../utils/helpers';

const ReferralsPage = () => {
  const [info, setInfo]           = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [copied, setCopied]       = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [iRes, rRes] = await Promise.allSettled([getReferralInfo(), getAllReferrals()]);
        if (iRes.status === 'fulfilled') setInfo(iRes.value.data.data);
        if (rRes.status === 'fulfilled') setReferrals(rRes.value.data.data?.referrals || []);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(info?.referral_code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <Spinner />;
  const { referral_code, stats } = info || {};

  return (
    <div style={{ maxWidth:700, margin:'0 auto' }}>
      <h2 style={{ fontSize:22, fontWeight:700, marginBottom:20 }}>🎁 Referrals</h2>
      <div style={{ background:'linear-gradient(135deg,#6366f1,#818cf8)', borderRadius:16, padding:28, color:'#fff', marginBottom:20, textAlign:'center' }}>
        <h3 style={{ margin:'0 0 4px', fontSize:18 }}>Your Referral Code</h3>
        <p style={{ opacity:0.85, margin:'0 0 16px', fontSize:14 }}>Share and earn ₹{stats?.bonus_per_referral} per referral!</p>
        <div style={{ background:'rgba(255,255,255,.2)', borderRadius:12, padding:'14px 20px', display:'inline-flex', alignItems:'center', gap:16, marginBottom:16 }}>
          <span style={{ fontSize:24, fontWeight:800, letterSpacing:4 }}>{referral_code || 'N/A'}</span>
          <button onClick={copyCode} style={{ padding:'6px 14px', background:'rgba(255,255,255,.9)', color:'#6366f1', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
        <div style={{ display:'flex', justifyContent:'center', gap:24 }}>
          {[['Total', stats?.total_referrals||0], ['Completed', stats?.completed_referrals||0], ['Earned', formatCurrency(stats?.total_earnings||0)]].map(([l,v]) => (
            <div key={l}><div style={{ fontSize:20, fontWeight:700 }}>{v}</div><div style={{ fontSize:12, opacity:0.8 }}>{l}</div></div>
          ))}
        </div>
      </div>
      <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
        <h3 style={{ margin:'0 0 16px', fontSize:16 }}>Referral History</h3>
        {referrals.length === 0 ? <p style={{ color:'#9ca3af', textAlign:'center' }}>No referrals yet. Share your code!</p> : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {referrals.map((r) => (
              <div key={r.id} style={{ padding:'12px 14px', background:'#f9fafb', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                <div>
                  <div style={{ fontWeight:500, fontSize:14 }}>{r.referred_user_name || r.referred_user_email}</div>
                  <div style={{ fontSize:12, color:'#9ca3af' }}>{r.referred_user_type} · {formatDate(r.referred_date)}</div>
                </div>
                <span style={{ padding:'3px 10px', borderRadius:20, fontSize:12, fontWeight:500, background: r.status==='completed'?'#d1fae5':'#f3f4f6', color: r.status==='completed'?'#059669':'#374151' }}>{r.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralsPage;
