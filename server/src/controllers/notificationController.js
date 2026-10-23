const { prisma } = require('../config/prisma');
const { success, error } = require('../utils/apiResponse');

// GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const where = { userId: req.user.id };
    if (req.query.unread === 'true') where.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);

    const mapped = notifications.map((n) => ({ ...n, _id: n.id }));

    return success(
      res,
      {
        notifications: mapped,
        unreadCount,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
      'Notifications retrieved.'
    );
  } catch (err) {
    console.error('Get notifications error:', err);
    return error(res, 'Failed to retrieve notifications.', 500);
  }
};

// PATCH /api/notifications/:id/read
const markRead = async (req, res) => {
  try {
    const notification = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead: true },
    });

    if (notification.count === 0) return error(res, 'Notification not found.', 404);

    const updated = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (updated) updated._id = updated.id;

    return success(res, { notification: updated }, 'Notification marked as read.');
  } catch (err) {
    console.error('Mark read error:', err);
    return error(res, 'Failed to update notification.', 500);
  }
};

// PATCH /api/notifications/read-all
const markAllRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    return success(res, {}, 'All notifications marked as read.');
  } catch (err) {
    console.error('Mark all read error:', err);
    return error(res, 'Failed to update notifications.', 500);
  }
};

module.exports = { getNotifications, markRead, markAllRead };
