import { api, applyTheme } from '../api.js';
import { requireAuth, logout } from '../auth.js';

const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8787'
    : 'https://vbs-api.ridgeviewbaptist.org';

applyTheme();

let currentUser = null;

async function init() {
  currentUser = await requireAuth(['super_admin']);
  if (!currentUser) return;

  document.getElementById('user-name').textContent = currentUser.name;
  document.getElementById('logout-btn').addEventListener('click', logout);

  await Promise.all([loadTheme(), loadSessions(), loadUsers()]);

  document.getElementById('theme-form').addEventListener('submit', saveTheme);
  document.getElementById('add-user-btn').addEventListener('click', () =>
    document.getElementById('add-user-modal').classList.remove('hidden'),
  );
  document.getElementById('add-user-close').addEventListener('click', closeUserModal);
  document.getElementById('add-user-cancel').addEventListener('click', closeUserModal);
  document.getElementById('add-user-form').addEventListener('submit', addUser);
}

async function loadTheme() {
  const s = await api.get('/api/settings/active');
  if (!s) return;
  const form = document.getElementById('theme-form');
  form.theme_name.value = s.theme_name;
  form.accent_color.value = s.accent_color;
  if (s.logo_url) {
    const img = document.getElementById('logo-preview');
    img.src = s.logo_url.startsWith('/api') ? `${API_BASE}${s.logo_url}` : s.logo_url;
    img.style.display = '';
  }
}

async function saveTheme(e) {
  e.preventDefault();
  const form = e.target;
  const file = form.logo.files[0];

  if (file) {
    const fd = new FormData();
    fd.append('logo', file);
    await fetch(`${API_BASE}/api/settings/logo`, {
      method: 'POST',
      credentials: 'include',
      body: fd,
    });
  }

  await api.put('/api/settings', {
    theme_name: form.theme_name.value,
    accent_color: form.accent_color.value,
  });

  showSaved();
  applyTheme();
}

async function loadSessions() {
  const data = await api.get('/api/sessions');
  if (!data) return;
  const el = document.getElementById('sessions-list');
  el.innerHTML = data.sessions
    .map(
      (s) => `<div style="display:flex;gap:1rem;align-items:center;margin-bottom:.75rem">
        <input type="text" value="${s.label}" data-session-id="${s.id}" data-field="label" style="flex:1;padding:.4rem .6rem;border:1px solid var(--border);border-radius:var(--radius);font-size:.875rem">
        <input type="date" value="${s.date}" data-session-id="${s.id}" data-field="date" style="flex:1;padding:.4rem .6rem;border:1px solid var(--border);border-radius:var(--radius);font-size:.875rem">
        <button class="btn btn--secondary btn--sm save-session" data-session-id="${s.id}">Save</button>
      </div>`,
    )
    .join('');

  el.querySelectorAll('.save-session').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.sessionId;
      const label = el.querySelector(`[data-session-id="${id}"][data-field="label"]`).value;
      const date = el.querySelector(`[data-session-id="${id}"][data-field="date"]`).value;
      await api.put(`/api/sessions/${id}`, { label, date });
      showSaved();
    });
  });
}

async function loadUsers() {
  const data = await api.get('/api/users');
  if (!data) return;
  const el = document.getElementById('users-list');
  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.875rem">
    <thead><tr><th style="text-align:left;padding:.5rem;border-bottom:2px solid var(--border)">Name</th><th style="text-align:left;padding:.5rem;border-bottom:2px solid var(--border)">Email</th><th style="text-align:left;padding:.5rem;border-bottom:2px solid var(--border)">Role</th><th style="padding:.5rem;border-bottom:2px solid var(--border)"></th></tr></thead>
    <tbody>${data.users
      .map(
        (u) => `<tr>
          <td style="padding:.5rem;border-bottom:1px solid var(--border)">${u.name}</td>
          <td style="padding:.5rem;border-bottom:1px solid var(--border)">${u.email}</td>
          <td style="padding:.5rem;border-bottom:1px solid var(--border)"><span class="badge badge--gray">${u.role}</span></td>
          <td style="padding:.5rem;border-bottom:1px solid var(--border);text-align:right">
            ${u.id !== Number(currentUser.sub) ? `<button class="btn btn--danger btn--sm" onclick="deleteUser(${u.id})">Delete</button>` : '<span class="text-muted">You</span>'}
          </td>
        </tr>`,
      )
      .join('')}</tbody>
  </table>`;
}

window.deleteUser = async (id) => {
  if (!confirm('Delete this user?')) return;
  await api.delete(`/api/users/${id}`);
  loadUsers();
};

async function addUser(e) {
  e.preventDefault();
  const form = e.target;
  await api.post('/api/users', {
    name: form.name.value,
    email: form.email.value,
    password: form.password.value,
    role: form.role.value,
  });
  form.reset();
  closeUserModal();
  loadUsers();
  showSaved();
}

function closeUserModal() {
  document.getElementById('add-user-modal').classList.add('hidden');
}

function showSaved() {
  const el = document.getElementById('save-msg');
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

init();
