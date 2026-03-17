/**
 * WorkerDashboard.js
 * Shows:
 * - Profile + availability toggle
 * - AI performance tier + insights
 * - Job stats (total, completed, active, pending)
 * - Monthly earnings chart (text-based)
 * - Recent reviews
 * - Unread counts
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getWorkerStats, updateAvailability } from '../../api/workerAPI';
import { getDashboardInsights } from '../../api/aiAPI';
import Spinner from '../../components/common/Spinner';
import StarRating from '../../components/common/StarRating';
import { formatCurrency, formatDate, tierColor, parseJSON, extractError } from '../../utils/helpers';
import { useNotification } from '../../context/NotificationContext';

const WorkerDashboard = () => {
  const { addToast } = useNotification();
  const [stats,    setStats]    = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error,    setError]    = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [s, ai] = await Promise.allSettled([
        getWorkerStats(),
        getDashboardInsights(),
      ]);
      if (s.status === 'fulfilled') setStats(s.value.data.data);
      if (ai.status === 'fulfilled') setInsights(ai.value.data.data);
    } catch (e) {
      setError(extractError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAvailability = async (val) => {
    setToggling(true);
    try {
      await updateAvailability(val);
      setStats((s) => ({ ...s, profile: { ...s.profile, is_available: val } }));
      addToast(val ? '✅ You are now available' : '⏸ You are now unavailable', 'success');
    } catch (e) {
      addToast(extractError(e), 'error');
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <Spinner />;
  if (error)   return <div style={{ color:'#ef4444', padding:20 }}>{error}</div>;
  if (!stats)  return null;

  const { profile, job_stats, monthly_earnings, recent_reviews, unread_messages, ai_performance } = stats;
  const perf = ai_performance || {};
  const skills = parseJSON(profile?.skills, []);

  const statCard = (label, val, color = '#6366f1') => (
    <div style={{ background:'#fff', borderRadius:12, padding:20, textAlign:'center', boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
      <div style={{ fontSize:28, fontWeight:700, color }}>{val ?? 0}</div>
      <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#6366f1,#818cf8)', borderRadius:16, padding:28, color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:700, margin:0 }}>👷 {profile?.full_name || 'Worker'}</h1>
          <p style={{ opacity:0.85, margin:'4px 0 0', fontSize:14 }}>{profile?.profession || 'Worker'} · {profile?.city || 'Location not set'}</p>
          {perf.tier && (
            <span style={{ display:'inline-block', marginTop:8, padding:'2px 10px', borderRadius:20, background:'rgba(255,255,255,.2)', fontSize:12, fontWeight:600 }}>
              🏅 {perf.tier} Tier · Grade {perf.performance_grade}
            </span>
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
          <div style={{ fontSize:13, opacity:0.9 }}>Availability</div>
          <button
            onClick={() => handleAvailability(!profile?.is_available)}
            disabled={toggling}
            style={{
              padding:'10px 20px', borderRadius:24, border:'none', cursor:'pointer',
              background: profile?.is_available ? '#10b981' : '#9ca3af',
              color:'#fff', fontWeight:600, fontSize:14,
            }}
          >
            {toggling ? '…' : profile?.is_available ? '🟢 Available' : '⚫ Unavailable'}
          </button>
          <Link to="/profile/edit" style={{ color:'rgba(255,255,255,.8)', fontSize:12, textDecoration:'none' }}>Edit Profile →</Link>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:16 }}>
        {statCard('Total Jobs',      job_stats?.total_jobs,     '#6366f1')}
        {statCard('Completed',       job_stats?.completed_jobs, '#10b981')}
        {statCard('Active',          job_stats?.active_jobs,    '#f59e0b')}
        {statCard('Unread Messages', unread_messages,           '#3b82f6')}
        {statCard('Total Earnings',  formatCurrency(profile?.total_earnings), '#8b5cf6')}
        {statCard('Avg Rating',      `${parseFloat(profile?.average_rating || 0).toFixed(1)} ⭐`, '#f97316')}
      </div>

      {/* AI Performance + badges */}
      {perf.badges?.length > 0 && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:16 }}>🏆 Your Achievements</h3>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {perf.badges.map((b, i) => (
              <span key={i} style={{ padding:'4px 12px', borderRadius:20, background:'#eef2ff', color:'#6366f1', fontSize:13, fontWeight:500 }}>{b}</span>
            ))}
          </div>
          {perf.insights?.length > 0 && (
            <ul style={{ marginTop:12, paddingLeft:20, color:'#6b7280', fontSize:14 }}>
              {perf.insights.map((ins, i) => <li key={i}>{ins}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* AI Dashboard insights */}
      {insights?.ai_performance && (
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:20 }}>
          <h3 style={{ margin:'0 0 8px', fontSize:16, color:'#059669' }}>🤖 AI Insights</h3>
          <p style={{ margin:0, color:'#064e3b', fontSize:14 }}>
            Tier: <strong>{insights.ai_performance.tier}</strong> · 
            Completion: <strong>{insights.ai_performance.completion_rate}%</strong>
          </p>
          {insights.tips?.length > 0 && (
            <ul style={{ marginTop:8, paddingLeft:20, color:'#065f46', fontSize:13 }}>
              {insights.tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Monthly earnings */}
      {monthly_earnings?.length > 0 && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:16 }}>📈 Monthly Earnings (Last 6 months)</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {monthly_earnings.slice(0, 6).map((m, i) => {
              const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              const maxEarning = Math.max(...monthly_earnings.map(x => x.earnings || 0));
              const pct = maxEarning > 0 ? ((m.earnings / maxEarning) * 100).toFixed(0) : 0;
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:40, fontSize:12, color:'#6b7280' }}>{months[(m.month - 1) % 12]}</div>
                  <div style={{ flex:1, background:'#f3f4f6', borderRadius:4, height:20, position:'relative', overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, background:'#6366f1', height:'100%', borderRadius:4, transition:'width 0.5s' }} />
                  </div>
                  <div style={{ width:80, fontSize:12, color:'#374151', textAlign:'right' }}>{formatCurrency(m.earnings)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:16 }}>🛠 Skills</h3>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {skills.map((s, i) => (
              <span key={i} style={{ padding:'4px 12px', borderRadius:20, background:'#f3f4f6', color:'#374151', fontSize:13 }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Recent reviews */}
      {recent_reviews?.length > 0 && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:16 }}>⭐ Recent Reviews</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {recent_reviews.slice(0, 5).map((r) => (
              <div key={r.id} style={{ padding:'12px 16px', background:'#f9fafb', borderRadius:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <strong style={{ fontSize:14 }}>{r.reviewer_name}</strong>
                  <StarRating rating={r.rating} size={14} />
                </div>
                {r.review_text && <p style={{ margin:0, fontSize:13, color:'#6b7280' }}>{r.review_text}</p>}
                <div style={{ fontSize:12, color:'#9ca3af', marginTop:4 }}>{formatDate(r.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
        {[
          ['/jobs/my-jobs', '📋 My Jobs', '#6366f1'],
          ['/messages',     '💬 Messages', '#3b82f6'],
          ['/profile/edit', '✏️ Edit Profile', '#8b5cf6'],
          ['/disputes',     '⚖️ Disputes', '#f59e0b'],
          ['/referrals',    '🎁 Referrals', '#10b981'],
          ['/payments/history', '💰 Payments', '#f97316'],
        ].map(([to, label, color]) => (
          <Link key={to} to={to} style={{
            padding:'14px 16px', background:'#fff', borderRadius:12,
            textDecoration:'none', color:'#374151',
            boxShadow:'0 2px 8px rgba(0,0,0,.06)',
            fontWeight:500, fontSize:14, textAlign:'center',
            borderLeft:`4px solid ${color}`,
          }}>{label}</Link>
        ))}
      </div>
    </div>
  );
};

export default WorkerDashboard;
