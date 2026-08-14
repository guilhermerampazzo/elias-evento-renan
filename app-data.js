(() => {
  const LEADS_KEY = 'wowtax_leads_v1';
  const ADMINS_KEY = 'wowtax_admins_v1';
  const TOTAL_SLOTS = 1600;

  function read(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function write(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function uid(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `${prefix}_${window.crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function token(length = 6) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let index = 0; index < length; index += 1) {
      result += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return result;
  }

  function getLeads() {
    return read(LEADS_KEY, []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function saveLeads(leads) {
    return write(LEADS_KEY, leads);
  }

  function createLead(data) {
    const id = uid('lead');
    const voucherCode = `WOW26-${token(6)}`;
    const backupCode = `W26-${token(4)}-${token(4)}`;
    return {
      id,
      createdAt: new Date().toISOString(),
      name: String(data.name || '').trim(),
      email: String(data.email || '').trim().toLowerCase(),
      company: String(data.company || '').trim(),
      phone: String(data.phone || '').trim(),
      consent: Boolean(data.consent),
      status: 'confirmado',
      validatedAt: null,
      validatedBy: null,
      voucherCode,
      backupCode,
      qrPayload: `WOWTAX|${id}|${voucherCode}|${backupCode}`
    };
  }

  function addLead(data) {
    const lead = createLead(data);
    saveLeads([lead, ...getLeads()]);
    return lead;
  }

  function getLead(id) {
    return getLeads().find((lead) => lead.id === id) || null;
  }

  function updateLead(id, changes) {
    const leads = getLeads().map((lead) => lead.id === id ? { ...lead, ...changes } : lead);
    saveLeads(leads);
    return leads.find((lead) => lead.id === id) || null;
  }

  function removeLead(id) {
    const leads = getLeads();
    const removed = leads.find((lead) => lead.id === id) || null;
    saveLeads(leads.filter((lead) => lead.id !== id));
    return removed;
  }

  function getAdmins() {
    const stored = read(ADMINS_KEY, null);
    if (stored) return stored;
    return write(ADMINS_KEY, [{
      id: 'admin_equipe_wow',
      createdAt: new Date().toISOString(),
      name: 'Equipe WOW Tax',
      email: 'equipe@wowtaxmoment.com',
      role: 'Administrador'
    }]);
  }

  function saveAdmins(admins) {
    return write(ADMINS_KEY, admins);
  }

  function addAdmin(data) {
    const admin = {
      id: uid('admin'),
      createdAt: new Date().toISOString(),
      name: String(data.name || '').trim(),
      email: String(data.email || '').trim().toLowerCase(),
      role: String(data.role || 'Operador de leads').trim()
    };
    saveAdmins([admin, ...getAdmins()]);
    return admin;
  }

  function removeAdmin(id) {
    saveAdmins(getAdmins().filter((admin) => admin.id !== id));
  }

  function availableSlots() {
    return Math.max(0, TOTAL_SLOTS - getLeads().length);
  }

  function phoneDigits(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function firstName(name) {
    return String(name || '').trim().split(/\s+/)[0] || 'tudo bem';
  }

  function whatsappMessage(lead, includeVoucher = false) {
    const greeting = `Olá, ${firstName(lead.name)}!`;
    const base = `${greeting} Vimos que você teve interesse no evento da WOW Tax e ficamos muito felizes com isso. Sua inscrição está confirmada para 03 de setembro de 2026, no CENFORPE.`;
    if (!includeVoucher) return base;
    const link = new URL(`obrigado.html?id=${encodeURIComponent(lead.id)}`, window.location.href).href;
    return `${base} Seu voucher é ${lead.voucherCode} e o código backup é ${lead.backupCode}. Guarde esta mensagem ou abra novamente: ${link}`;
  }

  window.WowTaxApp = {
    ADMINS_KEY,
    LEADS_KEY,
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
    saveLeads,
    updateLead,
    whatsappMessage
  };
})();
