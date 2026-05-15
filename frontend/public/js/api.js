const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8787'
    : 'https://vbs-api.ridgeviewbaptist.org';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (res.status === 401) {
    window.location.href = '/login/';
    return null;
  }

  const contentType = res.headers.get('Content-Type') ?? '';
  if (contentType.includes('text/csv')) {
    return res; // caller handles blob
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
  return data;
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => apiFetch(path, { method: 'DELETE' }),
  postForm: (path, formData) =>
    fetch(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }).then((r) => r.json()),
};

export async function applyTheme() {
  try {
    const s = await api.get('/api/settings/active');
    if (!s) return;
    document.documentElement.style.setProperty('--accent', s.accent_color);
    document.title = s.theme_name;
    document.querySelectorAll('[data-theme-name]').forEach((el) => (el.textContent = s.theme_name));
    document.querySelectorAll('[data-theme-logo]').forEach((el) => {
      if (s.logo_url) { el.src = s.logo_url; el.style.display = ''; }
    });
  } catch {
    // non-fatal
  }
}
