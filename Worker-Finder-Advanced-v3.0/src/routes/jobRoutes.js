/**
 * JOB ROUTES - Advanced Worker Finder v3.0.0
 */
const express = require('express');
const router = express.Router();
const {
  createJob, getAllJobs, getJobById, applyForJob, acceptApplication,
  updateJobStatus, getMyJobs, getJobApplications, searchJobs
} = require('../controllers/jobController');
const { verifyToken, isSeeker, isWorker } = require('../middleware/auth');
const { searchLimiter } = require('../middleware/rateLimiter');
const { validateCreateJob, validateJobStatus, validateIdParam } = require('../middleware/validation');

// Public routes
router.get('/', getAllJobs);

// Protected routes
router.get('/search', verifyToken, isWorker, searchLimiter, searchJobs);
router.get('/my-jobs', verifyToken, getMyJobs);

router.get('/:id', validateIdParam('id'), getJobById); // This must be after specific GET routes
router.post('/', verifyToken, isSeeker, validateCreateJob, createJob);
router.post('/:id/apply', verifyToken, isWorker, validateIdParam('id'), applyForJob);
router.post('/accept-application', verifyToken, isSeeker, acceptApplication);
router.get('/:id/applications', verifyToken, isSeeker, validateIdParam('id'), getJobApplications);
router.patch('/:id/status', verifyToken, validateIdParam('id'), validateJobStatus, updateJobStatus);

module.exports = router;
