document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const nickname = document.getElementById('nickname').value.trim();
  const password = document.getElementById('password').value;
  const passwordConfirm = document.getElementById('password-confirm').value;
  const message = document.getElementById('message');

  message.textContent = '';
  message.className = 'auth-message';

  if (password !== passwordConfirm) {
    message.textContent = '비밀번호가 일치하지 않습니다.';
    message.classList.add('visible', 'error');
    return;
  }

  if (password.length < 8) {
    message.textContent = '비밀번호는 8자 이상이어야 합니다.';
    message.classList.add('visible', 'error');
    return;
  }

  try {
    const data = await requestApi('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, nickname }),
    });

    message.textContent = data.message || '회원가입 완료! 로그인 페이지로 이동합니다.';
    message.classList.add('visible', 'success');
    setTimeout(() => {
      window.location.href = '/pages/login.html';
    }, 2000);
  } catch (err) {
    message.textContent = err.message;
    message.classList.add('visible', 'error');
  }
});
