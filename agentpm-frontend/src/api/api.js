import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5157/api',
});

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export const setUserId = (id) => {
  if (id) {
    api.defaults.headers.common['X-User-Id'] = id;
  } else {
    delete api.defaults.headers.common['X-User-Id'];
  }
};

// Restore userId from session on page reload
const storedUserId = sessionStorage.getItem('userId');
if (storedUserId) api.defaults.headers.common['X-User-Id'] = storedUserId;

export default api;
