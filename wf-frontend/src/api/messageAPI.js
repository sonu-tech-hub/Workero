import api from './axiosInstance';

// Send a message (supports optional media upload via FormData)
export const sendMessage = (data) => {
  if (data instanceof FormData) {
    return api.post('/messages', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
  return api.post('/messages', data);
};

// Get paginated conversation with a specific user
export const getConversation = (otherUserId, params) =>
  api.get(`/messages/conversation/${otherUserId}`, { params });

// Get all conversation threads
export const getConversationList = () => api.get('/messages/conversations');

// Get unread message count
export const getUnreadCount = () => api.get('/messages/unread-count');

// Mark messages from a user as read
export const markAsRead = (otherUserId) =>
  api.put(`/messages/read/${otherUserId}`);
