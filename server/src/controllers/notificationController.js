const Notification = require('../models/Notification');
const { success, error } = require('../utils/apiResponse');

// GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const filter = { userId: req.user._id };
    if (req.query.unread === 'true') filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: req.user._id, isRead: false }),
    ]);

    return success(res, {
      notifications,
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, 'Notifications retrieved.');
  } catch (err) {
    console.error('Get notifications error:', err);
    return error(res, 'Failed to retrieve notifications.', 500);
  }
};

// PATCH /api/notifications/:id/read
const markRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!notification) return error(res, 'Notification not found.', 404);
    return success(res, { notification }, 'Notification marked as read.');
  } catch (err) {
    return error(res, 'Failed to update notification.', 500);
  }
};

// PATCH /api/notifications/read-all
const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
    return success(res, {}, 'All notifications marked as read.');
  } catch (err) {
    return error(res, 'Failed to update notifications.', 500);
  }
};

module.exports = { getNotifications, markRead, markAllRead };
