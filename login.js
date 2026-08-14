(() => {
  const form = document.querySelector('#login-form');
  const emailInput = document.querySelector('#login-email');
  const passwordInput = document.querySelector('#login-password');
  const submitButton = form.querySelector('button[type="submit"]');
  const errorElement = document.querySelector('#login-error');
  const params = new URLSearchParams(window.location.search);

  function safeNext() {
    const candidate = params.get('next') || '/crm';
    return candidate.startsWith('/') && !candidate.startsWith('//') ? candidate : '/crm';
  }

  function showError(message) {
    errorElement.textContent = message;
    errorElement.hidden = false;
  }

  function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    submitButton.classList.toggle('is-loading', isLoading);
    submitButton.querySelector('span').textContent = isLoading ? 'Validando acesso…' : 'Entrar no painel';
  }

  fetch('/api/auth/me', { credentials: 'same-origin' }).then((response) => {
    if (response.ok) window.location.replace(safeNext());
  }).catch(() => {});

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorElement.hidden = true;
    if (!form.reportValidity()) return;
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.value, password: passwordInput.value })
      });
      const result = await response.json();
      if (!response.ok) {
        showError(result.error || 'Não foi possível validar seu acesso.');
        passwordInput.focus();
        return;
      }
      window.location.replace(safeNext());
    } catch (error) {
      showError('Não foi possível conectar ao servidor. Tente novamente.');
    } finally {
      setLoading(false);
    }
  });
})();
