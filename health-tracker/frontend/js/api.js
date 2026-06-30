// Centralized API helper for the Personal Health Tracking System frontend
const API_BASE = 'https://health-tracker-3eff.onrender.com/api';

function getToken() {
  return localStorage.getItem('pht_token');
}

function getUser() {
  const raw = localStorage.getItem('pht_user');
  return raw ? JSON.parse(raw) : null;
}

function setSession(token, user) {
  localStorage.setItem('pht_token', token);
  localStorage.setItem('pht_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('pht_token');
  localStorage.removeItem('pht_user');
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = 'index.html';
  }
}

async function apiRequest(path, { method = 'GET', body = null, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = {};
  }

  if (res.status === 401 || res.status === 403) {
    if (path !== '/auth/login' && path !== '/auth/register') {
      clearSession();
      window.location.href = 'index.html';
    }
  }

  if (!res.ok) {
    const err = new Error(data.message || 'Request failed');
    err.data = data;
    throw err;
  }

  return data;
}

function logout() {
  clearSession();
  window.location.href = 'index.html';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
