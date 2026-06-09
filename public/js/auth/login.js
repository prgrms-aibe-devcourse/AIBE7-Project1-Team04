document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const message = document.getElementById('message');

  message.textContent = '';
  message.className = 'auth-message';

  try {
    const data = await requestApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem('session', JSON.stringify(data.session));
    message.textContent = data.message || '로그인 성공! 잠시 후 이동합니다.';
    message.classList.add('visible', 'success');
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  } catch (err) {
    message.textContent = err.message;
    message.classList.add('visible', 'error');
  }
});
