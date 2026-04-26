import { api } from './api.js';

export async function requireAuth(allowedRoles = null) {
  try {
    const user = await api.get('/api/auth/me');
    if (!user) return null; // redirected to /login
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      window.location.href = '/login/';
      return null;
    }
    return user;
  } catch {
    window.location.href = '/login/';
    return null;
  }
}

export async function logout() {
  await api.post('/api/auth/logout');
  window.location.href = '/login/';
}
