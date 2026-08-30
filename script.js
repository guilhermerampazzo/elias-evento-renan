const form = document.querySelector('#registration-form');
const app = window.WowTaxApp;

// --- Meta Pixel helpers (ID 1051554627771938) ---
function fbqSafe() {
  if (typeof window.fbq === 'function') {
    try { window.fbq.apply(null, arguments); } catch (e) { /* noop */ }
  }
}
function trackCtaClick(label) {
  fbqSafe('track', 'Lead', { content_name: label || 'CTA_Quero_Participar', content_category: 'cta_click' });
  fbqSafe('trackCustom', 'CtaClick', { label: label || 'CTA_Quero_Participar' });
}
function trackInitiateCheckout() {
  if (trackInitiateCheckout._fired) return;
  trackInitiateCheckout._fired = true;
  fbqSafe('track', 'InitiateCheckout', { content_name: 'Inscricao_WOW_03Set', num_items: 1 });
}
function trackCompleteRegistration(lead, eventId) {
  const adv = {};
  // Advanced Matching hash will be done server-side via CAPI; client sends raw for browser matching (Meta hashes automatically)
  if (lead && lead.email) adv.em = lead.email.trim().toLowerCase();
  if (lead && lead.phone) adv.ph = String(lead.phone).replace(/\D/g, '');
  const opts = eventId ? { eventID: eventId } : {};
  // Browser deduplication: eventID must match CAPI event_id
  fbqSafe('track', 'CompleteRegistration', { content_name: 'Inscricao_WOW_03Set', currency: 'BRL', value: 0 }, opts);
  fbqSafe('track', 'Lead', { content_name: 'Inscricao_Confirmada', currency: 'BRL', value: 0 }, opts);
}

function updateLandingCopy() {
  const heroEntry = Array.from(document.querySelectorAll('.hero-rail span')).find((item) => item.textContent.toLowerCase().includes('entrada'));
  if (heroEntry) heroEntry.textContent = 'EVENTO GRATUITO';

  const locationEntry = document.querySelector('.location-data div:last-child strong');
  if (locationEntry) locationEntry.textContent = 'Evento gratuito · vagas limitadas';

  const faqEntry = document.querySelector('.faq-list details:first-child p');
  if (faqEntry) faqEntry.textContent = 'Sim. A participação é gratuita, com vagas limitadas e inscrição antecipada.';

  const spotsLine = document.querySelector('.spots-line');
  if (spotsLine) {
    spotsLine.innerHTML = '<strong>GRÁTIS</strong><span>vagas limitadas</span>';
    spotsLine.classList.add('is-free');
  }
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[character]));
}

