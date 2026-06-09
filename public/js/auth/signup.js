document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const message = document.getElementById('message');

  message.textContent = '';

  try {
    const data = await requestApi('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    message.textContent = data.message;
    setTimeout(() => {
      window.location.href = '/pages/login.html';
    }, 2000);
  } catch (err) {
    message.textContent = err.message;
  }
});
