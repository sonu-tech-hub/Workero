import api from './axiosInstance';

// Get current user's referral info + stats
export const getReferralInfo = () => api.get('/referrals/info');

// Get paginated referral list
export const getAllReferrals = (params) =>
  api.get('/referrals/list', { params });

// Validate a referral code (public)
export const validateReferralCode = (code) =>
  api.get(`/referrals/validate/${code}`);
