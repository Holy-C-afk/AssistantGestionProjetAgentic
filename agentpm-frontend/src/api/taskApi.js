import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:5157/api' });

export const getTasks = (params = {}) =>
  api.get('/task', { params }).then(r => r.data);

export const getTask = (id) =>
  api.get(`/task/${id}`).then(r => r.data);

export const createTask = (data) =>
  api.post('/task', data).then(r => r.data);

export const updateTask = (id, data) =>
  api.put(`/task/${id}`, data).then(r => r.data);

export const moveTask = (id, status, order) =>
  api.patch(`/task/${id}/move`, { status, order }).then(r => r.data);

export const deleteTask = (id) =>
  api.delete(`/task/${id}`).then(r => r.data);

export const getTaskComments = (id) =>
  api.get(`/task/${id}/comments`).then(r => r.data);

export const addTaskComment = (id, content, authorId) =>
  api.post(`/task/${id}/comments`, { content, authorId }).then(r => r.data);

export const deleteTaskComment = (taskId, commentId) =>
  api.delete(`/task/${taskId}/comments/${commentId}`).then(r => r.data);
