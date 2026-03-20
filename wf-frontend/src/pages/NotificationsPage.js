import React from 'react';
import { markNotificationAsRead } from '../api/notificationAPI';
import { formatDate, extractError } from '../utils/helpers';
import { useNotification } from '../context/NotificationContext';

const NotificationsPage = () => {
  const { notifications, setNotifications, addToast } = useNotification();

  const handleMarkAsRead = async (notificationId) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification || notification.is_read) {
      return;
    }

    try {
      // Optimistic UI update for a smoother experience
      setNotifications(currentNotifications =>
        currentNotifications.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      await markNotificationAsRead(notificationId);
    } catch (e) {
      addToast(`Error: ${extractError(e)}`, 'error');
      // Revert UI update on error
      setNotifications(currentNotifications =>
        currentNotifications.map(n =>
          n.id === notificationId ? { ...n, is_read: false } : n
        )
      );
    }
  };

  const renderNotificationItem = (notification) => {
    const isRead = notification.is_read;
    const cardStyle = {
      background: isRead ? '#fff' : '#eff6ff', // white for read, light blue for unread
      borderRadius: '12px',
      padding: '16px 20px',
      boxShadow: '0 2px 8px rgba(0,0,0,.06)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '16px',
      borderLeft: `4px solid ${isRead ? '#e5e7eb' : '#3b82f6'}` // gray for read, blue for unread
    };

    const titleStyle = {
      fontWeight: isRead ? 500 : 700, // bold for unread
      fontSize: '15px',
      color: '#1f2937',
      marginBottom: '4px'
    };

    return (
      <div key={notification.id} style={cardStyle}>
        {!isRead && (
          <div
            onClick={() => handleMarkAsRead(notification.id)}
            title="Mark as read"
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#3b82f6',
              flexShrink: 0,
              marginTop: '5px',
              cursor: 'pointer'
            }}
          />
        )}
        <div style={{ flex: 1, marginLeft: isRead ? '26px' : '0' }}>
          <div style={titleStyle}>{notification.title}</div>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
            {notification.body || notification.message}
          </p>
          <p style={{ fontSize: '12px', color: '#9ca3af', margin: '8px 0 0' }}>
            {formatDate(notification.created_at)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
        🔔 Notifications
      </h2>

      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 12, color: '#9ca3af', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: 48 }}>🔔</div>
          <p>No notifications yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifications.map(renderNotificationItem)}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;