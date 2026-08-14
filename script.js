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

function setupCountdown() {
  const heroCta = document.querySelector('.hero-copy .button');
  if (!heroCta || document.querySelector('#event-countdown')) return;
  heroCta.insertAdjacentHTML('afterend', '<div class="event-countdown" id="event-countdown" aria-live="polite"><div class="countdown-head"><span>CONTAGEM REGRESSIVA</span><strong>Evento gratuito</strong></div><div class="countdown-grid"><div class="countdown-unit"><strong id="countdown-days">--</strong><span>dias</span></div><div class="countdown-unit"><strong id="countdown-hours">--</strong><span>horas</span></div><div class="countdown-unit"><strong id="countdown-minutes">--</strong><span>minutos</span></div><div class="countdown-unit"><strong id="countdown-seconds">--</strong><span>segundos</span></div></div><p class="countdown-caption">até 03 de setembro de 2026 · CENFORPE</p></div>');

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

updateLandingCopy();
setupCountdown();

if (form && app) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (app.availableSlots() <= 0) {
      window.alert('As vagas já foram preenchidas.');
      return;
    }

    const formData = new FormData(form);
    const lead = app.addLead({
      name: formData.get('name'),
      email: formData.get('email'),
      company: formData.get('company'),
      phone: formData.get('phone'),
      consent: formData.get('consent') === 'on'
    });

    window.location.href = `obrigado.html?id=${encodeURIComponent(lead.id)}`;
  });
}
