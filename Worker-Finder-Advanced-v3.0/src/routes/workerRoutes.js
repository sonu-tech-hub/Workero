/**
 * WORKER ROUTES - Advanced Worker Finder v3.0.0
 */
const express = require('express');
const router = express.Router();
const {
  updateWorkerProfile, uploadProfilePhoto, uploadVerificationProof,
  getWorkerProfile, searchWorkers, getWorkerStats, updateAvailability
} = require('../controllers/workerController');
const { verifyToken, isWorker } = require('../middleware/auth');
const { searchLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const { validateWorkerProfile, validateWorkerSearch, validateIdParam } = require('../middleware/validation');
const { uploadProfilePhoto: uploadPhotoMiddleware, uploadDocuments } = require('../config/cloudinary');

// Public routes
router.get('/search', searchLimiter, validateWorkerSearch, searchWorkers);
router.get('/:workerId', validateIdParam('workerId'), getWorkerProfile);

// Protected routes (worker only)
router.put('/profile', verifyToken, isWorker, validateWorkerProfile, updateWorkerProfile);
router.post('/profile-photo', verifyToken, isWorker, uploadLimiter,
  uploadPhotoMiddleware.single('photo'), uploadProfilePhoto);
router.post('/verification-proof', verifyToken, isWorker, uploadLimiter,
  uploadDocuments.single('document'), uploadVerificationProof);
router.get('/dashboard/stats', verifyToken, isWorker, getWorkerStats);
router.put('/availability', verifyToken, isWorker, updateAvailability);

module.exports = router;
