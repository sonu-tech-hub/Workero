/**
 * SEEKER ROUTES - Advanced Worker Finder v3.0.0
 */
const express = require('express');
const router = express.Router();
const { updateSeekerProfile, uploadProfilePhoto, getSeekerProfile, getSeekerStats, getJobHistory } = require('../controllers/seekerController');
const { verifyToken, isSeeker } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { validateSeekerProfile } = require('../middleware/validation');
const { uploadProfilePhoto: uploadPhotoMiddleware } = require('../config/cloudinary');

router.get('/:seekerId', getSeekerProfile);
router.put('/profile', verifyToken, isSeeker, validateSeekerProfile, updateSeekerProfile);
router.post('/profile-photo', verifyToken, isSeeker, uploadLimiter, uploadPhotoMiddleware.single('photo'), uploadProfilePhoto);
router.get('/dashboard/stats', verifyToken, isSeeker, getSeekerStats);
router.get('/dashboard/jobs', verifyToken, isSeeker, getJobHistory);

module.exports = router;
