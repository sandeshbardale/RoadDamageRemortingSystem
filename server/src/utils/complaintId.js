const { prisma } = require('../config/prisma');

/**
 * Generate a unique sequential complaint ID
 * Format: RDR-YYYY-NNNNNN
 */
const generateComplaintId = async () => {
  const year = new Date().getFullYear();
  const prefix = `RDR-${year}-`;

  // Find the last complaint with this year prefix
  const lastComplaint = await prisma.complaint.findFirst({
    where: {
      complaintId: { startsWith: prefix },
    },
    orderBy: {
      complaintId: 'desc',
    },
    select: { complaintId: true },
  });

  let nextNum = 1;
  if (lastComplaint && lastComplaint.complaintId) {
    const parts = lastComplaint.complaintId.split('-');
    const lastNum = parseInt(parts[2], 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  return `${prefix}${String(nextNum).padStart(6, '0')}`;
};

module.exports = { generateComplaintId };
