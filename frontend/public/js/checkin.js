import { api, applyTheme } from './api.js';
import { requireAuth, logout } from './auth.js';

applyTheme();

let currentUser = null;
let currentSessionId = null;
let searchTimeout = null;

async function init() {
  currentUser = await requireAuth();
  if (!currentUser) return;

  document.getElementById('user-name').textContent = currentUser.name;
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('search-input').addEventListener('input', onSearch);
  document.getElementById('walkin-btn').addEventListener('click', () => showWalkInForm());
  document.getElementById('walkin-cancel').addEventListener('click', hideWalkInForm);
  document.getElementById('walkin-form').addEventListener('submit', submitWalkIn);
  document.getElementById('walkin-add-child').addEventListener('click', addWalkInChild);

  await loadSessions();
  loadStats(currentSessionId);
}

async function loadSessions() {
  const select = document.getElementById('session-select');
  try {
    const data = await api.get('/api/checkin/sessions');
    if (!data?.sessions?.length) {
      select.innerHTML = '<option value="">No sessions found</option>';
      return;
    }

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    const sessions = data.sessions;

    const todayIdx = sessions.findIndex((s) => s.date === today);
    const pastSessions = sessions.filter((s) => s.date < today);
    const best =
      todayIdx !== -1 ? sessions[todayIdx] :
      pastSessions.length ? pastSessions[pastSessions.length - 1] :
      sessions[0];

    select.innerHTML = sessions
      .map((s) => `<option value="${s.id}">${s.label} — ${formatDate(s.date)}</option>`)
      .join('');
    select.value = String(best.id);
    currentSessionId = best.id;

    select.addEventListener('change', () => {
      currentSessionId = Number(select.value);
      loadStats(currentSessionId);
      const q = document.getElementById('search-input').value.trim();
      if (q) search(q);
    });
  } catch (err) {
    console.error('loadSessions failed:', err);
    select.innerHTML = '<option value="">Could not load sessions</option>';
  }
}

async function loadStats(sessionId) {
  try {
    const url = sessionId ? `/api/checkin/stats?session_id=${sessionId}` : '/api/checkin/stats';
    const data = await api.get(url);
    if (!data) return;
    document.getElementById('stat-total').textContent = data.total_children;
    document.getElementById('stat-checkedin').textContent = data.checked_in;
  } catch (err) {
    console.error('loadStats failed:', err);
  }
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function onSearch(e) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => search(e.target.value.trim()), 250);
}

async function search(q) {
  if (!q) { document.getElementById('results').innerHTML = ''; return; }
  try {
    const sessionParam = currentSessionId ? `&session_id=${currentSessionId}` : '';
    const data = await api.get(`/api/checkin/search?q=${encodeURIComponent(q)}${sessionParam}`);
    if (!data) return;
    if (!currentSessionId) currentSessionId = data.session_id;
    renderResults(data.families);
  } catch (err) {
    document.getElementById('results').innerHTML = `<p class="alert alert--error">${err.message}</p>`;
  }
}

function renderResults(families) {
  const el = document.getElementById('results');
  if (!families.length) {
    el.innerHTML = '<p class="text-muted">No families found.</p>';
    return;
  }
  el.innerHTML = families.map((f) => familyCard(f)).join('');
  el.querySelectorAll('[data-checkin]').forEach((btn) => {
    btn.addEventListener('click', () => checkIn(btn.dataset.checkin, btn.dataset.session));
  });
  if (currentUser.role === 'super_admin') {
    el.querySelectorAll('[data-undo]').forEach((btn) => {
      btn.addEventListener('click', () => undoCheckIn(btn.dataset.undo));
    });
  }
}

function familyCard(family) {
  const children = family.children
    .map((ch) => {
      const checkedIn = ch.checked_in_at;
      const time = checkedIn ? new Date(ch.checked_in_at.replace(' ', 'T') + 'Z').toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }) : '';
      const action = checkedIn
        ? `<span class="badge badge--green">✓ Checked in ${time}</span>
           ${currentUser?.role === 'super_admin' ? `<button class="btn btn--sm btn--secondary" data-undo="${ch.attendance_id}" style="margin-left:.5rem">Undo</button>` : ''}`
        : `<button class="btn btn--primary btn--sm" data-checkin="${ch.id}" data-session="${currentSessionId}">Check In</button>`;
      const notes = ch.notes ? `<span class="text-muted" style="font-size:.8rem"> — ${ch.notes}</span>` : '';
      return `<div class="child-row">
        <div><strong>${ch.first_name} ${ch.last_name}</strong> <span class="badge badge--gray">${ch.grade}</span>${notes}</div>
        <div>${action}</div>
      </div>`;
    })
    .join('');

  return `<div class="family-card card" style="padding:0;overflow:hidden">
    <div style="padding:.875rem 1rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <div><strong>${family.parent_name}</strong> <span class="text-muted">${family.phone}</span></div>
      <span class="badge badge--blue">${family.children.length} child${family.children.length !== 1 ? 'ren' : ''}</span>
    </div>
    ${children}
  </div>`;
}

