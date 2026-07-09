// ============ Config ============
const API_BASE = '/api';

// ============ Estado ============
let state = {
  token: localStorage.getItem('nido_token') || null,
  user: JSON.parse(localStorage.getItem('nido_user') || 'null'),
  spaces: [],
  reservations: [],
  activeType: 'ALL',
  activeSpace: null,
  selectedSlot: null,
};

// ============ Helpers de UI ============
function $(id) { return document.getElementById(id); }

function showToast(message, isError = false) {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = 'toast' + (isError ? ' toast-error' : '');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
}

// ============ Llamadas a la API ============
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    logout();
    throw new Error('Sesión expirada, inicia sesión de nuevo.');
  }

  let data = null;
  try { data = await res.json(); } catch (_) { /* respuesta vacía */ }

  if (!res.ok) {
    const message = (data && (data.message || data.error)) || 'Ocurrió un error';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return data;
}

// ============ Auth ============
async function login(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  state.token = data.accessToken;
  state.user = data.user;
  localStorage.setItem('nido_token', state.token);
  localStorage.setItem('nido_user', JSON.stringify(state.user));
}

async function register(name, email, password) {
  await apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  // Tras registrarse, iniciamos sesión automáticamente
  await login(email, password);
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('nido_token');
  localStorage.removeItem('nido_user');
  $('appView').classList.add('hidden');
  $('authView').classList.remove('hidden');
}

// ============ Espacios ============
async function loadSpaces() {
  state.spaces = await apiFetch('/spaces');
  renderSpaces();
}

function renderSpaces() {
  const grid = $('spacesGrid');
  const filtered = state.activeType === 'ALL'
    ? state.spaces
    : state.spaces.filter(s => s.type === state.activeType);

  $('spacesCount').textContent = `${filtered.length} espacio${filtered.length === 1 ? '' : 's'} disponible${filtered.length === 1 ? '' : 's'}`;

  grid.innerHTML = filtered.map(space => `
    <div class="card" data-id="${space.id}">
      <div class="card-type">${typeLabel(space.type)}</div>
      <h3>${space.name}</h3>
      <div class="card-meta">${space.location} · ${space.capacity} personas</div>
    </div>
  `).join('') || '<p class="muted">No hay espacios que coincidan con el filtro.</p>';

  grid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => openSpaceDetail(Number(card.dataset.id)));
  });
}

function typeLabel(type) {
  return { SALA: 'Sala', ESCRITORIO: 'Escritorio', AUDITORIO: 'Auditorio' }[type] || type;
}

const HOURS = [9, 10, 11, 13, 14, 16, 17];

function openSpaceDetail(id) {
  const space = state.spaces.find(s => s.id === id);
  if (!space) return;
  state.activeSpace = space;
  state.selectedSlot = null;

  const today = new Date().toISOString().slice(0, 10);

  $('spaceDetail').innerHTML = `
    <div class="card-type">${typeLabel(space.type)}</div>
    <h2>${space.name}</h2>
    <div class="detail-meta">${space.location} · ${space.capacity} personas</div>
    ${space.description ? `<p>${space.description}</p>` : ''}

    <div class="form-row">
      <label>Fecha</label>
      <input type="date" id="reserveDate" value="${today}" min="${today}" />
    </div>

    <label class="muted" style="font-size:0.85rem;">Horario disponible (1 hora)</label>
    <div class="slot-grid" id="slotGrid">
      ${HOURS.map(h => `<button type="button" class="slot-btn" data-hour="${h}">${String(h).padStart(2, '0')}:00</button>`).join('')}
    </div>

    <div id="reserveError" class="alert alert-error hidden"></div>

    <button id="confirmReserveBtn" class="btn btn-primary" style="width:100%;" disabled>
      Reservar este horario
    </button>
  `;

  $('slotGrid').querySelectorAll('.slot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $('slotGrid').querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedSlot = Number(btn.dataset.hour);
      $('confirmReserveBtn').disabled = false;
    });
  });

  $('confirmReserveBtn').addEventListener('click', submitReservation);

  $('spaceModal').classList.remove('hidden');
}

async function submitReservation() {
  const dateStr = $('reserveDate').value;
  if (!dateStr || state.selectedSlot === null) return;

  const startTime = new Date(`${dateStr}T${String(state.selectedSlot).padStart(2, '0')}:00:00`);
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

  const btn = $('confirmReserveBtn');
  btn.disabled = true;
  btn.textContent = 'Reservando...';

  try {
    await apiFetch('/reservations', {
      method: 'POST',
      body: JSON.stringify({
        spaceId: state.activeSpace.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      }),
    });
    showToast('Solicitud enviada — revisa "Mis reservas"');
    closeModal();
    switchTab('reservas');
    await loadReservations();
  } catch (err) {
    $('reserveError').textContent = err.message;
    $('reserveError').classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Reservar este horario';
  }
}

function closeModal() {
  $('spaceModal').classList.add('hidden');
  state.activeSpace = null;
  state.selectedSlot = null;
}

// ============ Reservas ============
async function loadReservations() {
  state.reservations = await apiFetch('/reservations/me');
  renderReservations();
}

