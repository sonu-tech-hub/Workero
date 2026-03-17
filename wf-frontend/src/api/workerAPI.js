import api from './axiosInstance';

// Search workers with filters + AI match
export const searchWorkers = (params) => api.get('/workers/search', { params });

// Get public worker profile
export const getWorkerProfile = (workerId) =>
  api.get(`/workers/${workerId}`);

// Update own worker profile (auth required)
export const updateWorkerProfile = (data) => api.put('/workers/profile', data);

// Upload worker profile photo (multipart)
export const uploadWorkerPhoto = (formData) =>
  api.post('/workers/profile-photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// Upload verification document (multipart)
export const uploadVerificationProof = (formData) =>
  api.post('/workers/verification-proof', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// Worker dashboard stats
export const getWorkerStats = () => api.get('/workers/dashboard/stats');

// Toggle availability
export const updateAvailability = (is_available) =>
  api.put('/workers/availability', { is_available });
