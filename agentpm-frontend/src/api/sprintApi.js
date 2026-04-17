import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:5157/api' });

export const getSprints = (projectId) =>
  api.get('/sprints', { params: { projectId } }).then(r => r.data);

export const getSprint = (id) =>
  api.get(`/sprints/${id}`).then(r => r.data);

export const createSprint = (data) =>
  api.post('/sprints', data).then(r => r.data);

export const updateSprintGoal = (id, goal) =>
  api.patch(`/sprints/${id}/goal`, { goal }).then(r => r.data);

export const closeSprint = (id) =>
  api.post(`/sprints/${id}/close`).then(r => r.data);

export const deleteSprint = (id) =>
  api.delete(`/sprints/${id}`).then(r => r.data);

export const getSprintBoard = (id) =>
  api.get(`/sprints/${id}/board`).then(r => r.data);
