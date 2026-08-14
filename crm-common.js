(() => {
  const app = window.WowTaxApp;

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
    }[character]));
  }

  function dateLabel(value) {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)).replace('.', '');
  }

  function statusLabel(lead) {
    return lead.status === 'validado' ? 'Presença validada' : 'Confirmado';
  }

  function openMail(lead) {
    window.location.href = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent('Seu voucher — evento WOW Tax')}&body=${encodeURIComponent(app.whatsappMessage(lead, true))}`;
  }

  function openPhone(lead) {
    if (lead.phone) window.location.href = `tel:${app.phoneDigits(lead.phone)}`;
  }

  function openWhatsApp(lead, includeVoucher = false) {
    const message = app.whatsappMessage(lead, includeVoucher);
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  }

  function renderKpis() {
    const leads = app.getLeads();
    const admins = app.getAdmins();
    const values = {
      'kpi-leads': leads.length.toLocaleString('pt-BR'),
      'kpi-slots': app.availableSlots().toLocaleString('pt-BR'),
      'kpi-validated': leads.filter((lead) => lead.status === 'validado').length.toLocaleString('pt-BR'),
      'kpi-admins': admins.length.toLocaleString('pt-BR')
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
    const adminCount = document.getElementById('admin-count');
    if (adminCount) adminCount.textContent = `${admins.length} ${admins.length === 1 ? 'usuário' : 'usuários'}`;
  }

  function initNavigation() {
    const current = window.location.pathname.split('/').pop() || 'crm.html';
    document.querySelectorAll('[data-nav]').forEach((link) => {
      const isActive = link.dataset.nav === current;
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
    });
  }

  function decorateSidebar() {
    const icons = {
      'crm.html': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-16v3h6V4h-6Z"/></svg>',
      'leads.html': '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3 2.4-4.5 5.5-4.5S13.9 16 14.5 19M16 11c2.2.1 3.7 1.4 4.2 3.6M16 5.5a2.5 2.5 0 1 1 0 5"/></svg>',
      'leitor.html': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 7h3v3H7V7Zm7 0h3v3h-3V7Zm-7 7h3v3H7v-3Zm7 0h3v3h-3v-3Z"/></svg>',
      'admins.html': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.2 8.3-8 10-4.8-1.7-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></svg>'
    };
    document.querySelectorAll('.crm-nav a[data-nav]').forEach((link) => {
      const label = link.textContent.trim();
      link.innerHTML = `${icons[link.dataset.nav] || ''}<span>${label}</span>`;
    });
    document.querySelectorAll('.sidebar-foot').forEach((foot) => {
      foot.innerHTML = '<div class="team-profile"><span class="team-avatar">W</span><div><strong>Equipe WOW Tax</strong><small>Painel de operação</small></div></div><a class="site-link" href="index.html">Voltar ao site<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></a>';
    });
  }

  window.WowTaxCRM = { app, dateLabel, decorateSidebar, escapeHtml, initNavigation, openMail, openPhone, openWhatsApp, renderKpis, statusLabel };
  decorateSidebar();
  initNavigation();
  renderKpis();
})();
