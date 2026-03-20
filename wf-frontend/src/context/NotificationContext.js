/**
 * NotificationContext.js
 * Handles:
 * - Unread message count polling every 10 seconds
 * - In-app toast queue
 * - Socket.io real-time events (new_message, job_update, payment_received)
 */
import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef
} from 'react';
import { io } from 'socket.io-client';
import { getUnreadCount } from '../api/messageAPI';
import { getNotifications } from '../api/notificationAPI';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
const POLL_INTERVAL = 30_000; // 30 s

export const NotificationProvider = ({ children }) => {
  const { user, isAuth }       = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts]    = useState([]);
  const socketRef              = useRef(null);
  const pollRef                = useRef(null);

  // ── Toast helpers ─────────────────────────────────────────
  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), duration);
  }, []); // eslint-disable-line

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Poll unread count ─────────────────────────────────────
  const pollUnread = useCallback(async () => {
    if (!isAuth) return;
    try {
      const { data } = await getUnreadCount();
      setUnreadMessages(data.data?.unread_count ?? 0);
    } catch { /* silently ignore */ }
  }, [isAuth]);

  useEffect(() => {
    if (!isAuth) {
      setUnreadMessages(0);
      return;
    }
    pollUnread();
    pollRef.current = setInterval(pollUnread, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [isAuth, pollUnread]);

  const fetchNotifications = useCallback(async () => {
    if (!isAuth) return;
    try {
      const { data } = await getNotifications();
      setNotifications(data.data?.notifications || []);
    } catch (e) {
      // Log errors for easier debugging, but don't show a toast to the user
      console.error('[NotificationContext] Failed to fetch notifications:', e);
    }
  }, [isAuth]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // ── Socket.io connection ──────────────────────────────────
  useEffect(() => {
    if (!isAuth || !user) return;

    const token = localStorage.getItem('accessToken');
    const socket = io(SOCKET_URL, {
      auth:              { token },
      transports:        ['websocket', 'polling'],
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.emit('join:room', { roomId: `user:${user.id}` });

    socket.on('new_message', (msg) => {
      setUnreadMessages((c) => c + 1);
      addToast(`💬 New message from ${msg.sender_name || 'someone'}`, 'info');
    });

    // notifaction fix---

    socket.on('notification:new', (notification) => {
      addToast(notification.title || 'New notification', 'info');
      fetchNotifications();
    });

    socket.on('job_update', (job) => {
      addToast(`📋 Job "${job.title}" status: ${job.status}`, 'success');
    });

    socket.on('payment_received', (p) => {
      addToast(`💰 Payment ₹${p.amount} received!`, 'success');
    });

    socket.on('new_application', (data) => {
      addToast(`👷 New application for "${data.job_title}"`, 'info');
    });

    socket.on('dispute_update', (d) => {
      addToast(`⚠️ Dispute update: ${d.status}`, 'warning');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuth, user, addToast]);

  return (
    <NotificationContext.Provider value={{
      unreadMessages, setUnreadMessages,
      notifications, setNotifications,
      toasts, addToast, removeToast,
      socket: socketRef.current
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
};
