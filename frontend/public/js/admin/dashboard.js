import { api, applyTheme } from '../api.js';
import { requireAuth, logout } from '../auth.js';

applyTheme();

async function init() {
  const user = await requireAuth(['staff_admin', 'super_admin']);
  if (!user) return;

  document.getElementById('user-name').textContent = user.name;
  document.getElementById('logout-btn').addEventListener('click', logout);
  if (user.role === 'super_admin') document.getElementById('settings-link').classList.remove('hidden');

  try {
    const stats = await api.get('/api/admin/stats');
    if (!stats) return;

    document.getElementById('stat-families').textContent = stats.families;
    document.getElementById('stat-children').textContent = stats.children;

    const gradeLabels = { PK: 'Pre-K', K: 'Kinder', '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '5': '5th' };
    document.getElementById('grade-breakdown').innerHTML = stats.by_grade
      .map((g) => row(gradeLabels[g.grade] ?? g.grade, g.count, stats.children))
      .join('') || '<p class="text-muted">No data yet.</p>';

    document.getElementById('nightly-breakdown').innerHTML = stats.nightly_attendance
      .map((n) => `<div style="display:flex;justify-content:space-between;padding:.375rem 0;border-bottom:1px solid var(--border)"><span>${n.label} <span class="text-muted" style="font-size:.8rem">${n.date}</span></span><strong>${n.count}</strong></div>`)
      .join('') || '<p class="text-muted">No check-ins yet.</p>';

    const maxChurch = Math.max(...stats.by_church.map((c) => c.count), 1);
    document.getElementById('church-breakdown').innerHTML = stats.by_church
      .map((c) => row(c.home_church ?? '(None)', c.count, maxChurch))
      .join('') || '<p class="text-muted">No data yet.</p>';
  } catch (err) {
    document.getElementById('error').textContent = err.message;
    document.getElementById('error').classList.remove('hidden');
  }
}

function row(label, count, total) {
  const pct = Math.round((count / total) * 100);
  return `<div style="margin-bottom:.75rem">
    <div style="display:flex;justify-content:space-between;font-size:.875rem;margin-bottom:.25rem">
      <span>${label}</span><strong>${count}</strong>
    </div>
    <div style="background:var(--border);border-radius:4px;height:6px">
      <div style="background:var(--accent);border-radius:4px;height:6px;width:${pct}%"></div>
    </div>
  </div>`;
}

init();
