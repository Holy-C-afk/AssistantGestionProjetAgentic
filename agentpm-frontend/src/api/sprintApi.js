import api from './api';
export const getSprints = (projectId) =>
  api.get(`/project/${projectId}/sprints`).then(r => r.data);

export const getSprint = (projectId, sprintId) =>
  api.get(`/project/${projectId}/sprints/${sprintId}`).then(r => r.data);

export const createSprint = (projectId, data) =>
  api.post(`/project/${projectId}/sprints`, data).then(r => r.data);

export const updateSprintGoal = (projectId, sprintId, goal) =>
  api.patch(`/project/${projectId}/sprints/${sprintId}/goal`, { goal }).then(r => r.data);

export const closeSprint = (projectId, sprintId) =>
  api.post(`/project/${projectId}/sprints/${sprintId}/close`).then(r => r.data);

export const deleteSprint = (projectId, sprintId) =>
  api.delete(`/project/${projectId}/sprints/${sprintId}`).then(r => r.data);

export const getSprintBoard = (projectId, sprintId) =>
  api.get(`/project/${projectId}/sprints/${sprintId}/board`).then(r => r.data);