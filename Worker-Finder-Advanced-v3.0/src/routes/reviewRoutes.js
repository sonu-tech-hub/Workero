const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { verifyToken } = require('../middleware/auth');
const { validateReview, validateIdParam } = require('../middleware/validation');
const { uploadDocuments } = require('../config/cloudinary');

// Protected routes
router.post(
  '/',
  verifyToken,
  uploadDocuments.array('photos', 5),
  validateReview,
  reviewController.createReview
);

router.get('/user/:userId', validateIdParam('userId'), reviewController.getUserReviews);
router.get('/job/:jobId', verifyToken, validateIdParam('jobId'), reviewController.getJobReview);
router.put('/:reviewId/helpful', verifyToken, validateIdParam('reviewId'), reviewController.markReviewHelpful);

module.exports = router;
