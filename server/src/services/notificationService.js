const { prisma } = require('../config/prisma');

const STATUS_MESSAGES = {
  REPORTED: {
    title: 'Complaint Received',
    message: (id) => `Your complaint ${id} has been received and is under review.`,
    type: 'COMPLAINT_RECEIVED',
  },
  RECEIVED: {
    title: 'Complaint Acknowledged',
    message: (id) => `Your complaint ${id} has been acknowledged by the municipal corporation.`,
    type: 'STATUS_UPDATE',
  },
  IN_PROGRESS: {
    title: 'Work In Progress',
    message: (id) => `Your complaint ${id} is now In Progress. Our team is working on it.`,
    type: 'STATUS_UPDATE',
  },
  RESOLVED: {
    title: 'Complaint Resolved',
    message: (id) => `Your road damage complaint ${id} has been resolved.`,
    type: 'COMPLAINT_RESOLVED',
  },
  CLOSED: {
    title: 'Complaint Closed',
    message: (id) => `Your complaint ${id} has been closed.`,
    type: 'COMPLAINT_CLOSED',
  },
};

/**
 * Create a notification for a citizen about their complaint status
 */
const createStatusNotification = async (userId, complaintId, complaintRefId, status) => {
  try {
    const template = STATUS_MESSAGES[status];
    if (!template) return null;

    const notification = await prisma.notification.create({
      data: {
        userId,
        complaintId: complaintRefId || null,
        title: template.title,
        message: template.message(complaintId),
        type: template.type,
      },
    });

    return notification;
  } catch (err) {
    console.error('Notification creation error:', err.message);
    return null;
  }
};

module.exports = { createStatusNotification };