function formatPhoneInput(value) {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCnpjInput(value) {
  const digits = digitsOnly(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function isValidCnpj(value) {
  const digits = digitsOnly(value);
  if (digits.length !== 14 || /^([0-9])\1{13}$/.test(digits)) return false;
  const calculateDigit = (length) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = digits.slice(0, length).split('').reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculateDigit(12) === Number(digits[12]) && calculateDigit(13) === Number(digits[13]);
}

function setupLeadForm() {
  if (!form) return;
  const phoneInput = form.querySelector('input[name="phone"]');
  if (!phoneInput) return;
  phoneInput.setAttribute('maxlength', '15');
  phoneInput.setAttribute('inputmode', 'tel');
  phoneInput.addEventListener('input', () => { phoneInput.value = formatPhoneInput(phoneInput.value); });
}

function setupCountdown() {
  const heroCta = document.querySelector('.hero-copy .button');
  if (!heroCta || document.querySelector('#event-countdown')) return;
  heroCta.insertAdjacentHTML('afterend', '<div class="event-countdown" id="event-countdown" aria-live="polite"><div class="countdown-head"><span>CONTAGEM REGRESSIVA</span><strong>Evento gratuito</strong></div><div class="countdown-grid"><div class="countdown-unit"><strong id="countdown-days">--</strong><span>dias</span></div><div class="countdown-unit"><strong id="countdown-hours">--</strong><span>horas</span></div><div class="countdown-unit"><strong id="countdown-minutes">--</strong><span>minutos</span></div><div class="countdown-unit"><strong id="countdown-seconds">--</strong><span>segundos</span></div></div><p class="countdown-caption">até 03 de setembro de 2026 · Teatro Municipal Paulo Machado de Carvalho - SCS</p></div>');

  const target = new Date('2026-09-03T09:00:00-03:00').getTime();
  const update = () => {
    const remaining = Math.max(0, target - Date.now());
    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    document.querySelector('#countdown-days').textContent = String(days).padStart(2, '0');
    document.querySelector('#countdown-hours').textContent = String(hours).padStart(2, '0');
    document.querySelector('#countdown-minutes').textContent = String(minutes).padStart(2, '0');
    document.querySelector('#countdown-seconds').textContent = String(seconds).padStart(2, '0');
    document.querySelector('#event-countdown').classList.toggle('is-live', remaining === 0);
  };
  update();
  window.setInterval(update, 1000);
}

function sectionCtaMarkup(buttonClass = 'button-gold') {
  return `<div class="section-cta"><a class="button ${buttonClass}" href="#inscricao">Quero participar</a><span class="cta-note">Evento gratuito · vagas limitadas</span></div>`;
}

function insertSectionCta(selector, buttonClass = 'button-gold') {
  const target = document.querySelector(selector);
  if (!target || target.nextElementSibling?.classList.contains('section-cta')) return;
  target.insertAdjacentHTML('afterend', sectionCtaMarkup(buttonClass));
}

function setupSectionCtas() {
  insertSectionCta('.manifesto .manifesto-grid');
  insertSectionCta('.editorial-copy > p:last-of-type');
  insertSectionCta('.questions .question-list');
  insertSectionCta('.stage .profiles');
  insertSectionCta('.path .path-rows');
  insertSectionCta('.outcomes .outcome-lines', 'button-navy');
  insertSectionCta('.wow-tax .services');
  insertSectionCta('.location .location-data');
  insertSectionCta('.faq .faq-list');

  const formButton = document.querySelector('#registration-form button[type="submit"]');
  if (formButton && !formButton.nextElementSibling?.classList.contains('form-free-note')) {
    formButton.insertAdjacentHTML('afterend', '<span class="form-free-note">Evento gratuito · vagas limitadas</span>');
  }
}

function setupPixelEvents() {
  // Delegated click for all CTAs that scroll to #inscricao (including dynamically injected section-cta)
  document.addEventListener('click', (e) => {
    const cta = e.target.closest('a[href="#inscricao"], .header-cta, .section-cta a, .hero-copy .button');
    if (cta) {
      const label = cta.textContent.trim().slice(0, 40) || 'CTA_Quero_Participar';
      trackCtaClick(label);
    }
  });
  // InitiateCheckout on first interaction with form
  if (form) {
    ['focus', 'click'].forEach((evt) => {
      form.addEventListener(evt, trackInitiateCheckout, { once: true, capture: true });
    });
  }
}

function setupScarcity() {
  const badge = document.querySelector('[data-scarcity]');
  if (!badge || !app) return;
  const number = badge.querySelector('[data-remaining]');
  app.availableSlots().then((payload) => {
    const value = Number(payload?.scarcity ?? Math.min(40, Number(payload ?? 0)));
    const shown = Math.max(1, Math.min(40, value));
    if (number) number.textContent = shown;
    badge.classList.toggle('is-closing', shown <= 10);
    setupSocialProof(payload?.recentSignups || []);
  }).catch(() => {});
}

function setupSocialProof(signups) {
  if (!signups.length) return;
  const today = new Date().toISOString().slice(0, 10);
  const recent = signups.filter((item) => {
    const date = new Date(item.createdAt).toISOString().slice(0, 10);
    return date === today;
  });
  const poolList = recent.length ? recent : signups;
  let index = 0;
  let seen = new Set();
  const region = document.createElement('div');
  region.className = 'proof-region';
  region.setAttribute('aria-live', 'polite');
  document.body.appendChild(region);

  const showItem = (item) => {
    const key = `${item.firstName}|${item.createdAt}`;
    if (seen.has(key)) return;
    seen.add(key);
    const region = document.querySelector('.proof-region');
    if (!region) return;
    const toast = document.createElement('article');
    toast.className = 'proof-toast';
    toast.innerHTML = `<span class="proof-avatar" aria-hidden="true">${escapeHtml(String(item.firstName || '').slice(0, 1).toUpperCase())}</span><div><strong>${escapeHtml(item.firstName || 'Alguém')} acabou de se inscrever</strong><span class="proof-caption">Presença confirmada · ${escapeHtml(item.company || 'evento')}</span></div>`;
    region.appendChild(toast);
    window.requestAnimationFrame(() => toast.classList.add('is-visible'));
    window.setTimeout(() => {
      toast.remove();
      scheduleNext();
    }, 5200);
  };

  const scheduleNext = () => {
    window.setTimeout(() => {
      const item = poolList[index % poolList.length];
      index += 1;
      showItem(item);
    }, 18000 + Math.floor(Math.random() * 22000));
  };

  scheduleNext();
}

updateLandingCopy();
setupLeadForm();
setupCountdown();
setupSectionCtas();
setupScarcity();
setupPixelEvents();

if (form && app) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const submitButton = form.querySelector('button[type="submit"]');
    const submitLabel = submitButton?.textContent || 'Confirmar inscrição';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Enviando...';
    }
    const formData = new FormData(form);
    try {
      const availability = await app.availableSlots();
      if (Number(availability?.availableSlots ?? 0) <= 0) {
        window.alert('As vagas já foram preenchidas.');
        return;
      }
      const lead = await app.addLead({
        name: formData.get('company'),
        email: formData.get('email'),
        company: formData.get('company'),
        phone: formData.get('phone'),
        cnpj: '',
        consent: true
      });
      // Meta Pixel - CompleteRegistration (browser) with deduplication ID matching CAPI
      try {
        const eventId = 'lead_' + lead.id;
        trackCompleteRegistration({
          email: formData.get('email'),
          phone: formData.get('phone')
        }, eventId);
        // Small delay to ensure fbq beacon fires before redirect (beacon is async, 300ms max)
        await new Promise((r) => setTimeout(r, 250));
      } catch (e) { /* pixel failure should not block redirect */ }
      const emailState = lead.emailStatus === 'sent' ? '' : '&email=failed';
      window.location.href = `/obrigado?id=${encodeURIComponent(lead.id)}${emailState}`;
    } catch (error) {
      window.alert(error.message || 'Não foi possível concluir sua inscrição. Tente novamente.');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitLabel;
      }
    }
  });
}
