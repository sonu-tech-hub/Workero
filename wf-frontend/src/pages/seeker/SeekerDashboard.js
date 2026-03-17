/**
 * SeekerDashboard.js
 * Shows:
 * - Profile + quick actions
 * - Job stats (posted, completed, open, in-progress, total spent)
 * - Monthly spending bar chart
 * - Favorite workers
 * - AI insights
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSeekerStats } from '../../api/seekerAPI';
import { getDashboardInsights } from '../../api/aiAPI';
import Spinner from '../../components/common/Spinner';
import StarRating from '../../components/common/StarRating';
import { formatCurrency, formatDate, parseJSON, extractError } from '../../utils/helpers';

const SeekerDashboard = () => {
  const [stats,    setStats]    = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [s, ai] = await Promise.allSettled([
          getSeekerStats(), getDashboardInsights()
        ]);
        if (s.status === 'fulfilled')  setStats(s.value.data.data);
        if (ai.status === 'fulfilled') setInsights(ai.value.data.data);
      } catch (e) {
        setError(extractError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner />;
  if (error)   return <div style={{ color:'#ef4444', padding:20 }}>{error}</div>;
  if (!stats)  return null;

  const { profile, job_stats, monthly_spending, favorite_workers } = stats;

  const statCard = (label, val, color = '#6366f1') => (
    <div style={{ background:'#fff', borderRadius:12, padding:20, textAlign:'center', boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
      <div style={{ fontSize:26, fontWeight:700, color }}>{val ?? 0}</div>
      <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#0ea5e9,#38bdf8)', borderRadius:16, padding:28, color:'#fff', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:700, margin:0 }}>🏠 {profile?.full_name || 'Seeker'}</h1>
          <p style={{ opacity:0.85, margin:'4px 0 0', fontSize:14 }}>{profile?.city || 'Location not set'}</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <Link to="/jobs/create" style={{ padding:'10px 20px', background:'rgba(255,255,255,.2)', color:'#fff', borderRadius:8, textDecoration:'none', fontWeight:600, fontSize:14 }}>
            + Post Job
          </Link>
          <Link to="/profile/edit" style={{ padding:'10px 16px', background:'rgba(255,255,255,.15)', color:'#fff', borderRadius:8, textDecoration:'none', fontSize:14 }}>
            Edit Profile
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:16 }}>
        {statCard('Total Posted',    job_stats?.total_posted,    '#6366f1')}
        {statCard('Completed',       job_stats?.completed,       '#10b981')}
        {statCard('Open Jobs',       job_stats?.open_jobs,       '#3b82f6')}
        {statCard('In Progress',     job_stats?.in_progress,     '#f59e0b')}
        {statCard('Total Spent',     formatCurrency(job_stats?.total_spent), '#ef4444')}
        {statCard('Avg Job Value',   formatCurrency(job_stats?.avg_job_value), '#8b5cf6')}
      </div>

      {/* AI insights */}
      {insights?.job_stats && (
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:20 }}>
          <h3 style={{ margin:'0 0 8px', fontSize:16, color:'#059669' }}>🤖 AI Insights</h3>
          {insights.tips?.length > 0 && (
            <ul style={{ margin:0, paddingLeft:20, color:'#065f46', fontSize:14 }}>
              {insights.tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Monthly spending */}
      {monthly_spending?.length > 0 && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:16 }}>📊 Monthly Spending</h3>
          {monthly_spending.slice(0, 6).map((m, i) => {
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const max = Math.max(...monthly_spending.map((x) => x.amount || 0));
            const pct = max > 0 ? ((m.amount / max) * 100).toFixed(0) : 0;
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                <div style={{ width:36, fontSize:12, color:'#6b7280' }}>{months[(m.month - 1) % 12]}</div>
                <div style={{ flex:1, background:'#f3f4f6', borderRadius:4, height:18, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, background:'#0ea5e9', height:'100%', borderRadius:4 }} />
                </div>
                <div style={{ width:80, fontSize:12, textAlign:'right' }}>{formatCurrency(m.amount)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Favorite workers */}
      {favorite_workers?.length > 0 && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 16px', fontSize:16 }}>⭐ Workers You've Worked With</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {favorite_workers.map((w) => (
              <Link key={w.worker_user_id} to={`/workers/${w.worker_user_id}`} style={{ textDecoration:'none', color:'inherit' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', background:'#f9fafb', borderRadius:8 }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background:'#e5e7eb', overflow:'hidden', flexShrink:0 }}>
                    {w.profile_photo_url
                      ? <img src={w.profile_photo_url} alt={w.full_name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>👤</div>
                    }
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>{w.full_name}</div>
                    <div style={{ fontSize:12, color:'#6b7280' }}>{w.profession} · {w.jobs_together} jobs</div>
                  </div>
                  <StarRating rating={w.average_rating} size={14} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
        {[
          ['/jobs/create',   '+ Post a Job',    '#6366f1'],
          ['/workers/search','🔍 Find Workers',  '#0ea5e9'],
          ['/jobs/my-jobs',  '📋 My Jobs',       '#8b5cf6'],
          ['/messages',      '💬 Messages',      '#3b82f6'],
          ['/disputes',      '⚖️ Disputes',      '#f59e0b'],
          ['/payments/history','💰 Payments',    '#10b981'],
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

export default SeekerDashboard;
