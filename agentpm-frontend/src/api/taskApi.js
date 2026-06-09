import api from './api';
export const getTasks = (params = {}) =>
  api.get('/tasks', { params }).then(r => r.data);

export const getTask = (id) =>
  api.get(`/tasks/${id}`).then(r => r.data);

export const createTask = (data) =>
  api.post('/tasks', data).then(r => r.data);

export const updateTask = (id, data) =>
  api.put(`/tasks/${id}`, data).then(r => r.data);

export const moveTask = (id, status, order) =>
  api.patch(`/tasks/${id}/move`, { status, order }).then(r => r.data);

export const patchTaskPriority = (id, priority) =>
  api.put(`/tasks/${id}`, { priority }).then(r => r.data);

export const deleteTask = (id) =>
  api.delete(`/tasks/${id}`).then(r => r.data);

export const getTaskComments = (id) =>
  api.get(`/tasks/${id}/comments`).then(r => r.data);

export const addTaskComment = (id, content, authorId) =>
  api.post(`/tasks/${id}/comments`, { content, authorId }).then(r => r.data);

export const deleteTaskComment = (taskId, commentId) =>
  api.delete(`/tasks/${taskId}/comments/${commentId}`).then(r => r.data);

export const changeTaskSprint = (taskId, sprintId) =>
  api.patch(`/tasks/${taskId}/sprint`, { sprintId: sprintId ?? null }).then(r => r.data);

export const exportTaskPdf = async (taskId, taskTitle) => {
  const res = await api.get(`/tasks/${taskId}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tache-${taskTitle?.slice(0, 40) ?? taskId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};
