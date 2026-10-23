const Complaint = require('../models/Complaint');

/**
 * Generate a unique sequential complaint ID
 * Format: RDR-YYYY-NNNNNN
 */
const generateComplaintId = async () => {
  const year = new Date().getFullYear();
  const prefix = `RDR-${year}-`;

  // Find the last complaint with this year prefix
  const lastComplaint = await Complaint.findOne(
    { complaintId: { $regex: `^${prefix}` } },
    { complaintId: 1 },
    { sort: { complaintId: -1 } }
  );

  let nextNum = 1;
  if (lastComplaint) {
    const parts = lastComplaint.complaintId.split('-');
    const lastNum = parseInt(parts[2], 10);
    nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(6, '0')}`;
};

module.exports = { generateComplaintId };
