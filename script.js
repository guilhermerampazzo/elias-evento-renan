const form = document.querySelector('#registration-form');
const app = window.WowTaxApp;

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
  const companyInput = form.querySelector('input[name="company"]');
  const phoneInput = form.querySelector('input[name="phone"]');
  if (!companyInput || !phoneInput) return;

  if (!form.querySelector('input[name="cnpj"]')) {
    companyInput.closest('label').insertAdjacentHTML('afterend', '<label>CNPJ<input name="cnpj" type="text" inputmode="numeric" autocomplete="organization" maxlength="18" required placeholder="00.000.000/0000-00" /></label>');
  }
  const cnpjInput = form.querySelector('input[name="cnpj"]');
  phoneInput.setAttribute('maxlength', '15');
  phoneInput.setAttribute('inputmode', 'tel');
  phoneInput.addEventListener('input', () => { phoneInput.value = formatPhoneInput(phoneInput.value); });
  cnpjInput.addEventListener('input', () => {
    cnpjInput.value = formatCnpjInput(cnpjInput.value);
    cnpjInput.setCustomValidity(isValidCnpj(cnpjInput.value) ? '' : 'Informe um CNPJ válido.');
  });
  cnpjInput.addEventListener('blur', () => {
    cnpjInput.setCustomValidity(isValidCnpj(cnpjInput.value) ? '' : 'Informe um CNPJ válido.');
  });
}

function setupCountdown() {
  const heroCta = document.querySelector('.hero-copy .button');
  if (!heroCta || document.querySelector('#event-countdown')) return;
  heroCta.insertAdjacentHTML('afterend', '<div class="event-countdown" id="event-countdown" aria-live="polite"><div class="countdown-head"><span>CONTAGEM REGRESSIVA</span><strong>Evento gratuito</strong></div><div class="countdown-grid"><div class="countdown-unit"><strong id="countdown-days">--</strong><span>dias</span></div><div class="countdown-unit"><strong id="countdown-hours">--</strong><span>horas</span></div><div class="countdown-unit"><strong id="countdown-minutes">--</strong><span>minutos</span></div><div class="countdown-unit"><strong id="countdown-seconds">--</strong><span>segundos</span></div></div><p class="countdown-caption">até 03 de setembro de 2026 · Teatro Municipal</p></div>');

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
  const heroCta = document.querySelector('.hero-copy .button');
  if (heroCta && !heroCta.nextElementSibling?.classList.contains('cta-note')) {
    heroCta.insertAdjacentHTML('afterend', '<span class="cta-note hero-free-note">Evento gratuito · vagas limitadas</span>');
  }

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

updateLandingCopy();
setupLeadForm();
setupCountdown();
setupSectionCtas();

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
      if (await app.availableSlots() <= 0) {
        window.alert('As vagas já foram preenchidas.');
        return;
      }
      const lead = await app.addLead({
        name: formData.get('name'),
        email: formData.get('email'),
        company: formData.get('company'),
        phone: formData.get('phone'),
        cnpj: formData.get('cnpj'),
        consent: formData.get('consent') === 'on'
      });
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
