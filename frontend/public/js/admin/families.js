import { api, applyTheme } from '../api.js';
import { requireAuth, logout } from '../auth.js';

applyTheme();

let currentUser = null;
let allFamilies = [];
let searchTimeout = null;

async function init() {
  currentUser = await requireAuth(['staff_admin', 'super_admin']);
  if (!currentUser) return;

  document.getElementById('user-name').textContent = currentUser.name;
  document.getElementById('logout-btn').addEventListener('click', logout);
  if (currentUser.role === 'super_admin') document.getElementById('settings-link').classList.remove('hidden');

  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadFamilies(e.target.value.trim()), 300);
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('edit-form').addEventListener('submit', saveFamily);
  document.getElementById('child-modal-close').addEventListener('click', closeChildModal);
  document.getElementById('child-modal-cancel').addEventListener('click', closeChildModal);
  document.getElementById('edit-child-form').addEventListener('submit', saveChild);

  loadFamilies();
}

async function loadFamilies(q = '') {
  try {
    const data = await api.get(`/api/families${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    if (!data) return;
    allFamilies = data.families;
    renderTable(data.families);
  } catch (err) {
    console.error(err);
  }
}

function renderTable(families) {
  const tbody = document.getElementById('families-body');
  if (!families.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-muted" style="text-align:center;padding:2rem">No families found.</td></tr>';
    return;
  }
  tbody.innerHTML = families.map((f) => `
    <tr>
      <td><strong>${f.parent_name}</strong></td>
      <td>${f.phone}</td>
      <td>${f.email}</td>
      <td>${f.home_church ?? ''}</td>
      <td>${f.child_names ?? '—'} <span class="text-muted" style="font-size:.8rem">(${f.child_count})</span></td>
      <td>${new Date(f.registered_at.replace(' ', 'T') + 'Z').toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}</td>
      <td class="no-print">
        <div class="flex gap-2">
          <button class="btn btn--secondary btn--sm" onclick="editFamily(${f.id})">Edit</button>
          ${currentUser.role === 'super_admin' ? `<button class="btn btn--danger btn--sm" onclick="deleteFamily(${f.id})">Delete</button>` : ''}
        </div>
      </td>
    </tr>`).join('');
}

window.editFamily = async (id) => {
  const data = await api.get(`/api/families/${id}`);
  if (!data) return;
  const form = document.getElementById('edit-form');
  form.id.value = data.family.id;
  form.parent_name.value = data.family.parent_name;
  form.phone.value = data.family.phone;
  form.email.value = data.family.email;
  form.home_church.value = data.family.home_church;

  const childrenEl = document.getElementById('children-list');
  childrenEl.innerHTML = data.children.map((ch) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border)">
      <span>
        ${ch.first_name} ${ch.last_name}
        <span class="badge badge--gray">${ch.grade}</span>
        ${ch.gender ? `<span class="badge badge--blue">${ch.gender === 'M' ? 'Male' : 'Female'}</span>` : ''}
        ${ch.allergies ? `<span class="text-muted" style="font-size:.8rem"> — Allergies: ${ch.allergies}</span>` : ''}
        ${ch.notes ? `<em class="text-muted"> — ${ch.notes}</em>` : ''}
      </span>
      <div class="flex gap-2">
        <button class="btn btn--secondary btn--sm" onclick="editChild(${ch.id}, ${id})">Edit</button>
        ${currentUser.role === 'super_admin' ? `<button class="btn btn--danger btn--sm" onclick="deleteChild(${ch.id}, ${id})">×</button>` : ''}
      </div>
    </div>`).join('');

  document.getElementById('edit-modal').classList.remove('hidden');
};

window.editChild = async (id, familyId) => {
  const ch = await api.get(`/api/children/${id}`);
  if (!ch) return;
  const form = document.getElementById('edit-child-form');
  form.id.value = ch.id;
  form.family_id.value = familyId;
  form.first_name.value = ch.first_name;
  form.last_name.value = ch.last_name;
  form.grade.value = ch.grade;
  form.querySelectorAll('[name=gender]').forEach((r) => { r.checked = r.value === ch.gender; });
  form.allergies.value = ch.allergies || '';
  form.notes.value = ch.notes || '';
  document.getElementById('edit-child-modal').classList.remove('hidden');
};

async function saveChild(e) {
  e.preventDefault();
  const form = e.target;
  await api.put(`/api/children/${form.id.value}`, {
    first_name: form.first_name.value,
    last_name: form.last_name.value,
    grade: form.grade.value,
    gender: form.querySelector('[name=gender]:checked')?.value || null,
    allergies: form.allergies.value.trim() || null,
    notes: form.notes.value.trim() || null,
  });
  closeChildModal();
  editFamily(Number(form.family_id.value));
}

function closeChildModal() {
  document.getElementById('edit-child-modal').classList.add('hidden');
}

window.deleteChild = async (childId, familyId) => {
  if (!confirm('Delete this child?')) return;
  await api.delete(`/api/children/${childId}`);
  editFamily(familyId);
};

window.deleteFamily = async (id) => {
  if (!confirm('Delete this family and all their children?')) return;
  await api.delete(`/api/families/${id}`);
  loadFamilies(document.getElementById('search-input').value.trim());
};

async function saveFamily(e) {
  e.preventDefault();
  const form = e.target;
  await api.put(`/api/families/${form.id.value}`, {
    parent_name: form.parent_name.value,
    phone: form.phone.value,
    email: form.email.value,
    home_church: form.home_church.value,
  });
  closeModal();
  loadFamilies(document.getElementById('search-input').value.trim());
}

function closeModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

init();
