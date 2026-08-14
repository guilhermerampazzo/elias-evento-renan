(() => {
  const crm = window.WowTaxCRM;
  if (!crm) return;

  const { app, escapeHtml, renderKpis } = crm;
  const list = document.querySelector('#admins-list');

  function renderAdmins() {
    const admins = app.getAdmins();
    list.innerHTML = admins.map((admin) => `<div class="admin-row"><div class="admin-avatar">${escapeHtml((admin.name || '?').slice(0, 1).toUpperCase())}</div><div><strong>${escapeHtml(admin.name)}</strong><span>${escapeHtml(admin.email)} · ${escapeHtml(admin.role)}</span></div><button type="button" title="Remover administrador" data-remove-admin="${escapeHtml(admin.id)}">×</button></div>`).join('');
    renderKpis();
  }

  document.querySelector('#admin-form').addEventListener('submit', (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); app.addAdmin({ name: data.get('name'), email: data.get('email'), role: data.get('role') }); event.currentTarget.reset(); renderAdmins(); });
  list.addEventListener('click', (event) => { const button = event.target.closest('[data-remove-admin]'); if (!button) return; if (window.confirm('Remover este administrador?')) { app.removeAdmin(button.dataset.removeAdmin); renderAdmins(); } });
  renderAdmins();
})();
