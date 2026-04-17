import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:5157/api' });

export const getSprints = (projectId) =>
  api.get('/sprint', { params: { projectId } }).then(r => r.data);

export const getSprint = (id) =>
  api.get(`/sprint/${id}`).then(r => r.data);

export const createSprint = (data) =>
  api.post('/sprint', data).then(r => r.data);

export const updateSprintGoal = (id, goal) =>
  api.patch(`/sprint/${id}/goal`, { goal }).then(r => r.data);

export const closeSprint = (id) =>
  api.post(`/sprint/${id}/close`).then(r => r.data);

export const deleteSprint = (id) =>
  api.delete(`/sprint/${id}`).then(r => r.data);

export const getSprintBoard = (id) =>
  api.get(`/sprint/${id}/board`).then(r => r.data);
