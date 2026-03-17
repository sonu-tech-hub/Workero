const express = require('express');
const router = express.Router();
const disputeController = require('../controllers/disputeController');
const { verifyToken } = require('../middleware/auth');
const { validateDispute, validateIdParam } = require('../middleware/validation');
const { uploadDocuments } = require('../config/cloudinary');

// All routes are protected
router.post(
  '/',
  verifyToken,
  uploadDocuments.array('evidence', 5),
  validateDispute,
  disputeController.createDispute
);

router.get('/', verifyToken, disputeController.getUserDisputes);
router.get('/:disputeId', verifyToken, validateIdParam('disputeId'), disputeController.getDisputeDetails);
router.put('/:disputeId/status', verifyToken, validateIdParam('disputeId'), disputeController.updateDisputeStatus);

module.exports = router;
