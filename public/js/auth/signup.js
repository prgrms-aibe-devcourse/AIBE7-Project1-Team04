document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const message = document.getElementById('message');

  message.textContent = '';
  message.className = 'auth-message';

  try {
    const data = await requestApi('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
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
