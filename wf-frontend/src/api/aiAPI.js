import api from './axiosInstance';

// ── AI endpoints ──────────────────────────────────────────────

// Get AI-ranked workers for a job
export const getAIMatchedWorkers = (params) =>
  api.get('/ai/match-workers', { params });

// Get AI price suggestion for a job
export const getAIPriceSuggestion = (params) =>
  api.get('/ai/price-suggestion', { params });

// Enhance a job description
export const enhanceJobDescription = (data) =>
  api.post('/ai/enhance-description', data);

// Worker performance analysis (workerId optional → own profile)
export const getWorkerPerformance = (workerId) =>
  api.get(`/ai/worker-performance${workerId ? `/${workerId}` : ''}`);

// Classify search intent
export const classifySearch = (query) =>
  api.get('/ai/classify-search', { params: { query } });

// Get AI dashboard insights (role-aware)
export const getDashboardInsights = () => api.get('/ai/dashboard-insights');

// Generate notification preview (admin/test)
export const getNotificationPreview = (data) =>
  api.post('/ai/notification-preview', data);
