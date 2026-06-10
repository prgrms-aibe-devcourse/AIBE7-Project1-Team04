import { saveItinerary, savePayload } from './itinerary-state.js';

const container = document.querySelector('#tripsContainer');

init();

async function init() {
  const session = JSON.parse(localStorage.getItem('session') || 'null');
  if (!session?.access_token) {
    renderError('로그인이 필요합니다.', true);
    return;
  }

  try {
    const res = await fetch('/api/trips', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (res.status === 401) {
      renderError('세션이 만료되었습니다. 다시 로그인해 주세요.', true);
      return;
    }

    if (!res.ok) throw new Error('목록 조회 실패');

    const { trips } = await res.json();
    renderTrips(trips, session.access_token);
  } catch (_err) {
    renderError('일정 목록을 불러오지 못했습니다. 새로고침 해주세요.');
  }
}

function renderTrips(trips, token) {
  if (!trips || trips.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🗺️</div>
        <p class="empty-state-title">저장된 여행 일정이 없어요</p>
        <p class="empty-state-desc">AI로 일정을 생성하고 내 계정에 저장해 보세요.</p>
        <a class="primary-button" href="/pages/itinerary-create.html">일정 만들기</a>
      </div>
    `;
    return;
  }

  const list = document.createElement('div');
  list.className = 'trips-list';

  trips.forEach((trip) => {
    list.append(createTripCard(trip, token));
  });

  container.innerHTML = '';
  container.append(list);
}

function createTripCard(trip, token) {
  const card = document.createElement('div');
  card.className = 'trip-card';
  card.dataset.id = trip.id;

  const date = new Date(trip.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const keyword = trip.payload?.keyword || '';
  const days = trip.payload?.days ? `${trip.payload.days}일` : '';
  const people = trip.payload?.people ? `${trip.payload.people}명` : '';

  card.innerHTML = `
    <div class="trip-card-body" data-action="view">
      <p class="trip-card-title">${escapeHtml(trip.title)}</p>
      <div class="trip-card-meta">
        <span>${date}</span>
        ${keyword ? `<span>${escapeHtml(keyword)}</span>` : ''}
        ${days ? `<span>${days}</span>` : ''}
        ${people ? `<span>${people}</span>` : ''}
      </div>
    </div>
    <div class="trip-card-actions">
      <button class="trip-action-btn" data-action="rename" type="button">이름 변경</button>
      <button class="trip-action-btn danger" data-action="delete" type="button">삭제</button>
    </div>
  `;

  card.querySelector('[data-action="view"]').addEventListener('click', () => viewTrip(trip.id, token));
  card.querySelector('[data-action="rename"]').addEventListener('click', () => startRename(card, trip, token));
  card.querySelector('[data-action="delete"]').addEventListener('click', () => confirmDelete(trip.id, token, card));

  return card;
}

async function viewTrip(id, token) {
  try {
    const res = await fetch(`/api/trips/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      showToast('일정을 불러오지 못했습니다.');
      return;
    }

    const { trip } = await res.json();
    savePayload(trip.payload || {});
    saveItinerary(trip.itinerary);
    window.location.href = '/pages/itinerary-result.html';
  } catch (_err) {
    showToast('오류가 발생했습니다.');
  }
}

function startRename(card, trip, token) {
  const titleEl = card.querySelector('.trip-card-title');
  const renameBtn = card.querySelector('[data-action="rename"]');

  const input = document.createElement('input');
  input.className = 'trip-card-title-input';
  input.value = trip.title;
  input.maxLength = 80;

  titleEl.replaceWith(input);
  input.focus();
  input.select();

  renameBtn.textContent = '저장';
  renameBtn.onclick = () => commitRename(input, trip, card, token);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commitRename(input, trip, card, token);
    if (e.key === 'Escape') cancelRename(input, trip, card, token);
  });
}

async function commitRename(input, trip, card, token) {
  const newTitle = input.value.trim();
  if (!newTitle) { showToast('이름을 입력해 주세요.'); return; }
  if (newTitle === trip.title) { cancelRename(input, trip, card, token); return; }

  try {
    const res = await fetch(`/api/trips/${trip.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: newTitle }),
    });

    if (!res.ok) { showToast('이름 변경에 실패했습니다.'); return; }

    trip.title = newTitle;
    cancelRename(input, { ...trip, title: newTitle }, card, token);
    showToast('이름이 변경되었습니다.');
  } catch (_err) {
    showToast('오류가 발생했습니다.');
  }
}

function cancelRename(input, trip, card, token) {
  const titleEl = document.createElement('p');
  titleEl.className = 'trip-card-title';
  titleEl.textContent = trip.title;

  input.replaceWith(titleEl);

  const renameBtn = card.querySelector('[data-action="rename"]');
  renameBtn.textContent = '이름 변경';
  renameBtn.onclick = () => startRename(card, trip, token);
}

function confirmDelete(id, token, card) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <p class="confirm-title">일정을 삭제할까요?</p>
      <p class="confirm-desc">삭제된 일정은 복구할 수 없어요.</p>
      <div class="confirm-actions">
        <button class="ghost-button" type="button" id="cancelDelete">취소</button>
        <button class="primary-button" type="button" id="confirmDeleteBtn" style="background:#ff5c68;border:none;">삭제</button>
      </div>
    </div>
  `;

  document.body.append(overlay);

  overlay.querySelector('#cancelDelete').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#confirmDeleteBtn').addEventListener('click', async () => {
    overlay.remove();
    await deleteTrip(id, token, card);
  });
}

async function deleteTrip(id, token, card) {
  try {
    const res = await fetch(`/api/trips/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) { showToast('삭제에 실패했습니다.'); return; }

    card.style.opacity = '0';
    card.style.transform = 'translateX(12px)';
    card.style.transition = 'opacity 0.25s, transform 0.25s';
    setTimeout(() => {
      card.remove();
      const list = container.querySelector('.trips-list');
      if (list && list.children.length === 0) {
        renderTrips([], token);
      }
    }, 260);

    showToast('삭제되었습니다.');
  } catch (_err) {
    showToast('오류가 발생했습니다.');
  }
}

function renderError(message, redirectToLogin = false) {
  container.innerHTML = `
    <div class="error-state">
      <p>${escapeHtml(message)}</p>
      ${redirectToLogin ? '<a class="secondary-button" href="/pages/login.html" style="margin-top:12px;display:inline-block;">로그인하기</a>' : ''}
    </div>
  `;
}

function showToast(message) {
  const old = document.querySelector('.toast');
  old?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 2400);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
