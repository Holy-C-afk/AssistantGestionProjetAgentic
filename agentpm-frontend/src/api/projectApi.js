import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5157/api',
});

export const getMyProjects = (params = {}) =>
  api.get('/project', { params }).then(r => r.data);

export const getProjectById = (id) =>
  api.get(`/project/${id}`).then(r => r.data);

export const createProject = (data) =>
  api.post('/project', data).then(r => r.data);

export const updateProject = (id, data) =>
  api.put(`/project/${id}`, data).then(r => r.data);

export const deleteProject = (id) =>
  api.delete(`/project/${id}`).then(r => r.data);

export const getProjectMembers = (id) =>
  api.get(`/project/${id}/members`).then(r => r.data);

export const addMember = (projectId, data) =>
  api.post(`/project/${projectId}/members`, data).then(r => r.data);

export const removeMember = (projectId, userId) =>
  api.delete(`/project/${projectId}/members/${userId}`).then(r => r.data);

export const getMe = () =>
  api.get('/auth/me').then(r => r.data);

export const downloadProjectPdf = async (id, projectName) => {
  const response = await api.get(`/project/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `project_${projectName.replace(/\s+/g, '_')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};
