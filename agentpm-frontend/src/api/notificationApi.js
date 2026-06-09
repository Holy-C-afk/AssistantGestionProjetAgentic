import api from './api';

export const getNotifications = (unreadOnly = false) =>
  api.get('/notifications', { params: unreadOnly ? { unreadOnly: true } : {} }).then(r => r.data);

export const markRead = (id) =>
  api.patch(`/notifications/${id}/read`).then(r => r.data);

export const markAllRead = () =>
  api.patch('/notifications/read-all').then(r => r.data);

export const deleteNotification = (id) =>
  api.delete(`/notifications/${id}`).then(r => r.data);
