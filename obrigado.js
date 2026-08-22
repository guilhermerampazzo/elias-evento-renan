 (async () => {
  const app = window.WowTaxApp;
  const params = new URLSearchParams(window.location.search);
  const emailStatus = params.get('email');
  const lead = app && await app.getLead(params.get('id'));
  const state = document.querySelector('#voucher-state');

  if (!lead) {
    document.querySelector('#lead-name').textContent = 'inscrição encontrada';
    document.querySelector('#card-name').textContent = 'Não foi possível localizar este voucher';
    state.textContent = 'Volte à página do evento e faça uma nova inscrição para gerar seu voucher.';
    return;
  }

  // Meta Pixel - ViewContent + CompleteRegistration on voucher view (deduplicated with CAPI via eventID lead_<id>)
  try {
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'ViewContent', { content_name: 'Voucher_WOW_03Set', content_ids: [lead.id] });
      // Only fire CompleteRegistration once per voucher view; deduplicated with script.js event via same eventID
      window.fbq('track', 'Lead', { content_name: 'Voucher_View' });
    }
  } catch (e) {}

  document.querySelector('#lead-name').textContent = app.firstName(lead.name) + '.';
  document.querySelector('#card-name').textContent = lead.name;
  document.querySelector('#card-company').textContent = lead.company || 'Não informado';
  document.querySelector('#backup-code').textContent = lead.backupCode;
  document.querySelector('#voucher-code').textContent = lead.voucherCode;
  state.textContent = emailStatus === 'failed'
    ? 'Inscrição confirmada, mas não foi possível enviar o comprovante por e-mail. Salve este voucher ou use o código backup.'
    : 'Comprovante enviado para o e-mail informado. Guarde este voucher; o código backup pode ser usado caso o QR Code não funcione.';

  const qrCanvas = document.querySelector('#qr-canvas');
  if (window.QRCode) {
    window.QRCode.toCanvas(qrCanvas, lead.qrPayload, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0c2032', light: '#fffdf9' }
    }, (error) => {
      if (error) state.textContent = 'Não foi possível desenhar o QR Code. Use o código backup: ' + lead.backupCode;
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function createVoucherImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 1400;
    canvas.height = 900;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f4f0e8';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#fffdf9';
    context.fillRect(64, 64, 1272, 772);
    context.fillStyle = '#0c2032';
    context.font = '800 22px Manrope, Arial';
    context.fillText('WOW TAX', 110, 125);
    context.fillStyle = '#c7a46a';
    context.font = '800 16px Manrope, Arial';
    context.fillText('VOUCHER DE ACESSO · 03 SETEMBRO 2026', 110, 166);
    context.fillStyle = '#0c2032';
    context.font = '400 58px Georgia, serif';
    context.fillText('O impacto da Reforma Tributária', 110, 245);
    context.font = '400 34px Georgia, serif';
    context.fillText('na indústria e no comércio', 110, 295);
    context.font = '800 17px Manrope, Arial';
    context.fillText('INSCRITO', 110, 390);
    context.font = '500 27px Manrope, Arial';
    context.fillText(lead.name, 110, 430);
    context.font = '800 17px Manrope, Arial';
    context.fillText('CÓDIGO BACKUP', 110, 505);
    context.font = '800 28px monospace';
    context.fillStyle = '#c7a46a';
    context.fillText(lead.backupCode, 110, 547);
    context.fillStyle = '#64717a';
    context.font = '500 17px Manrope, Arial';
    context.fillText('Teatro Municipal Paulo Machado de Carvalho - SCS', 110, 714);
    context.fillText('Apresente este voucher na recepção.', 110, 750);
    context.drawImage(qrCanvas, 930, 190, 280, 280);
    context.fillStyle = '#0c2032';
    context.font = '800 18px Manrope, Arial';
    context.fillText(lead.voucherCode, 945, 530);
    return canvas;
  }

  document.querySelector('#save-image').addEventListener('click', () => {
    createVoucherImage().toBlob((blob) => downloadBlob(blob, `voucher-${lead.voucherCode}.png`), 'image/png');
    state.textContent = 'Imagem do voucher salva. O código backup continua disponível nesta página.';
  });

  document.querySelector('#save-pdf').addEventListener('click', () => {
    state.textContent = 'Na janela de impressão, escolha “Salvar como PDF”.';
    window.print();
  });

  document.querySelector('#share-whatsapp').addEventListener('click', async () => {
    const message = app.whatsappMessage(lead, true);
    const image = createVoucherImage();
    try {
      const blob = await new Promise((resolve) => image.toBlob(resolve, 'image/png'));
      const file = new File([blob], `voucher-${lead.voucherCode}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'Voucher WOW Tax', text: message, files: [file] });
        state.textContent = 'Voucher compartilhado.';
        return;
      }
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    state.textContent = 'WhatsApp aberto com a mensagem e o link do voucher. Anexe a imagem salva, se desejar.';
  });

  document.querySelector('#copy-backup').addEventListener('click', async (event) => {
    await navigator.clipboard?.writeText(lead.backupCode);
    event.currentTarget.textContent = 'Copiado';
    state.textContent = 'Código backup copiado para a área de transferência.';
    window.setTimeout(() => { event.currentTarget.textContent = 'Copiar'; }, 1800);
  });
})();
