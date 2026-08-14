(() => {
  const crm = window.WowTaxCRM;
  if (!crm) return;

  const { app, dateLabel, escapeHtml, openMail, openPhone, openWhatsApp, renderKpis, statusLabel } = crm;
  const $ = (selector) => document.querySelector(selector);
  const leadsBody = $('#leads-body');
  const emptyState = $('#empty-state');
  let activeLead = null;

  const icons = {
    open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h12"/><path d="m12 6 6 6-6 6"/></svg>',
    email: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h3l1.5 4-2 1.5a14 14 0 0 0 5 5l1.5-2 4 1.5v3c0 1.1-.9 2-2 2A14 14 0 0 1 5 6c0-1.1.9-2 2-2Z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 4 21l3-1a8 8 0 1 0-2-1Z"/><path d="M9 10.5c.8 1.7 2 2.8 3.8 3.5l1.2-1.1c.2-.2.5-.2.8-.1l1.4.6c.3.1.4.4.3.7-.3 1.2-1.1 1.8-2.1 1.6-3.8-.7-2.5-2.2-4.1-4.4-5-.9-.3-1.6.2-1.8 1.1l-.1.7c0 .4.3.8.9 1.1Z"/></svg>',
    validate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
    delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7l1-3h4l1 3"/></svg>'
  };

  function initials(name) {
    return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
  }

  function actionButton(action, label, lead, icon, options = {}) {
    const classes = [options.className, action === 'delete' ? 'action-danger' : ''].filter(Boolean).join(' ');
    const text = options.text ? `<span>${options.text}</span>` : '';
    return `<button class="${classes}" data-action="${action}" data-id="${escapeHtml(lead.id)}" type="button" title="${label}" aria-label="${label}">${text}${icon}</button>`;
  }

  async function getFilteredLeads() {
    const term = $('#lead-search').value.trim().toLowerCase();
    const status = $('#status-filter').value;
    const leads = await app.getLeads();
    return leads.filter((lead) => {
      const matchesTerm = !term || [lead.name, lead.email, lead.company, lead.phone, lead.cnpj, lead.voucherCode, lead.backupCode].some((field) => String(field || '').toLowerCase().includes(term));
      return matchesTerm && (status === 'todos' || lead.status === status);
    });
  }

  async function renderLeads() {
    const leads = await getFilteredLeads();
    leadsBody.innerHTML = leads.map((lead) => {
      const phone = app.phoneDigits(lead.phone);
      const participantInitials = initials(lead.name);
      const actions = [actionButton('open', 'Abrir ficha', lead, icons.open, { className: 'open-lead', text: 'Abrir' }), actionButton('email', 'Enviar e-mail', lead, icons.email), phone ? actionButton('phone', 'Ligar', lead, icons.phone) : '', actionButton('whatsapp', 'Abrir WhatsApp', lead, icons.whatsapp), lead.status !== 'validado' ? actionButton('validate', 'Marcar presença', lead, icons.validate) : '', actionButton('delete', 'Excluir lead', lead, icons.delete)].join('');
      return `<tr><td data-label="Participante"><div class="participant-cell"><span class="person-avatar" aria-hidden="true">${escapeHtml(participantInitials)}</span><div><strong>${escapeHtml(lead.name)}</strong><span>${escapeHtml(lead.email)}</span></div></div></td><td data-label="Empresa">${escapeHtml(lead.company || 'Não informado')}</td><td data-label="Contato"><div class="contact-cell"><strong>${escapeHtml(lead.phone || 'Não informado')}</strong><span>inscrito em ${escapeHtml(dateLabel(lead.createdAt))}</span></div></td><td data-label="Voucher / backup"><div class="voucher-cell"><strong>${escapeHtml(lead.voucherCode)}</strong><span>${escapeHtml(lead.backupCode)}</span></div></td><td data-label="Status"><span class="status-chip ${lead.status === 'validado' ? 'is-validated' : ''}">${statusLabel(lead)}</span></td><td data-label="Ações"><div class="table-actions">${actions}</div></td></tr>`;
    }).join('');
    leadsBody.querySelectorAll('tr').forEach((row, index) => {
      const cnpj = leads[index]?.cnpj;
      const contact = row.querySelector('.contact-cell');
      if (cnpj && contact) contact.insertAdjacentHTML('beforeend', `<span>CNPJ ${escapeHtml(cnpj)}</span>`);
    });
    emptyState.hidden = leads.length !== 0;
  }

  function ensureCnpjDetail() {
    if ($('#drawer-cnpj')) return;
    const dateRow = $('#drawer-date')?.parentElement;
    if (dateRow) dateRow.insertAdjacentHTML('beforebegin', '<div><dt>CNPJ</dt><dd id="drawer-cnpj">—</dd></div>');
  }

  function openDrawer(lead) {
    activeLead = lead;
    ensureCnpjDetail();
    $('#drawer-title').textContent = lead.name;
    $('#drawer-name').textContent = lead.name;
    $('#drawer-email-value').textContent = lead.email;
    $('#drawer-company').textContent = lead.company || 'Não informado';
    $('#drawer-phone').textContent = lead.phone || 'Não informado';
    $('#drawer-cnpj').textContent = lead.cnpj || 'Não informado';
    $('#drawer-date').textContent = dateLabel(lead.createdAt);
    $('#drawer-backup').textContent = lead.backupCode;
    $('#drawer-voucher').textContent = lead.voucherCode;
    $('#drawer-email').href = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent('Seu voucher — evento WOW Tax')}`;
    $('#drawer-phone-link').href = lead.phone ? `tel:${app.phoneDigits(lead.phone)}` : '#';
    $('#drawer-validate').hidden = lead.status === 'validado';
    $('#drawer-status').textContent = statusLabel(lead).toUpperCase();
    $('#drawer-status').classList.toggle('is-validated', lead.status === 'validado');
    if (window.QRCode) window.QRCode.toCanvas($('#drawer-qr'), lead.qrPayload, { width: 190, margin: 2, color: { dark: '#0c2032', light: '#fffdf9' } });
    $('#drawer-backdrop').hidden = false;
    $('#lead-drawer').classList.add('is-open');
    $('#lead-drawer').setAttribute('aria-hidden', 'false');
  }

  function closeDrawer() {
    $('#lead-drawer').classList.remove('is-open');
    $('#lead-drawer').setAttribute('aria-hidden', 'true');
    window.setTimeout(() => { $('#drawer-backdrop').hidden = true; }, 220);
    activeLead = null;
  }

  async function markValidated(lead) {
    const updated = await app.updateLead(lead.id, { status: 'validado', validatedAt: new Date().toISOString(), validatedBy: 'CRM' });
    await renderKpis();
    await renderLeads();
    if (activeLead?.id === lead.id) openDrawer(updated);
  }

  async function deleteLead(lead) {
    const confirmed = window.confirm(`Excluir a inscrição de ${lead.name}? Esta ação remove o voucher e libera a vaga.`);
    if (!confirmed) return;
    await app.removeLead(lead.id);
    if (activeLead?.id === lead.id) closeDrawer();
    await renderKpis();
    await renderLeads();
  }

  async function exportExcel(event) {
    event.preventDefault();
    const rows = await app.getLeads();
    if (!rows.length) { window.alert('Ainda não há leads para exportar.'); return; }
    const headers = ['Nome', 'E-mail', 'Empresa', 'CNPJ', 'Telefone', 'Data da inscrição', 'Status', 'Voucher', 'Código backup', 'Presença validada em'];
    const body = rows.map((lead) => [lead.name, lead.email, lead.company, lead.cnpj, lead.phone, dateLabel(lead.createdAt), statusLabel(lead), lead.voucherCode, lead.backupCode, lead.validatedAt ? dateLabel(lead.validatedAt) : '—']);
    const table = `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const blob = new Blob([`\ufeff<!doctype html><html><head><meta charset="UTF-8"></head><body>${table}</body></html>`], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `leads-wow-tax-${new Date().toISOString().slice(0, 10)}.xls`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $('#lead-search').addEventListener('input', renderLeads);
  $('#status-filter').addEventListener('change', renderLeads);
  $('#export-excel').addEventListener('click', exportExcel);
  leadsBody.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const lead = await app.getLead(button.dataset.id); if (!lead) return;
    if (button.dataset.action === 'open') openDrawer(lead);
    if (button.dataset.action === 'email') openMail(lead);
    if (button.dataset.action === 'phone') openPhone(lead);
    if (button.dataset.action === 'whatsapp') openWhatsApp(lead);
    if (button.dataset.action === 'validate') await markValidated(lead);
    if (button.dataset.action === 'delete') await deleteLead(lead);
  });
  $('#close-drawer').addEventListener('click', closeDrawer);
  $('#drawer-backdrop').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDrawer(); });
  $('#drawer-email').addEventListener('click', (event) => { if (!activeLead?.email) event.preventDefault(); });
  $('#drawer-phone-link').addEventListener('click', (event) => { if (!activeLead?.phone) event.preventDefault(); });
  $('#drawer-whatsapp').addEventListener('click', () => { if (activeLead) openWhatsApp(activeLead, true); });
  $('#drawer-resend').addEventListener('click', () => { if (activeLead) openWhatsApp(activeLead, true); });
  $('#drawer-validate').addEventListener('click', () => { if (activeLead) markValidated(activeLead); });
  $('#drawer-delete').addEventListener('click', () => { if (activeLead) deleteLead(activeLead); });

  renderKpis();
  renderLeads();
})();