async function checkIn(childId, sessionId) {
  try {
    await api.post('/api/checkin', { child_id: Number(childId), session_id: Number(sessionId) });
    search(document.getElementById('search-input').value.trim());
  } catch (err) {
    alert(err.message);
  }
}

async function undoCheckIn(attendanceId) {
  if (!confirm('Remove this check-in?')) return;
  try {
    await api.delete(`/api/checkin/${attendanceId}`);
    search(document.getElementById('search-input').value.trim());
  } catch (err) {
    alert(err.message);
  }
}

// Walk-in form
function showWalkInForm() {
  document.getElementById('walkin-section').classList.remove('hidden');
  const list = document.getElementById('walkin-children');
  list.innerHTML = '';
  addWalkInChild();
}

function hideWalkInForm() {
  document.getElementById('walkin-section').classList.add('hidden');
  document.getElementById('walkin-form').reset();
}

function addWalkInChild() {
  const list = document.getElementById('walkin-children');
  const div = document.createElement('div');
  div.className = 'card';
  div.style.cssText = 'padding:1rem;margin-bottom:.75rem;position:relative';
  div.innerHTML = `
    <button type="button" class="btn btn--sm remove-child" style="position:absolute;top:.5rem;right:.5rem;background:none;border:none;cursor:pointer;font-size:1.25rem;color:var(--muted)">×</button>
    <div class="form-row">
      <div class="form-group"><label>First Name *</label><input type="text" name="first_name" required></div>
      <div class="form-group"><label>Last Name *</label><input type="text" name="last_name" required></div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Grade *</label>
        <select name="grade" required>
          <option value="">Select…</option>
          <option value="4YO">4 Years Old</option>
          <option value="PK">Pre-K</option>
          <option value="K">Finished Kindergarten</option>
          <option value="1">Finished 1st Grade</option>
          <option value="2">Finished 2nd Grade</option>
          <option value="3">Finished 3rd Grade</option>
          <option value="4">Finished 4th Grade</option>
          <option value="5">Finished 5th Grade</option>
          <option value="6">Finished 6th Grade</option>
          <option value="7">Finished 7th Grade</option>
        </select>
      </div>
      <div class="form-group">
        <label>Gender *</label>
        <div style="display:flex;gap:1.5rem;margin-top:.5rem">
          <label style="font-weight:normal;display:flex;align-items:center;gap:.4rem"><input type="radio" name="gender" value="M" required> Male</label>
          <label style="font-weight:normal;display:flex;align-items:center;gap:.4rem"><input type="radio" name="gender" value="F"> Female</label>
        </div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Allergies <span class="text-muted">(optional)</span></label>
        <input type="text" name="allergies" placeholder="Food, medication, or other allergies…">
      </div>
      <div class="form-group">
        <label>Notes <span class="text-muted">(optional)</span></label>
        <input type="text" name="notes" placeholder="Special needs, other info…">
      </div>
    </div>`;
  div.querySelector('.remove-child').addEventListener('click', () => div.remove());
  list.appendChild(div);
}

async function submitWalkIn(e) {
  e.preventDefault();
  const form = e.target;
  const parentName = form.parent_name.value.trim();
  const children = [...document.querySelectorAll('#walkin-children > div')].map((el) => ({
    first_name: el.querySelector('[name=first_name]').value.trim(),
    last_name: el.querySelector('[name=last_name]').value.trim(),
    grade: el.querySelector('[name=grade]').value,
    gender: el.querySelector('[name=gender]:checked')?.value || null,
    allergies: el.querySelector('[name=allergies]').value.trim() || null,
    notes: el.querySelector('[name=notes]').value.trim() || null,
  }));

  try {
    const result = await api.post('/api/register', {
      parent_name: parentName,
      phone: form.phone.value.trim(),
      email: form.email.value.trim() || 'walkin@noemail.local',
      home_church: form.home_church.value.trim(),
      children,
    });
    hideWalkInForm();
    const searchTerm = parentName.split(' ').pop();
    document.getElementById('search-input').value = searchTerm;

    const sessionParam = currentSessionId ? `&session_id=${currentSessionId}` : '';
    const data = await api.get(`/api/checkin/search?q=${encodeURIComponent(searchTerm)}${sessionParam}`);
    if (!data) return;
    if (!currentSessionId) currentSessionId = data.session_id;

    const newFamily = data.families.find((f) => f.id === result.family_id);
    if (newFamily && currentSessionId) {
      await Promise.all(
        newFamily.children
          .filter((ch) => !ch.checked_in_at)
          .map((ch) => api.post('/api/checkin', { child_id: ch.id, session_id: currentSessionId })),
      );
      const refreshed = await api.get(`/api/checkin/search?q=${encodeURIComponent(searchTerm)}&session_id=${currentSessionId}`);
      if (refreshed) renderResults(refreshed.families);
    } else {
      renderResults(data.families);
    }
    loadStats(currentSessionId);
  } catch (err) {
    alert(err.message);
  }
}

init();
