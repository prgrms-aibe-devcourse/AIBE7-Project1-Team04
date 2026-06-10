import { requestApi } from '../common/api.js';

// ── Utilities ──
function showFieldError(fieldId, errorId, iconId, message) {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(errorId);
  const iconEl = document.getElementById(iconId);

  input.classList.remove('input-success');
  input.classList.add('input-error');

  errorEl.querySelector('.field-error-text').textContent = message;
  errorEl.classList.add('visible');

  if (iconEl) {
    iconEl.innerHTML = svgX();
    iconEl.style.color = 'var(--color-danger)';
  }
}

function clearFieldError(fieldId, errorId, iconId) {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(errorId);
  const iconEl = document.getElementById(iconId);

  input.classList.remove('input-error');
  errorEl.classList.remove('visible');

  if (iconEl) iconEl.innerHTML = '';
}

function setFieldSuccess(fieldId, iconId) {
  const input = document.getElementById(fieldId);
  const iconEl = document.getElementById(iconId);

  input.classList.remove('input-error');
  input.classList.add('input-success');

  if (iconEl) {
    iconEl.innerHTML = svgCheck();
    iconEl.style.color = 'var(--color-success)';
  }
}

function svgCheck() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}

function svgX() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function shakeForm() {
  const form = document.getElementById('login-form');
  form.classList.remove('form-shake');
  void form.offsetWidth; // reflow to restart animation
  form.classList.add('form-shake');
  form.addEventListener('animationend', () => form.classList.remove('form-shake'), { once: true });
}

function setLoading(loading) {
  const btn = document.getElementById('submit-btn');
  btn.disabled = loading;
  btn.classList.toggle('btn-loading', loading);
}

// ── Eye toggle ──
document.getElementById('password-toggle').addEventListener('click', () => {
  const input = document.getElementById('password');
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  document.getElementById('eye-open').style.display = isPassword ? 'none' : '';
  document.getElementById('eye-closed').style.display = isPassword ? '' : 'none';
});

// ── Real-time validation ──
document.getElementById('email').addEventListener('blur', () => {
  const email = document.getElementById('email').value.trim();
  if (!email) {
    showFieldError('email', 'email-error', 'email-icon', '이메일을 입력해주세요.');
  } else if (!isValidEmail(email)) {
    showFieldError('email', 'email-error', 'email-icon', '올바른 이메일 형식이 아닙니다.');
  } else {
    clearFieldError('email', 'email-error', 'email-icon');
    setFieldSuccess('email', 'email-icon');
  }
});

document.getElementById('email').addEventListener('input', () => {
  clearFieldError('email', 'email-error', 'email-icon');
  document.getElementById('email').classList.remove('input-success');
});

document.getElementById('password').addEventListener('blur', () => {
  const pw = document.getElementById('password').value;
  if (!pw) {
    showFieldError('password', 'password-error', null, '비밀번호를 입력해주세요.');
  } else {
    clearFieldError('password', 'password-error', null);
  }
});

document.getElementById('password').addEventListener('input', () => {
  clearFieldError('password', 'password-error', null);
});

// ── Submit ──
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const message = document.getElementById('message');

  // Reset global message
  message.textContent = '';
  message.className = 'auth-message';

  // Validate
  let hasError = false;

  if (!email) {
    showFieldError('email', 'email-error', 'email-icon', '이메일을 입력해주세요.');
    hasError = true;
  } else if (!isValidEmail(email)) {
    showFieldError('email', 'email-error', 'email-icon', '올바른 이메일 형식이 아닙니다.');
    hasError = true;
  }

  if (!password) {
    showFieldError('password', 'password-error', null, '비밀번호를 입력해주세요.');
    hasError = true;
  }

  if (hasError) {
    shakeForm();
    return;
  }

  setLoading(true);

  try {
    const data = await requestApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem('session', JSON.stringify(data.session));
    message.textContent = '로그인 성공! 잠시 후 이동합니다.';
    message.classList.add('visible', 'success');

    setTimeout(() => { window.location.href = '/'; }, 1000);
  } catch (err) {
    // Show specific field errors for known server errors
    if (err.message.includes('이메일') || err.message.includes('올바르지')) {
      showFieldError('email', 'email-error', 'email-icon', '이메일 또는 비밀번호가 올바르지 않습니다.');
      showFieldError('password', 'password-error', null, '이메일 또는 비밀번호가 올바르지 않습니다.');
    } else {
      message.textContent = err.message;
      message.classList.add('visible', 'error');
    }
    shakeForm();
    setLoading(false);
  }
});
