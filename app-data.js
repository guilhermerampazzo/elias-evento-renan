(() => {
  const TOTAL_SLOTS = 1600;

  async function request(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    let payload = {};
    try { payload = await response.json(); } catch (error) { payload = {}; }
    if (!response.ok) {
      const error = new Error(payload.error || 'Não foi possível concluir a operação.');
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function getLeads() {
    const result = await request('/api/leads');
    return result.leads || [];
  }

  async function addLead(data) {
    const result = await request('/api/leads', { method: 'POST', body: JSON.stringify(data) });
    return { ...result.lead, emailStatus: result.emailStatus || result.lead?.emailStatus, emailMessage: result.emailMessage || '' };
  }

  async function getLead(id) {
    if (!id) return null;
    try {
      const result = await request(`/api/leads/${encodeURIComponent(id)}`);
      return result.lead || null;
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  async function updateLead(id, changes) {
    const result = await request(`/api/leads/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(changes) });
    return result.lead;
  }

  async function removeLead(id) {
    const result = await request(`/api/leads/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return result.lead;
  }

  async function getAdmins() {
    const result = await request('/api/admins');
    return result.admins || [];
  }

  async function addAdmin(data) {
    const result = await request('/api/admins', { method: 'POST', body: JSON.stringify(data) });
    return result.admin;
  }

  async function removeAdmin(id) {
    return request(`/api/admins/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async function availableSlots() {
    const result = await request('/api/availability');
    return Number(result.availableSlots ?? TOTAL_SLOTS);
  }

  function phoneDigits(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || 'tudo bem';
  }

  function whatsappMessage(lead, includeVoucher = false) {
    const greeting = `Olá, ${firstName(lead.name)}!`;
    const base = `${greeting} Vimos que você teve interesse no evento da WOW Tax e ficamos muito felizes com isso. Sua inscrição está confirmada para 03 de setembro de 2026, no Teatro Municipal Paulo Machado de Carvalho - SCS.`;
    if (!includeVoucher) return base;
    const link = new URL(`/obrigado?id=${encodeURIComponent(lead.id)}`, window.location.origin).href;
    return `${base} Seu voucher é ${lead.voucherCode} e o código backup é ${lead.backupCode}. Guarde esta mensagem ou abra novamente: ${link}`;
  }

  window.WowTaxApp = {
    TOTAL_SLOTS,
    addAdmin,
    addLead,
    availableSlots,
    firstName,
    getAdmins,
    getLead,
    getLeads,
    phoneDigits,
    removeLead,
    removeAdmin,
    updateLead,
    whatsappMessage
  };
})();
