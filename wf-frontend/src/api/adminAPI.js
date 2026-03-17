import api from './axiosInstance';

// ── Admin endpoints (admin role required) ────────────────────

export const getAdminDashboard = () => api.get('/admin/dashboard');

export const getAllUsers = (params) => api.get('/admin/users', { params });

export const toggleUserStatus = (userId, data) =>
  api.patch(`/admin/users/${userId}/status`, data);

export const getAnalytics = (period = 30) =>
  api.get('/admin/analytics', { params: { period } });

export const getAdminDisputes = (params) =>
  api.get('/admin/disputes', { params });

export const resolveDispute = (id, data) =>
  api.patch(`/admin/disputes/${id}/resolve`, data);

export const sendMassNotification = (data) =>
  api.post('/admin/notify-all', data);

export const getPlatformRevenue = () => api.get('/admin/revenue');

export const manageCaches = (action) =>
  api.post('/admin/cache', { action });
