/**
 * AdminDashboard.js
 * Full admin panel with tabs:
 * - Overview stats
 * - User management (search, filter, toggle status)
 * - Analytics charts (text-based)
 * - Dispute management
 * - Revenue
 * - Cache management
 * - Mass notification
 */
import React, { useState, useEffect } from 'react';
import {
  getAdminDashboard, getAllUsers, toggleUserStatus,
  getAnalytics, getAdminDisputes, resolveDispute,
  getPlatformRevenue, manageCaches, sendMassNotification
} from '../../api/adminAPI';
import Spinner from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import { formatDate, formatCurrency, formatDateTime, extractError } from '../../utils/helpers';
import { useNotification } from '../../context/NotificationContext';

const TABS = ['Overview', 'Users', 'Analytics', 'Disputes', 'Revenue', 'Settings'];

const AdminDashboard = () => {
  const { addToast } = useNotification();
  const [tab, setTab]   = useState('Overview');
  const [dash, setDash] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminDashboard()
      .then(({ data }) => setDash(data.data))
      .catch((e) => addToast(extractError(e), 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:700, marginBottom:20 }}>🛡 Admin Panel</h2>

      {/* Tab nav */}
      <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'2px solid #e5e7eb', flexWrap:'wrap' }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:'10px 18px', border:'none', background:'none', cursor:'pointer', fontWeight:600, fontSize:14,
              color: tab===t ? '#6366f1' : '#6b7280',
              borderBottom: tab===t ? '2px solid #6366f1' : '2px solid transparent',
              marginBottom:-2,
            }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab dash={dash} />}
      {tab === 'Users'    && <UsersTab addToast={addToast} />}
      {tab === 'Analytics' && <AnalyticsTab />}
      {tab === 'Disputes' && <AdminDisputesTab addToast={addToast} />}
      {tab === 'Revenue'  && <RevenueTab />}
      {tab === 'Settings' && <SettingsTab addToast={addToast} />}
    </div>
  );
};

