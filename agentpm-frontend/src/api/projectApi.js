import api from './api';

export const getMyProjects = () =>
  api.get('/project').then(r => r.data);

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
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${projectName}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};