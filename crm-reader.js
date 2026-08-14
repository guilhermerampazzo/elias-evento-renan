(() => {
  const crm = window.WowTaxCRM;
  if (!crm) return;

  const { app, escapeHtml, renderKpis } = crm;
  const $ = (selector) => document.querySelector(selector);
  let mediaStream = null;
  let animationFrame = null;
  let scannerActive = false;
  let scannerBusy = false;

  const icons = {
    camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H9l1.4-2h3.2L15 6h2.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5Z"/><circle cx="12" cy="12.5" r="3.2"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
    scan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 12h8M12 8v8"/></svg>',
    success: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16.5 9"/></svg>',
    error: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
    warning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 4 9 16H3Z"/><path d="M12 9v4M12 16h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>'
  };

  function setStatus(message, type = '') {
    const element = $('#reader-status');
    element.textContent = message;
    element.className = `reader-status ${type ? `is-${type}` : ''}`;
  }

  function setCameraState(label, type = '') {
    const state = $('#camera-state');
    const stateLabel = $('#camera-state-label');
    if (!state || !stateLabel) return;
    stateLabel.textContent = label;
    state.className = `camera-state ${type ? `is-${type}` : ''}`;
  }

  function setupReaderUi() {
    document.body.classList.add('reader-page');
    const readerWindow = $('.reader-window');
    readerWindow.insertAdjacentHTML('afterbegin', '<div class="reader-window-head"><span class="camera-state" id="camera-state"><i></i><span id="camera-state-label">Câmera inativa</span></span><span class="scan-hint">Enquadre o voucher no centro</span></div>');
    $('#reader-placeholder').insertAdjacentHTML('afterbegin', `<span class="reader-placeholder-mark">${icons.scan}</span>`);
    $('#start-reader').innerHTML = `${icons.camera}<span>Abrir câmera</span>`;
    $('#stop-reader').innerHTML = `${icons.stop}<span>Parar câmera</span>`;
    $('#manual-code-form button').innerHTML = `${icons.check}<span>Validar</span>`;
    const toastRegion = document.createElement('div');
    toastRegion.id = 'reader-toast-region';
    toastRegion.className = 'reader-toast-region';
    toastRegion.setAttribute('aria-live', 'polite');
    toastRegion.setAttribute('aria-atomic', 'true');
    document.body.appendChild(toastRegion);
  }

  function showToast(title, message, type = 'info') {
    const region = $('#reader-toast-region');
    if (!region) return;
    const toast = document.createElement('article');
    toast.className = `reader-toast is-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div><button class="toast-close" type="button" aria-label="Fechar aviso">×</button>`;
    region.appendChild(toast);
    const close = () => {
      toast.classList.remove('is-visible');
      window.setTimeout(() => toast.remove(), 180);
    };
    toast.querySelector('.toast-close').addEventListener('click', close);
    window.requestAnimationFrame(() => toast.classList.add('is-visible'));
    window.setTimeout(close, type === 'success' ? 5600 : 6500);
  }

  function resolveCode(rawCode) {
    const code = String(rawCode || '').trim();
    if (!code) return null;
    if (code.startsWith('WOWTAX|')) {
      const parts = code.split('|');
      return app.getLead(parts[1]) || app.getLeads().find((lead) => lead.voucherCode === parts[2]);
    }
    const normalized = code.toUpperCase().replace(/\s/g, '');
    return app.getLeads().find((lead) => [lead.voucherCode, lead.backupCode].some((value) => value.toUpperCase().replace(/\s/g, '') === normalized)) || null;
  }

  function validateCode(rawCode) {
    const lead = resolveCode(rawCode);
    if (!lead) {
      setStatus('Código não encontrado nesta base de participantes.', 'error');
      showToast('Não foi possível escanear', 'O QR Code ou código informado não corresponde a uma inscrição.', 'error');
      return false;
    }
    if (lead.status === 'validado') {
      setStatus(`Atenção: ${lead.name} já teve a entrada validada.`, 'error');
      showToast('Entrada já validada', `${lead.name} já fez check-in neste evento.`, 'warning');
      return false;
    }
    app.updateLead(lead.id, { status: 'validado', validatedAt: new Date().toISOString(), validatedBy: 'Leitor QR' });
    renderKpis();
    setStatus(`Entrada confirmada: ${lead.name}.`, 'success');
    showToast('Voucher aprovado', `${lead.name} está autorizado(a) a participar do evento.`, 'success');
    return true;
  }

  function stopReader() {
    scannerActive = false;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
    $('#qr-video').srcObject = null;
    $('.reader-window').classList.remove('is-active');
    $('#start-reader').disabled = false;
    $('#stop-reader').disabled = true;
    setCameraState('Câmera inativa');
  }

  async function scanFrame() {
    if (!scannerActive || scannerBusy) return;
    const video = $('#qr-video');
    if (video.readyState < 2 || !video.videoWidth) { animationFrame = requestAnimationFrame(scanFrame); return; }
    scannerBusy = true;
    const canvas = $('#qr-reader-canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      if (typeof window.jsQR === 'function') {
        const result = window.jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
        if (result?.data) { validateCode(result.data); stopReader(); scannerBusy = false; return; }
      }
    } finally { scannerBusy = false; }
    animationFrame = requestAnimationFrame(scanFrame);
  }

  async function startReader() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('Câmera indisponível', 'error');
      setStatus('A câmera não está disponível neste navegador. Use o código backup.', 'error');
      showToast('Não foi possível escanear', 'A câmera não está disponível neste navegador. Use o código backup.', 'error');
      return;
    }
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      const video = $('#qr-video');
      video.srcObject = mediaStream;
      await video.play();
      scannerActive = true;
      $('.reader-window').classList.add('is-active');
      $('#start-reader').disabled = true;
      $('#stop-reader').disabled = false;
      setCameraState('Câmera ativa', 'active');
      setStatus('Câmera ativa. Aponte para o QR Code.', 'success');
      showToast('Câmera ativa', 'Aponte o voucher para o quadro de leitura.', 'info');
      animationFrame = requestAnimationFrame(scanFrame);
    } catch (error) {
      setCameraState('Câmera bloqueada', 'error');
      setStatus('Não foi possível abrir a câmera. Confira a permissão ou use o código backup.', 'error');
      showToast('Não foi possível escanear', 'Libere a permissão da câmera ou valide usando o código backup.', 'error');
    }
  }

  setupReaderUi();
  $('#start-reader').addEventListener('click', startReader);
  $('#stop-reader').addEventListener('click', stopReader);
  $('#manual-code-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get('code');
    validateCode(code);
    event.currentTarget.reset();
  });
  window.addEventListener('beforeunload', stopReader);
})();
