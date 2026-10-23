const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, adminOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  getComplaints,
  getComplaintDetail,
  updateStatus,
  getDashboard,
  getAnalytics,
  getMapData,
  getReports,
  exportReports,
  getDuplicates,
} = require('../controllers/adminController');

// All admin routes require authentication + admin role
router.use(protect, adminOnly);

router.get('/dashboard', getDashboard);
router.get('/analytics', getAnalytics);
router.get('/map', getMapData);
router.get('/reports/export', exportReports);
router.get('/reports', getReports);
router.get('/duplicates', getDuplicates);

router.get('/complaints', getComplaints);
router.get('/complaints/:id', getComplaintDetail);
router.patch(
  '/complaints/:id/status',
  [
    body('status')
      .isIn(['REPORTED', 'RECEIVED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
      .withMessage('Valid status required'),
    body('comment').optional().isLength({ max: 500 }).withMessage('Comment max 500 characters'),
  ],
  validate,
  updateStatus
);

module.exports = router;
