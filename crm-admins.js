(() => {
  const crm = window.WowTaxCRM;
  if (!crm) return;

  const { app, escapeHtml, renderKpis } = crm;
  const list = document.querySelector('#admins-list');

  async function renderAdmins() {
    const admins = await app.getAdmins();
    list.innerHTML = admins.map((admin) => `<div class="admin-row"><div class="admin-avatar">${escapeHtml((admin.name || '?').slice(0, 1).toUpperCase())}</div><div><strong>${escapeHtml(admin.name)}</strong><span>${escapeHtml(admin.email)} · ${escapeHtml(admin.role)}</span></div><button type="button" title="Remover administrador" data-remove-admin="${escapeHtml(admin.id)}">×</button></div>`).join('');
    await renderKpis();
  }

  document.querySelector('#admin-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await app.addAdmin({ name: data.get('name'), email: data.get('email'), password: data.get('password'), role: data.get('role') });
      event.currentTarget.reset();
      await renderAdmins();
    } catch (error) {
      window.alert(error.message || 'Não foi possível criar o administrador.');
    }
  });
  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-remove-admin]');
    if (!button || !window.confirm('Remover este administrador?')) return;
    try {
      await app.removeAdmin(button.dataset.removeAdmin);
      await renderAdmins();
    } catch (error) {
      window.alert(error.message || 'Não foi possível remover o administrador.');
    }
  });
  renderAdmins();
})();
