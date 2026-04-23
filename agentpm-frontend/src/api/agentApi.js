import api from './api';

/** Free-form AI chat — returns { reply: string } */
export const agentChat = (message, projectId = null) =>
  api.post('/agent/chat', { message, projectId }).then(r => r.data);

/** Decompose a task into sub-tasks — returns { subTasks: string[] } */
export const agentDecompose = (title, description = '') =>
  api.post('/agent/decompose', { title, description }).then(r => r.data);

/** Estimate story points — returns { storyPoints: number } */
export const agentEstimate = (title, description = '') =>
  api.post('/agent/estimate', { title, description }).then(r => r.data);

/** Semantic task search — returns { tasks: string[] } */
export const agentSearch = (query, projectId) =>
  api.post('/agent/search', { query, projectId }).then(r => r.data);
