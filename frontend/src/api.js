import axios from 'axios';

const getApiUrl = () => {
  let url = import.meta.env.VITE_API_URL;
  if (url && typeof url === 'string' && url.trim().startsWith('http')) {
    url = url.trim().replace(/\/+$/, '');
    if (url.endsWith('/api/auth')) {
      url = url.substring(0, url.length - 5);
    }
    if (!url.endsWith('/api')) {
      url = `${url}/api`;
    }
    return url;
  }
  return 'https://truthguard-ai-production-cefd.up.railway.app/api';
};

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL
});

// Interceptor to inject JWT Bearer Token into headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('truthguard_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- Auth API ---
export const loginUser = async (username, password) => {
  const response = await api.post('/auth/login', { username, password });
  return response.data; // { access_token, token_type }
};

export const registerUser = async (username, email, password, phone = '') => {
  const response = await api.post('/auth/register', { username, email, password, phone });
  return response.data;
};

export const verifyOTP = async (username, email_otp, phone_otp) => {
  const response = await api.post('/auth/verify-otp', { username, email_otp, phone_otp });
  return response.data;
};

export const forgotPassword = async (email) => {
  const response = await api.post('/auth/forgot-password', { email });
  return response.data;
};

export const resetPassword = async (email, resetCode, newPassword) => {
  const response = await api.post('/auth/reset-password', { email, reset_code: resetCode, new_password: newPassword });
  return response.data;
};

// --- Scans & Threat Intel API ---
export const scanUrl = async (url) => {
  const response = await api.post('/scans/scan-url', { url });
  return response.data;
};

export const scanMessage = async (message) => {
  const response = await api.post('/scans/scan-message', { message });
  return response.data;
};

export const getScanHistory = async (limit = 50, skip = 0) => {
  const response = await api.get('/scans/history', { params: { limit, skip } });
  return response.data;
};

export const getThreatReport = async (scanId) => {
  const response = await api.get(`/scans/reports/${scanId}`);
  return response.data;
};

export const getAnalytics = async () => {
  const response = await api.get('/scans/analytics');
  return response.data;
};

// --- Blacklist / Whitelist API ---
export const getBlacklist = async () => {
  const response = await api.get('/lists/blacklist');
  return response.data;
};

export const addToBlacklist = async (value, notes = '') => {
  const response = await api.post('/lists/blacklist', { value, notes });
  return response.data;
};

export const deleteFromBlacklist = async (ruleId) => {
  const response = await api.delete(`/lists/blacklist/${ruleId}`);
  return response.data;
};

export const getWhitelist = async () => {
  const response = await api.get('/lists/whitelist');
  return response.data;
};

export const addToWhitelist = async (value, notes = '') => {
  const response = await api.post('/lists/whitelist', { value, notes });
  return response.data;
};

export const deleteFromWhitelist = async (ruleId) => {
  const response = await api.delete(`/lists/whitelist/${ruleId}`);
  return response.data;
};

export const submitFeedback = async (rating, comment) => {
  const response = await api.post('/feedback', { rating, comment });
  return response.data;
};

export const getAllFeedback = async () => {
  const response = await api.get('/feedback');
  return response.data;
};

export const verifyLoginOTP = async (username, email_otp, phone_otp) => {
  const response = await api.post('/auth/verify-login-otp', { username, email_otp, phone_otp });
  return response.data;
};

export const logoutUser = async () => {
  try {
    const response = await api.post('/auth/logout');
    return response.data;
  } catch (e) {
    return { status: 'success' };
  }
};

export default api;