// ── Overview ──────────────────────────────────────────────────
const OverviewTab = ({ dash }) => {
  if (!dash) return null;
  const { users, jobs, revenue, disputes, recent_jobs, recent_users } = dash;

  const StatCard = ({ label, val, sub, color = '#6366f1' }) => (
    <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
      <div style={{ fontSize:28, fontWeight:700, color }}>{val}</div>
      <div style={{ fontSize:13, color:'#6b7280' }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:16, marginBottom:24 }}>
        <StatCard label="Total Users"   val={users?.total_users}    sub={`+${users?.new_today} today`} />
        <StatCard label="Workers"       val={users?.total_workers}  color="#8b5cf6" />
        <StatCard label="Seekers"       val={users?.total_seekers}  color="#0ea5e9" />
        <StatCard label="Total Jobs"    val={jobs?.total_jobs}      sub={`${jobs?.open_jobs} open`} />
        <StatCard label="Revenue"       val={formatCurrency(revenue?.total_revenue)} color="#10b981" />
        <StatCard label="Open Disputes" val={disputes?.open_disputes} color="#ef4444" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:15 }}>Recent Jobs</h3>
          {recent_jobs?.map((j) => (
            <div key={j.id} style={{ padding:'8px 0', borderBottom:'1px solid #f3f4f6', fontSize:13 }}>
              <div style={{ fontWeight:500 }}>{j.title}</div>
              <div style={{ color:'#9ca3af', fontSize:12 }}>{j.seeker_name} · {j.status} · {formatDate(j.created_at)}</div>
            </div>
          ))}
        </div>
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:15 }}>Recent Users</h3>
          {recent_users?.map((u) => (
            <div key={u.id} style={{ padding:'8px 0', borderBottom:'1px solid #f3f4f6', fontSize:13 }}>
              <div style={{ fontWeight:500 }}>{u.full_name || u.email}</div>
              <div style={{ color:'#9ca3af', fontSize:12 }}>{u.user_type} · {formatDate(u.created_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Users tab ─────────────────────────────────────────────────
const UsersTab = ({ addToast }) => {
  const [users, setUsers]     = useState([]);
  const [search, setSearch]   = useState('');
  const [userType, setUType]  = useState('');
  const [loading, setLoading] = useState(true);
  const { page, limit, meta, updateMeta, setPage } = usePagination(1, 15);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await getAllUsers({ page, limit, search, user_type: userType });
      setUsers(data.data?.users || []);
      updateMeta(data.data?.pagination);
    } catch (e) { addToast(extractError(e), 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, search, userType]);

  const handleToggle = async (userId, isActive) => {
    try {
      await toggleUserStatus(userId, { is_active: !isActive });
      addToast(`User ${!isActive ? 'activated' : 'deactivated'}`, 'success');
      load();
    } catch (e) { addToast(extractError(e), 'error'); }
  };

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex:1, minWidth:200, padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14 }} />
        <select value={userType} onChange={(e) => setUType(e.target.value)}
          style={{ padding:'9px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, background:'#fff' }}>
          <option value="">All Types</option>
          <option value="worker">Workers</option>
          <option value="seeker">Seekers</option>
        </select>
      </div>

      {loading ? <Spinner /> : (
        <>
          <div style={{ background:'#fff', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,.06)', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f9fafb' }}>
                  {['ID','Name','Email','Type','Verified','Active','Joined','Actions'].map((h) => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, color:'#6b7280', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                    <td style={{ padding:'10px 14px', color:'#9ca3af' }}>#{u.id}</td>
                    <td style={{ padding:'10px 14px', fontWeight:500 }}>{u.full_name || '—'}</td>
                    <td style={{ padding:'10px 14px', color:'#6b7280' }}>{u.email}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, background: u.user_type==='worker'?'#eef2ff':'#e0f2fe', color: u.user_type==='worker'?'#6366f1':'#0369a1' }}>{u.user_type}</span>
                    </td>
                    <td style={{ padding:'10px 14px' }}>{u.is_verified ? '✅' : '❌'}</td>
                    <td style={{ padding:'10px 14px' }}>{u.is_active ? '🟢' : '🔴'}</td>
                    <td style={{ padding:'10px 14px', color:'#9ca3af' }}>{formatDate(u.created_at)}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <button onClick={() => handleToggle(u.id, u.is_active)}
                        style={{ padding:'4px 10px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:500,
                          background: u.is_active ? '#fee2e2' : '#d1fae5',
                          color: u.is_active ? '#dc2626' : '#059669' }}>
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

// ── Analytics tab ─────────────────────────────────────────────
const AnalyticsTab = () => {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAnalytics(period)
      .then(({ data }) => setData(data.data))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return <Spinner />;
  if (!data) return null;

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {[7,30,90,365].map((d) => (
          <button key={d} onClick={() => setPeriod(d)}
            style={{ padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer', fontSize:13,
              background: period===d ? '#6366f1' : '#f3f4f6',
              color: period===d ? '#fff' : '#374151', fontWeight: period===d ? 600 : 400 }}>
            {d}d
          </button>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:15 }}>Top Categories</h3>
          {data.top_categories?.map((c, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f3f4f6', fontSize:13 }}>
              <span>{c.name || 'N/A'}</span>
              <span style={{ color:'#6366f1', fontWeight:600 }}>{c.job_count} jobs</span>
            </div>
          ))}
        </div>
        <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:15 }}>Top Workers</h3>
          {data.top_workers?.map((w, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f3f4f6', fontSize:13 }}>
              <span>{w.full_name}</span>
              <span style={{ color:'#10b981', fontWeight:600 }}>{w.completed_jobs} jobs</span>
            </div>
          ))}
        </div>
      </div>

      {data.daily_revenue?.length > 0 && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginTop:16, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <h3 style={{ margin:'0 0 12px', fontSize:15 }}>Daily Revenue (last {period} days)</h3>
          {data.daily_revenue.slice(-10).map((r, i) => {
            const max = Math.max(...data.daily_revenue.map((x) => x.revenue || 0));
            const pct = max > 0 ? ((r.revenue / max) * 100).toFixed(0) : 0;
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <div style={{ width:70, fontSize:11, color:'#9ca3af' }}>{r.date?.slice(5)}</div>
                <div style={{ flex:1, background:'#f3f4f6', borderRadius:4, height:16, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, background:'#10b981', height:'100%', borderRadius:4 }} />
                </div>
                <div style={{ width:80, fontSize:12, textAlign:'right' }}>{formatCurrency(r.revenue)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Admin Disputes tab ────────────────────────────────────────
const AdminDisputesTab = ({ addToast }) => {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const { page, limit, meta, updateMeta, setPage } = usePagination(1, 10);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await getAdminDisputes({ page, limit });
      setDisputes(data.data?.disputes || []);
      updateMeta(data.data?.pagination);
    } catch (e) { addToast(extractError(e), 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);

  const handleResolve = async (id) => {
    const notes = window.prompt('Resolution notes:');
    if (!notes) return;
    try {
      await resolveDispute(id, { status: 'resolved', resolution_notes: notes });
      addToast('Dispute resolved', 'success');
      load();
    } catch (e) { addToast(extractError(e), 'error'); }
  };

  return (
    <div>
      {loading ? <Spinner /> : (
        <>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {disputes.map((d) => (
              <div key={d.id} style={{ background:'#fff', borderRadius:12, padding:'14px 18px', boxShadow:'0 2px 8px rgba(0,0,0,.06)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>{d.job_title || `Job #${d.job_id}`}</div>
                  <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
                    {d.raised_by_name} vs {d.against_name} · {formatDate(d.created_at)}
                  </div>
                  <div style={{ fontSize:13, marginTop:2 }}>{d.reason?.slice(0, 80)}</div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ padding:'3px 10px', borderRadius:20, fontSize:12, background:'#fee2e2', color:'#dc2626' }}>{d.status}</span>
                  {d.status === 'open' && (
                    <button onClick={() => handleResolve(d.id)} style={{ padding:'6px 12px', background:'#10b981', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:13 }}>Resolve</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Pagination meta={meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

// ── Revenue tab ───────────────────────────────────────────────
const RevenueTab = () => {
  const [rev, setRev] = useState(null);
  useEffect(() => {
    getPlatformRevenue().then(({ data }) => setRev(data.data)).catch(() => {});
  }, []);

  if (!rev) return <Spinner />;

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16 }}>
      {[
        ['Total Volume',    formatCurrency(rev.total_payment_volume)],
        ['Total Revenue',   formatCurrency(rev.total_revenue)],
        ['Total GST',       formatCurrency(rev.total_gst)],
        ['Worker Payouts',  formatCurrency(rev.total_worker_payouts)],
        ['Successful Tx',   rev.successful_transactions],
        ['Failed Tx',       rev.failed_transactions],
        ['Refunded Tx',     rev.refunded_transactions],
      ].map(([l, v]) => (
        <div key={l} style={{ background:'#fff', borderRadius:12, padding:20, textAlign:'center', boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#1f2937' }}>{v}</div>
          <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>{l}</div>
        </div>
      ))}
    </div>
  );
};

// ── Settings tab ──────────────────────────────────────────────
const SettingsTab = ({ addToast }) => {
  const [notifForm, setNotifForm] = useState({ title:'', body:'', user_type:'' });
  const [sending, setSending] = useState(false);

  const handleFlushCache = async () => {
    try {
      await manageCaches('flush');
      addToast('Cache flushed!', 'success');
    } catch (e) { addToast(extractError(e), 'error'); }
  };

  const handleSendNotif = async (e) => {
    e.preventDefault();
    if (!notifForm.title || !notifForm.body) { addToast('Title and body required', 'error'); return; }
    setSending(true);
    try {
      const { data } = await sendMassNotification(notifForm);
      addToast(`Sent to ${data.data?.sent_count} users!`, 'success');
      setNotifForm({ title:'', body:'', user_type:'' });
    } catch (e) { addToast(extractError(e), 'error'); }
    finally { setSending(false); }
  };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
      <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
        <h3 style={{ margin:'0 0 12px', fontSize:16 }}>🗄 Cache Management</h3>
        <button onClick={handleFlushCache} style={{ padding:'10px 20px', background:'#ef4444', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
          Flush All Caches
        </button>
      </div>
      <div style={{ background:'#fff', borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
        <h3 style={{ margin:'0 0 12px', fontSize:16 }}>📣 Mass Notification</h3>
        <form onSubmit={handleSendNotif}>
          {[['title','Title'],['body','Message body']].map(([k,l]) => (
            <div key={k} style={{ marginBottom:10 }}>
              <input placeholder={l} value={notifForm[k]} onChange={(e) => setNotifForm((f) => ({ ...f, [k]: e.target.value }))}
                style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:13, boxSizing:'border-box' }} />
            </div>
          ))}
          <select value={notifForm.user_type} onChange={(e) => setNotifForm((f) => ({ ...f, user_type: e.target.value }))}
            style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:13, marginBottom:10, background:'#fff' }}>
            <option value="">All Users</option>
            <option value="worker">Workers Only</option>
            <option value="seeker">Seekers Only</option>
          </select>
          <button type="submit" disabled={sending} style={{ padding:'9px 20px', background:'#6366f1', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:600 }}>
            {sending ? 'Sending…' : 'Send Notification'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminDashboard;
