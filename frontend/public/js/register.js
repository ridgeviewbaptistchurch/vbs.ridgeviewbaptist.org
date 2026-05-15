import '/js/sentry.js';
import { api } from './api.js';

const list = document.getElementById('children-list');
const template = document.getElementById('child-template');
const addBtn = document.getElementById('add-child');
const form = document.getElementById('reg-form');
const errEl = document.getElementById('error');
const successEl = document.getElementById('success');
const formCard = document.getElementById('form-card');
const submitBtn = document.getElementById('submit-btn');
const homeChurchNameGroup = document.getElementById('home-church-name-group');

const MAX_CHILDREN = 6;

// Show/hide home church name field based on yes/no selection
form.addEventListener('change', (e) => {
  if (e.target.name === 'has_home_church') {
    const show = e.target.value === 'yes';
    homeChurchNameGroup.classList.toggle('hidden', !show);
    form.home_church_name.required = show;
  }
});

function addChild() {
  if (list.children.length >= MAX_CHILDREN) return;
  const node = template.content.cloneNode(true);
  node.querySelector('.remove-child').addEventListener('click', (e) => {
    e.currentTarget.closest('.child-entry').remove();
    addBtn.disabled = list.children.length >= MAX_CHILDREN;
  });
  list.appendChild(node);
  addBtn.disabled = list.children.length >= MAX_CHILDREN;
}

addBtn.addEventListener('click', addChild);
addChild(); // start with one

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errEl.classList.add('hidden');

  const hasHomeChurch = form.querySelector('[name=has_home_church]:checked')?.value === 'yes';

  const children = [...list.querySelectorAll('.child-entry')].map((el) => ({
    first_name: el.querySelector('[name=first_name]').value.trim(),
    last_name: el.querySelector('[name=last_name]').value.trim(),
    grade: el.querySelector('[name=grade]').value,
    gender: el.querySelector('[name=gender]:checked')?.value || undefined,
    allergies: el.querySelector('[name=allergies]').value.trim() || undefined,
    notes: el.querySelector('[name=notes]').value.trim() || undefined,
  }));

  submitBtn.disabled = true;
  submitBtn.textContent = 'Registering…';

  try {
    await api.post('/api/register', {
      parent_name: form.parent_name.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      emergency_phone: form.emergency_phone.value.trim() || undefined,
      home_church: hasHomeChurch ? form.home_church_name.value.trim() : null,
      children,
    });
    formCard.classList.add('hidden');
    successEl.classList.remove('hidden');
    window.scrollTo(0, 0);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Register';
  }
});
