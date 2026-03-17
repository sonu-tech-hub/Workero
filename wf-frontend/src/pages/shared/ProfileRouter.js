/**
 * ProfileRouter.js
 * Routes /profile and /profile/edit to correct form based on role
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import EditWorkerProfile from '../worker/EditWorkerProfile';
import EditSeekerProfile from '../seeker/EditSeekerProfile';
import WorkerDashboard   from '../worker/WorkerDashboard';
import SeekerDashboard   from '../seeker/SeekerDashboard';

export const ProfileViewRouter = () => {
  const { isWorker, isSeeker } = useAuth();
  if (isWorker) return <WorkerDashboard />;
  if (isSeeker) return <SeekerDashboard />;
  return <Navigate to="/login" replace />;
};

export const ProfileEditRouter = () => {
  const { isWorker, isSeeker } = useAuth();
  if (isWorker) return <EditWorkerProfile />;
  if (isSeeker) return <EditSeekerProfile />;
  return <Navigate to="/login" replace />;
};
