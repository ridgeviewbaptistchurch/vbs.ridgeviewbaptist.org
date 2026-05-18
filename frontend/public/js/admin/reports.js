import { api, applyTheme } from '../api.js';
import { requireAuth, logout } from '../auth.js';

const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8787'
    : 'https://vbs-api.ridgeviewbaptist.org';

applyTheme();

async function init() {
  const user = await requireAuth(['staff_admin', 'super_admin']);
  if (!user) return;

  document.getElementById('user-name').textContent = user.name;
  document.getElementById('logout-btn').addEventListener('click', logout);
  if (user.role === 'super_admin') document.getElementById('settings-link').classList.remove('hidden');

  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      ['grades', 'attendance', 'exports'].forEach((id) => {
        document.getElementById(`tab-${id}`).classList.toggle('hidden', id !== tab.dataset.tab);
      });
    });
  });

  // Grade roster
  document.getElementById('grade-select').addEventListener('change', (e) => loadGrades(e.target.value));
  loadGrades('');

  // Attendance
  await loadSessions();
  document.getElementById('session-select').addEventListener('change', (e) => loadAttendance(e.target.value));

  // Exports
  document.getElementById('export-families').addEventListener('click', () => downloadCsv('/api/reports/export/families', 'families.csv'));
  document.getElementById('export-attendance').addEventListener('click', () => downloadCsv('/api/reports/export/attendance', 'attendance.csv'));
}

async function loadGrades(grade) {
  const tbody = document.getElementById('grade-body');
  try {
    const data = await api.get(`/api/reports/grades${grade ? `?grade=${grade}` : ''}`);
    if (!data) return;
    const gradeLabels = { '4YO': '4-Year-Old', PK: 'Pre-K', K: 'Kinder', '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '5': '5th', '6': '6th', '7': '7th' };
    tbody.innerHTML = data.children
      .map(
        (ch) => `<tr>
          <td>${ch.last_name}</td><td>${ch.first_name}</td>
          <td>${gradeLabels[ch.grade] ?? ch.grade}</td>
          <td>${ch.parent_name}</td><td>${ch.phone}</td>
          <td class="text-muted">${ch.allergies ?? ''}</td>
          <td class="text-muted">${ch.notes ?? ''}</td>
          <td>${ch.church_interest ? '✓' : ''}</td>
        </tr>`,
      )
      .join('') || '<tr><td colspan="8" class="text-muted" style="text-align:center;padding:2rem">No children found.</td></tr>';
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-muted" style="text-align:center;padding:2rem">Error loading data: ${err.message}</td></tr>`;
  }
}

async function loadSessions() {
  const data = await api.get('/api/sessions');
  if (!data) return;
  const sel = document.getElementById('session-select');
  sel.innerHTML = data.sessions.map((s) => `<option value="${s.id}">${s.label} — ${s.date}</option>`).join('');
  if (data.sessions.length) loadAttendance(data.sessions[0].id);
}

async function loadAttendance(sessionId) {
  const data = await api.get(`/api/reports/attendance?session_id=${sessionId}`);
  if (!data) return;
  const tbody = document.getElementById('att-body');
  tbody.innerHTML = data.children
    .map(
      (ch) => `<tr>
        <td>${ch.last_name}</td><td>${ch.first_name}</td><td>${ch.grade}</td>
        <td>${ch.parent_name}</td><td>${ch.phone}</td>
        <td style="width:40px">${ch.checked_in_at ? '✓' : '<span style="display:inline-block;width:18px;height:18px;border:1px solid var(--border);border-radius:3px"></span>'}</td>
      </tr>`,
    )
    .join('') || '<tr><td colspan="6" class="text-muted" style="text-align:center;padding:2rem">No children found.</td></tr>';
}

async function downloadCsv(path, filename) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

init();
