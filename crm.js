(() => {
  const crm = window.WowTaxCRM;
  if (!crm) return;

  const { app, dateLabel, escapeHtml, renderKpis, statusLabel } = crm;
  const body = document.querySelector('#overview-leads-body');
  const empty = document.querySelector('#overview-empty');
  const checkins = document.querySelector('#overview-checkins');
  const leads = app.getLeads();

  renderKpis();
  checkins.textContent = leads.filter((lead) => lead.status === 'validado').length.toLocaleString('pt-BR');

  if (!leads.length) {
    empty.hidden = false;
    return;
  }

  body.innerHTML = leads.slice(0, 6).map((lead) => `<tr><td><strong>${escapeHtml(lead.name)}</strong><span>${escapeHtml(lead.email)}</span></td><td>${escapeHtml(lead.company || 'Não informado')}</td><td><span class="status-chip ${lead.status === 'validado' ? 'is-validated' : ''}">${statusLabel(lead)}</span><small>${escapeHtml(dateLabel(lead.createdAt))}</small></td></tr>`).join('');
})();
