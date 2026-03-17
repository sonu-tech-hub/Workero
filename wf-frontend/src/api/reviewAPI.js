import api from './axiosInstance';

// Create a review (supports photo upload via FormData)
export const createReview = (formData) => {
  if (formData instanceof FormData) {
    return api.post('/reviews', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
  return api.post('/reviews', formData);
};

// Get all reviews for a user
export const getUserReviews = (userId, params) =>
  api.get(`/reviews/user/${userId}`, { params });

// Get reviews tied to a specific job (auth required)
export const getJobReview = (jobId) => api.get(`/reviews/job/${jobId}`);

// Mark a review as helpful
export const markReviewHelpful = (reviewId) =>
  api.put(`/reviews/${reviewId}/helpful`);
