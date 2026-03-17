import api from './axiosInstance';

// Browse / search all jobs (public + optional auth)
export const getAllJobs = (params) => api.get('/jobs', { params });

// Get single job detail
export const getJobById = (id) => api.get(`/jobs/${id}`);

// Create new job (seeker only)
export const createJob = (data) => api.post('/jobs', data);

// Apply for a job (worker only)
export const applyForJob = (jobId, data) =>
  api.post(`/jobs/${jobId}/apply`, data);

// Accept an application (seeker only)
export const acceptApplication = (data) =>
  api.post('/jobs/accept-application', data);

// Get applications for a job (seeker/owner only)
export const getJobApplications = (jobId) =>
  api.get(`/jobs/${jobId}/applications`);

// Update job status (in_progress, completed, cancelled, etc.)
export const updateJobStatus = (jobId, data) =>
  api.patch(`/jobs/${jobId}/status`, data);

// Get my jobs (worker sees assigned; seeker sees posted)
export const getMyJobs = (params) => api.get('/jobs/my-jobs', { params });

// Cancel a job
export const cancelJob = (jobId, data) =>
  api.patch(`/jobs/${jobId}/cancel`, data);
