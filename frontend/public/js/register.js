import '/js/sentry.js';
import { api, applyTheme } from './api.js';

applyTheme();

const list = document.getElementById('children-list');
const template = document.getElementById('child-template');
const addBtn = document.getElementById('add-child');
const form = document.getElementById('reg-form');
const errEl = document.getElementById('error');
const successEl = document.getElementById('success');
const formCard = document.getElementById('form-card');
const submitBtn = document.getElementById('submit-btn');

const MAX_CHILDREN = 6;

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

  const children = [...list.querySelectorAll('.child-entry')].map((el) => ({
    first_name: el.querySelector('[name=first_name]').value.trim(),
    last_name: el.querySelector('[name=last_name]').value.trim(),
    grade: el.querySelector('[name=grade]').value,
    notes: el.querySelector('[name=notes]').value.trim() || undefined,
  }));

  submitBtn.disabled = true;
  submitBtn.textContent = 'Registering…';

  try {
    await api.post('/api/register', {
      parent_name: form.parent_name.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      home_church: form.home_church.value.trim(),
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
