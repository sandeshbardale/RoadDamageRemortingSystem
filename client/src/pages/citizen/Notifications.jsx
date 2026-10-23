import React from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useNotifications } from '../../context/NotificationContext'
import { formatDateTime } from '../../utils/helpers'

const TYPE_COLORS = {
  COMPLAINT_RECEIVED: 'bg-blue-100 text-blue-600',
  STATUS_UPDATE:      'bg-orange-100 text-orange-600',
  COMPLAINT_RESOLVED: 'bg-green-100 text-green-600',
  COMPLAINT_CLOSED:   'bg-gray-100 text-gray-500',
  GENERAL:            'bg-gray-100 text-gray-500',
}

export default function Notifications() {
  const { notifications, markRead, markAllRead, unreadCount } = useNotifications()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && <p className="text-sm text-gray-500 mt-1">{unreadCount} unread</p>}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn-secondary flex items-center gap-2 text-sm">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n._id}
              onClick={() => !n.isRead && markRead(n._id)}
              className={`card cursor-pointer transition-all border-l-4 ${n.isRead ? 'border-gray-200 opacity-70' : 'border-primary-500 shadow-sm hover:shadow-md'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg flex-shrink-0 ${TYPE_COLORS[n.type] || TYPE_COLORS.GENERAL}`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${n.isRead ? 'text-gray-600' : 'text-gray-900'}`}>{n.title}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(n.createdAt)}</p>
                </div>
                {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1.5" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
