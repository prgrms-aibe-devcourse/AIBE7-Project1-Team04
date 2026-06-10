import { requestApi } from '../common/api.js';

// ── Utilities ──
function showFieldError(fieldId, errorId, iconId, message) {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(errorId);
  const iconEl = iconId ? document.getElementById(iconId) : null;

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
  const iconEl = iconId ? document.getElementById(iconId) : null;

  input.classList.remove('input-error');
  errorEl.classList.remove('visible');

  if (iconEl) iconEl.innerHTML = '';
}

function setFieldSuccess(fieldId, iconId) {
  const input = document.getElementById(fieldId);
  const iconEl = iconId ? document.getElementById(iconId) : null;

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
  const form = document.getElementById('signup-form');
  form.classList.remove('form-shake');
  void form.offsetWidth;
  form.classList.add('form-shake');
  form.addEventListener('animationend', () => form.classList.remove('form-shake'), { once: true });
}

function setLoading(loading) {
  const btn = document.getElementById('submit-btn');
  btn.disabled = loading;
  btn.classList.toggle('btn-loading', loading);
}

// ── Password strength ──
function calcStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) || /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, Math.floor(score * 4 / 5));
}

const strengthConfig = [
  { label: '',    color: '',          width: '0%' },
  { label: '약함', color: '#ef4444',  width: '25%' },
  { label: '보통', color: '#f97316',  width: '50%' },
  { label: '좋음', color: '#eab308',  width: '75%' },
  { label: '강함', color: '#22c55e',  width: '100%' },
];

function updateStrength(pw) {
  const wrap  = document.getElementById('strength-wrap');
  const fill  = document.getElementById('strength-fill');
  const label = document.getElementById('strength-label');

  if (!pw) { wrap.style.display = 'none'; return; }

  wrap.style.display = '';
  const level = calcStrength(pw);
  const cfg = strengthConfig[level] || strengthConfig[1];
  fill.style.width = cfg.width;
  fill.style.backgroundColor = cfg.color;
  label.textContent = cfg.label;
  label.style.color = cfg.color;
}

// ── Eye toggles ──
function setupEyeToggle(toggleId, inputId, openId, closedId) {
  document.getElementById(toggleId).addEventListener('click', () => {
    const input = document.getElementById(inputId);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    document.getElementById(openId).style.display   = isPassword ? 'none' : '';
    document.getElementById(closedId).style.display = isPassword ? '' : 'none';
  });
}

setupEyeToggle('password-toggle', 'password', 'pw-eye-open', 'pw-eye-closed');
setupEyeToggle('confirm-toggle', 'password-confirm', 'cf-eye-open', 'cf-eye-closed');

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

document.getElementById('nickname').addEventListener('blur', () => {
  const nickname = document.getElementById('nickname').value.trim();
  if (!nickname) {
    showFieldError('nickname', 'nickname-error', 'nickname-icon', '닉네임을 입력해주세요.');
  } else if (nickname.length < 2) {
    showFieldError('nickname', 'nickname-error', 'nickname-icon', '닉네임은 2자 이상이어야 합니다.');
  } else if (nickname.length > 20) {
    showFieldError('nickname', 'nickname-error', 'nickname-icon', '닉네임은 20자 이하여야 합니다.');
  } else {
    clearFieldError('nickname', 'nickname-error', 'nickname-icon');
    setFieldSuccess('nickname', 'nickname-icon');
  }
});

document.getElementById('nickname').addEventListener('input', () => {
  clearFieldError('nickname', 'nickname-error', 'nickname-icon');
  document.getElementById('nickname').classList.remove('input-success');
});

document.getElementById('password').addEventListener('input', () => {
  const pw = document.getElementById('password').value;
  updateStrength(pw);
  clearFieldError('password', 'password-error', null);

  // re-check confirm match if already typed
  const confirm = document.getElementById('password-confirm').value;
  if (confirm) validateConfirm();
});

document.getElementById('password').addEventListener('blur', () => {
  const pw = document.getElementById('password').value;
  if (!pw) {
    showFieldError('password', 'password-error', null, '비밀번호를 입력해주세요.');
  } else if (pw.length < 8) {
    showFieldError('password', 'password-error', null, '비밀번호는 8자 이상이어야 합니다.');
  } else {
    clearFieldError('password', 'password-error', null);
  }
});

function validateConfirm() {
  const pw = document.getElementById('password').value;
  const confirm = document.getElementById('password-confirm').value;
  if (!confirm) return;
  if (pw !== confirm) {
    showFieldError('password-confirm', 'confirm-error', null, '비밀번호가 일치하지 않습니다.');
  } else {
    clearFieldError('password-confirm', 'confirm-error', null);
    setFieldSuccess('password-confirm', null);
  }
}

document.getElementById('password-confirm').addEventListener('input', validateConfirm);
document.getElementById('password-confirm').addEventListener('blur', () => {
  const confirm = document.getElementById('password-confirm').value;
  if (!confirm) {
    showFieldError('password-confirm', 'confirm-error', null, '비밀번호 확인을 입력해주세요.');
  } else {
    validateConfirm();
  }
});

// ── Submit ──
document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email    = document.getElementById('email').value.trim();
  const nickname = document.getElementById('nickname').value.trim();
  const password = document.getElementById('password').value;
  const confirm  = document.getElementById('password-confirm').value;
  const message  = document.getElementById('message');

  message.textContent = '';
  message.className = 'auth-message';

  let hasError = false;

  if (!email) {
    showFieldError('email', 'email-error', 'email-icon', '이메일을 입력해주세요.');
    hasError = true;
  } else if (!isValidEmail(email)) {
    showFieldError('email', 'email-error', 'email-icon', '올바른 이메일 형식이 아닙니다.');
    hasError = true;
  }

  if (!nickname) {
    showFieldError('nickname', 'nickname-error', 'nickname-icon', '닉네임을 입력해주세요.');
    hasError = true;
  } else if (nickname.length < 2 || nickname.length > 20) {
    showFieldError('nickname', 'nickname-error', 'nickname-icon', '닉네임은 2~20자여야 합니다.');
    hasError = true;
  }

  if (!password) {
    showFieldError('password', 'password-error', null, '비밀번호를 입력해주세요.');
    hasError = true;
  } else if (password.length < 8) {
    showFieldError('password', 'password-error', null, '비밀번호는 8자 이상이어야 합니다.');
    hasError = true;
  }

  if (!confirm) {
    showFieldError('password-confirm', 'confirm-error', null, '비밀번호 확인을 입력해주세요.');
    hasError = true;
  } else if (password !== confirm) {
    showFieldError('password-confirm', 'confirm-error', null, '비밀번호가 일치하지 않습니다.');
    hasError = true;
  }

  if (hasError) {
    shakeForm();
    return;
  }

  setLoading(true);

  try {
    const data = await requestApi('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, nickname }),
    });

    message.textContent = data.message || '회원가입 완료! 로그인 페이지로 이동합니다.';
    message.classList.add('visible', 'success');

    setTimeout(() => { window.location.href = '/pages/login.html'; }, 2000);
  } catch (err) {
    // Handle "already registered" → show under email field
    if (err.message.toLowerCase().includes('already') || err.message.includes('이미')) {
      showFieldError('email', 'email-error', 'email-icon', '이미 사용 중인 이메일입니다.');
    } else {
      message.textContent = err.message;
      message.classList.add('visible', 'error');
    }
    shakeForm();
    setLoading(false);
  }
});
