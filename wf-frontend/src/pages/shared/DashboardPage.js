/**
 * DashboardPage.js
 * Routes worker/seeker users to their dashboard.
 * Admins are redirected to the admin dashboard.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import WorkerDashboard from '../worker/WorkerDashboard';
import SeekerDashboard from '../seeker/SeekerDashboard';

const DashboardPage = () => {
  const { user, isWorker, isSeeker, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (isWorker) return <WorkerDashboard />;
  if (isSeeker) return <SeekerDashboard />;
  return <Navigate to="/login" replace />;
};

export default DashboardPage;
