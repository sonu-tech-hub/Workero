/**
 * ============================================================
 * NOTIFICATION API UTILITIES - Worker Finder v3.0.0
 * ============================================================
 */

import api from './axiosInstance';

export const getNotifications = (params) => {
  return api.get('/notifications', { params });
};

export const markNotificationAsRead = (id) => {
  return api.patch(`/notifications/${id}/read`);
};

export const markAllNotificationsAsRead = (data) => {
  return api.post('/notifications/read-all', data);
};
