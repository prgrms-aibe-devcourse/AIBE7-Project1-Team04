// Kakao 가입 완료 페이지 스크립트.
// URL ?state=... 를 받아 hidden input 채우고,
// 폼 제출 시 /api/auth/kakao/complete 로 POST.
// 성공 시 세션 localStorage 저장 후 홈으로 이동.

const params = new URLSearchParams(window.location.search);
const state = params.get('state') || '';
const nicknameFromQuery = params.get('nickname') || '';

const stateInput = document.getElementById('state');
const nicknameInput = document.getElementById('nickname');
const nicknameLine = document.getElementById('kakao-nickname-line');
const form = document.getElementById('kakao-complete-form');
const message = document.getElementById('message');
const submitBtn = document.getElementById('submit-btn');

stateInput.value = state;

if (nicknameFromQuery) {
  nicknameInput.value = nicknameFromQuery;
  nicknameLine.textContent = `Kakao에서 받은 닉네임: ${nicknameFromQuery}`;
}

if (!state) {
  showMessage(
    '인증 정보가 없습니다. 로그인 페이지에서 Kakao로 다시 시도해 주세요.',
    'error',
  );
  submitBtn.disabled = true;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitBtn.disabled) return;

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const nickname = nicknameInput.value.trim();

  clearFieldErrors();
  message.textContent = '';
  message.className = 'auth-message';

  if (!email || !isValidEmail(email)) {
    showFieldError('email', '올바른 이메일을 입력해 주세요.');
    return;
  }
  if (!password || password.length < 6) {
    showFieldError('password', '비밀번호는 6자 이상이어야 합니다.');
    return;
  }

  setLoading(true);

  try {
    const res = await fetch('/api/auth/kakao/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, email, password, nickname }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showMessage(data.message || '가입에 실패했습니다.', 'error');
      setLoading(false);
      return;
    }

    if (!data.session) {
      showMessage('세션 발급에 실패했습니다. 다시 로그인해 주세요.', 'error');
      setLoading(false);
      return;
    }

    localStorage.setItem('session', JSON.stringify(data.session));
    showMessage('가입이 완료되었습니다. 잠시 후 이동합니다.', 'success');
    setTimeout(() => {
      window.location.replace('/');
    }, 800);
  } catch (err) {
    console.error(err);
    showMessage('네트워크 오류가 발생했습니다. 다시 시도해 주세요.', 'error');
    setLoading(false);
  }
});

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function showFieldError(field, text) {
  const errorEl = document.getElementById(`${field}-error`);
  const input = document.getElementById(field);
  if (errorEl) {
    errorEl.querySelector('.field-error-text').textContent = text;
    errorEl.classList.add('visible');
  }
  if (input) input.classList.add('input-error');
}

function clearFieldErrors() {
  ['email', 'password'].forEach((field) => {
    const errorEl = document.getElementById(`${field}-error`);
    const input = document.getElementById(field);
    if (errorEl) errorEl.classList.remove('visible');
    if (input) input.classList.remove('input-error');
  });
}

function showMessage(text, kind) {
  message.textContent = text;
  message.className = `auth-message visible ${kind}`;
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.classList.toggle('btn-loading', loading);
}
