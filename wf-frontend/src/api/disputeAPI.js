import api from './axiosInstance';

// Create dispute (supports evidence photo upload via FormData)
export const createDispute = (formData) => {
  if (formData instanceof FormData) {
    return api.post('/disputes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
  return api.post('/disputes', formData);
};

// List disputes involving the current user
export const getUserDisputes = (params) =>
  api.get('/disputes', { params });

// Get single dispute details
export const getDisputeDetails = (disputeId) =>
  api.get(`/disputes/${disputeId}`);

// Update dispute status (parties or admin)
export const updateDisputeStatus = (disputeId, data) =>
  api.put(`/disputes/${disputeId}/status`, data);