function renderReservations() {
  const list = $('reservationsList');
  if (!state.reservations.length) {
    list.innerHTML = '<p class="muted">Todavía no tienes reservas.</p>';
    return;
  }

  const sorted = [...state.reservations].sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  list.innerHTML = sorted.map(r => `
    <div class="res-item" data-id="${r.id}">
      <div class="res-info">
        <h4>${r.space?.name ?? 'Espacio'}</h4>
        <div class="muted">${r.space?.location ?? ''}</div>
        <div class="muted">${formatDate(r.startTime)} · ${formatTime(r.startTime)}–${formatTime(r.endTime)}</div>
      </div>
      <div class="res-actions">
        <span class="status-badge status-${r.status}">${statusLabel(r.status)}</span>
        ${['PENDING', 'CONFIRMED'].includes(r.status)
          ? `<button class="btn btn-danger cancel-btn" data-id="${r.id}">Cancelar</button>`
          : ''}
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => cancelReservation(Number(btn.dataset.id)));
  });
}

function statusLabel(status) {
  return { PENDING: 'Pendiente', CONFIRMED: 'Confirmada', CANCELLED: 'Cancelada' }[status] || status;
}

// ============ Admin: espacios ============
function renderAdminSpaces() {
  const list = $('adminSpacesList');
  if (!state.spaces.length) {
    list.innerHTML = '<p class="muted">Todavía no has creado ningún espacio.</p>';
    return;
  }
  list.innerHTML = state.spaces.map(s => `
    <div class="res-item">
      <div class="res-info">
        <h4>${s.name}</h4>
        <div class="muted">${typeLabel(s.type)} · ${s.location} · ${s.capacity} personas</div>
      </div>
      <button class="btn btn-danger delete-space-btn" data-id="${s.id}">Eliminar</button>
    </div>
  `).join('');

  list.querySelectorAll('.delete-space-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteSpace(Number(btn.dataset.id)));
  });
}

async function createSpace(e) {
  e.preventDefault();
  $('adminError').classList.add('hidden');
  try {
    await apiFetch('/spaces', {
      method: 'POST',
      body: JSON.stringify({
        name: $('spaceName').value,
        location: $('spaceLocation').value,
        capacity: Number($('spaceCapacity').value),
        type: $('spaceType').value,
        description: $('spaceDescription').value || undefined,
      }),
    });
    showToast('Espacio creado');
    $('createSpaceForm').reset();
    await loadSpaces();
    renderAdminSpaces();
  } catch (err) {
    $('adminError').textContent = err.message;
    $('adminError').classList.remove('hidden');
  }
}

async function deleteSpace(id) {
  if (!confirm('¿Eliminar este espacio? Esto no se puede deshacer.')) return;
  try {
    await apiFetch(`/spaces/${id}`, { method: 'DELETE' });
    showToast('Espacio eliminado');
    await loadSpaces();
    renderAdminSpaces();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function cancelReservation(id) {
  if (!confirm('¿Cancelar esta reserva?')) return;
  try {
    await apiFetch(`/reservations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    showToast('Reserva cancelada');
    await loadReservations();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ============ Tabs ============
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tabName}`));
}

// ============ Arranque de la app ============
async function showApp() {
  $('authView').classList.add('hidden');
  $('appView').classList.remove('hidden');
  $('userName').textContent = `${state.user.name} · ${state.user.email}`;

  if (state.user.role === 'ADMIN') {
    $('adminTabBtn').classList.remove('hidden');
  }

  try {
    await Promise.all([loadSpaces(), loadReservations()]);
    if (state.user.role === 'ADMIN') await renderAdminSpaces();
  } catch (err) {
    showToast(err.message, true);
  }
}

function init() {
  // Formularios de auth
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('authError').classList.add('hidden');
    try {
      await login($('loginEmail').value, $('loginPassword').value);
      await showApp();
    } catch (err) {
      $('authError').textContent = err.message;
      $('authError').classList.remove('hidden');
    }
  });

  $('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('authError').classList.add('hidden');
    try {
      await register($('registerName').value, $('registerEmail').value, $('registerPassword').value);
      await showApp();
    } catch (err) {
      $('authError').textContent = err.message;
      $('authError').classList.remove('hidden');
    }
  });

  $('showRegister').addEventListener('click', (e) => {
    e.preventDefault();
    $('loginForm').classList.add('hidden');
    $('registerForm').classList.remove('hidden');
    $('showRegister').classList.add('hidden');
    $('showLogin').classList.remove('hidden');
  });
  $('showLogin').addEventListener('click', (e) => {
    e.preventDefault();
    $('registerForm').classList.add('hidden');
    $('loginForm').classList.remove('hidden');
    $('showLogin').classList.add('hidden');
    $('showRegister').classList.remove('hidden');
  });

  $('logoutBtn').addEventListener('click', logout);

  $('createSpaceForm').addEventListener('submit', createSpace);

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Filtros de tipo de espacio
  document.querySelectorAll('#filters .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#filters .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeType = chip.dataset.type;
      renderSpaces();
    });
  });

  // Modal
  $('closeModal').addEventListener('click', closeModal);
  $('modalBackdrop').addEventListener('click', closeModal);

  // Sesión existente
  if (state.token && state.user) {
    showApp();
  }
}

document.addEventListener('DOMContentLoaded', init);
