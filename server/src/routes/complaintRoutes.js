const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { handleUpload } = require('../middleware/upload');
const { validate } = require('../middleware/validate');
const {
  checkDuplicate,
  createComplaint,
  getMyComplaints,
  getComplaintById,
  getStatusHistory,
  getNearbyComplaints,
  getMapComplaints,
} = require('../controllers/complaintController');

// Public
router.get('/map', getMapComplaints);
router.get('/nearby', getNearbyComplaints);

// Protected — citizen + admin
router.use(protect);

router.post(
  '/check-duplicate',
  [
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
    body('damageCategory')
      .isIn(['POTHOLE', 'CRACK', 'EDGE_FAILURE', 'WATERLOGGING', 'SURFACE_DAMAGE', 'OTHER'])
      .withMessage('Valid damage category required'),
  ],
  validate,
  checkDuplicate
);

router.post(
  '/',
  handleUpload('image'),
  [
    body('damageCategory')
      .isIn(['POTHOLE', 'CRACK', 'EDGE_FAILURE', 'WATERLOGGING', 'SURFACE_DAMAGE', 'OTHER'])
      .withMessage('Valid damage category required'),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Description max 1000 characters'),
  ],
  validate,
  createComplaint
);

router.get('/my', getMyComplaints);
router.get('/:id/status-history', getStatusHistory);
router.get('/:id', getComplaintById);

module.exports = router;
