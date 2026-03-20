import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

const Navbar = () => {
  const { user, logoutUser, isWorker, isSeeker, isAdmin } = useAuth();
  const { notifications, unreadMessages } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const dashboardPath = isAdmin ? '/admin' : '/dashboard';
  const profilePath = isAdmin ? '/admin' : '/profile';

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  const isActive = (path) => location.pathname.startsWith(path);

  const navLink = (to, label, badge) => (
    <Link
      key={to}
      to={to}
      style={{
        color: isActive(to) ? '#6366f1' : '#374151',
        fontWeight: isActive(to) ? 600 : 400,
        textDecoration: 'none',
        position: 'relative',
        padding: '4px 8px',
        fontSize: 14,
      }}
    >
      {label}
      {badge > 0 && (
        <span style={{
          position:'absolute', top:-4, right:-4,
          background:'#ef4444', color:'#fff',
          fontSize:10, borderRadius:'50%',
          width:16, height:16, display:'flex',
          alignItems:'center', justifyContent:'center',
          fontWeight:700,
        }}>{badge > 9 ? '9+' : badge}</span>
      )}
    </Link>
  );

  return (
    <nav style={{
      background:'#fff', borderBottom:'1px solid #e5e7eb',
      padding:'0 24px', height:60, display:'flex',
      alignItems:'center', justifyContent:'space-between',
      position:'sticky', top:0, zIndex:100, boxShadow:'0 1px 4px rgba(0,0,0,.06)',
    }}>
      {/* Logo */}
      <Link to="/" style={{ fontWeight:700, fontSize:20, color:'#6366f1', textDecoration:'none' }}>
        🔧 WorkerFinder
      </Link>

      {/* Nav links */}
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        {!user && (
          <>
            {navLink('/', 'Home')}
            {navLink('/workers/search', 'Find Workers')}
            {navLink('/jobs', 'Browse Jobs')}
            {navLink('/categories', 'Categories')}
          </>
        )}

        {user && (
          <>
            {navLink(dashboardPath, 'Dashboard')}
            {isSeeker && navLink('/jobs/create', 'Post Job')}
            {isSeeker && navLink('/workers/search', 'Find Workers')}
            {isWorker && navLink('/jobs/browse', 'Browse Jobs')}
            {navLink('/jobs/my-jobs', 'My Jobs')}
            {navLink('/announcements', 'Announcements')}
            {navLink('/notifications', 'Notifications', notifications.filter(n => !n.is_read).length)}
            {navLink('/messages', 'Messages', unreadMessages)}
            {navLink('/disputes', 'Disputes')}
            {navLink('/referrals', 'Referrals')}
            {navLink('/payments/history', 'Payments')}
            {isAdmin && navLink('/admin', 'Admin')}
          </>
        )}
      </div>

      {/* Auth controls */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        {user ? (
          <>
            <Link to={profilePath} style={{ textDecoration:'none' }}>
              <div style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'4px 10px', borderRadius:20,
                background:'#f3f4f6', cursor:'pointer',
              }}>
                <div style={{
                  width:28, height:28, borderRadius:'50%',
                  background:'#6366f1', color:'#fff',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:12, fontWeight:700,
                }}>
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <span style={{ fontSize:13, color:'#374151', fontWeight:500 }}>
                  {user.user_type}
                </span>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              style={{
                padding:'6px 14px', background:'#fee2e2', color:'#ef4444',
                border:'none', borderRadius:6, cursor:'pointer',
                fontSize:13, fontWeight:500,
              }}
            >Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" style={{
              padding:'6px 14px', background:'#f3f4f6',
              color:'#374151', borderRadius:6, textDecoration:'none',
              fontSize:13, fontWeight:500,
            }}>Login</Link>
            <Link to="/register" style={{
              padding:'6px 14px', background:'#6366f1',
              color:'#fff', borderRadius:6, textDecoration:'none',
              fontSize:13, fontWeight:500,
            }}>Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
