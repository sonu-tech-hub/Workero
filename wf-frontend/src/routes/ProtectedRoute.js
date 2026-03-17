/**
 * ProtectedRoute.js
 * Guards routes by auth state and optional role.
 * Usage:
 *   <Route element={<ProtectedRoute />}>...</Route>
 *   <Route element={<ProtectedRoute role="worker" />}>...</Route>
 *   <Route element={<ProtectedRoute role="admin" />}>...</Route>
 */
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ role }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const roleHomePath = user?.user_type === 'admin' ? '/admin' : '/dashboard';

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <span>Loading…</span>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role check
  if (role && user.user_type !== role) {
    return <Navigate to={roleHomePath} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
