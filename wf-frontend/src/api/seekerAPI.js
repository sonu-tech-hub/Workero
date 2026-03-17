import api from './axiosInstance';

// Get public seeker profile
export const getSeekerProfile = (seekerId) =>
  api.get(`/seekers/${seekerId}`);

// Update own seeker profile (auth required)
export const updateSeekerProfile = (data) => api.put('/seekers/profile', data);

// Upload seeker profile photo (multipart)
export const uploadSeekerPhoto = (formData) =>
  api.post('/seekers/profile-photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// Seeker dashboard stats
export const getSeekerStats = () => api.get('/seekers/dashboard/stats');

// Seeker job history with optional status filter
export const getSeekerJobHistory = (params) =>
  api.get('/seekers/dashboard/jobs', { params });
