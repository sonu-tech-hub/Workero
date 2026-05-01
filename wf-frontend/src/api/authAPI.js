import api from './axiosInstance';

// Register new user
export const register = (data) => api.post('/auth/register', data);

// Verify OTP after registration / forgot-password
export const verifyOTP = (data) => api.post('/auth/verify-otp', data);

// Resend OTP
export const resendOTP = (data) => api.post('/auth/resend-otp', data);

// Login
export const login = (data) => api.post('/auth/login', data);
console.log("dat is thia",login)

// Refresh access token
export const refreshToken = (refresh_token) =>
  api.post('/auth/refresh', { refresh_token });

// Forgot password (send OTP to email/mobile)
export const forgotPassword = (data) => api.post('/auth/forgot-password', data);

// Reset password with OTP
export const resetPassword = (data) => api.post('/auth/reset-password', data);

// Get current logged-in user profile
export const getCurrentUser = () => api.get('/auth/me');

// Change password (requires auth)
export const changePassword = (data) => api.put('/auth/change-password', data);

// Logout (clears refresh token server-side)
export const logout = () => api.post('/auth/logout');
