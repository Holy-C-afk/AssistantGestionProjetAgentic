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

/** Generate a sprint progress report — returns { report: string } */
export const agentReport = (sprintId) =>
  api.post('/agent/report', { sprintId }).then(r => r.data);

// ── Conversation persistence ─────────────────────────────────────────────────

/** Start a new conversation — returns ConversationDto */
export const startConversation = (projectId) =>
  api.post('/agent/conversations', { projectId }).then(r => r.data);

/** Get conversation history — returns ConversationDto */
export const getConversation = (conversationId) =>
  api.get(`/agent/conversations/${conversationId}`).then(r => r.data);

/** List conversations for a project — returns ConversationDto[] */
export const getProjectConversations = (projectId) =>
  api.get(`/agent/conversations/project/${projectId}`).then(r => r.data);
