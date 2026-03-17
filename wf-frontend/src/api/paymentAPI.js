import api from './axiosInstance';

// Get fee preview for a given amount
export const getFeePreview = (amount) =>
  api.get('/payments/fee-preview', { params: { amount } });

// Create Razorpay order
export const createOrder = (data) => api.post('/payments/create-order', data);

// Verify payment after Razorpay checkout
export const verifyPayment = (data) => api.post('/payments/verify', data);

// Request refund for a payment
export const createRefund = (data) => api.post('/payments/refund', data);

// Get paginated payment history
export const getPaymentHistory = (params) =>
  api.get('/payments/history', { params });

// Get single payment details
export const getPaymentDetails = (paymentId) =>
  api.get(`/payments/${paymentId}`);
