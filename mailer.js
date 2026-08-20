const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

const SMTP_HOST = String(process.env.SMTP_HOST || '').trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 25);
const SMTP_SECURE = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
const SMTP_USER = String(process.env.SMTP_USER || '').trim();
const SMTP_PASSWORD = String(process.env.SMTP_PASSWORD || '');
const SMTP_FROM = String(process.env.SMTP_FROM || '').trim();
const PUBLIC_URL = String(process.env.PUBLIC_URL || 'https://evento.wowtaxmoment.com').replace(/\/+$/, '');

let transporter;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getTransporter() {
  if (!SMTP_HOST || !SMTP_FROM) {
    const error = new Error('SMTP não configurado. Defina SMTP_HOST e SMTP_FROM no ambiente.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000
    });
  }
  return transporter;
}

function receiptUrl(lead) {
  return `${PUBLIC_URL}/obrigado?id=${encodeURIComponent(lead.id)}`;
}

function receiptHtml(lead) {
  const safeName = escapeHtml(lead.name);
  const safeCompany = escapeHtml(lead.company);
  const safeCnpj = escapeHtml(lead.cnpj);
  const safeVoucher = escapeHtml(lead.voucherCode);
  const safeBackup = escapeHtml(lead.backupCode);
  const safeUrl = escapeHtml(receiptUrl(lead));
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f4f0e8;color:#14293a;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f0e8;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fffdf9;border:1px solid #ded8cc;">
          <tr><td style="padding:28px 32px;border-bottom:3px solid #c7a46a;">
            <div style="color:#c7a46a;font-size:11px;font-weight:700;letter-spacing:2px;">WOW TAX · EVENTO 2026</div>
            <h1 style="margin:12px 0 0;color:#0c2032;font:400 34px Georgia,serif;">Comprovante de inscrição</h1>
          </td></tr>
          <tr><td style="padding:28px 32px;">
            <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Olá, <strong>${safeName}</strong>. Sua inscrição para o evento foi confirmada.</p>
            <p style="margin:0 0 24px;color:#64717a;font-size:14px;line-height:1.6;">Apresente este QR Code na recepção do Teatro Municipal Paulo Machado de Carvalho - SCS. O código backup abaixo serve como alternativa caso a leitura não funcione.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #ded8cc;border-bottom:1px solid #ded8cc;">
              <tr><td style="padding:14px 0;color:#64717a;font-size:11px;">PARTICIPANTE</td><td align="right" style="padding:14px 0;font-size:13px;font-weight:700;">${safeName}</td></tr>
              <tr><td style="padding:14px 0;color:#64717a;font-size:11px;">EMPRESA</td><td align="right" style="padding:14px 0;font-size:13px;font-weight:700;">${safeCompany}</td></tr>
              <tr><td style="padding:14px 0;color:#64717a;font-size:11px;">CNPJ</td><td align="right" style="padding:14px 0;font-size:13px;font-weight:700;">${safeCnpj}</td></tr>
            </table>
            <div style="margin:26px 0;text-align:center;"><img src="cid:qr-code@wowtax" width="280" height="280" alt="QR Code do voucher" style="display:inline-block;width:280px;height:280px;image-rendering:pixelated;"></div>
            <div style="padding:18px;background:#f4f0e8;text-align:center;">
              <div style="color:#64717a;font-size:10px;letter-spacing:1.5px;">VOUCHER</div>
              <div style="margin:7px 0 18px;color:#c7a46a;font:700 18px monospace;letter-spacing:2px;">${safeVoucher}</div>
              <div style="color:#64717a;font-size:10px;letter-spacing:1.5px;">CÓDIGO BACKUP</div>
              <div style="margin-top:7px;color:#0c2032;font:700 18px monospace;letter-spacing:2px;">${safeBackup}</div>
            </div>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.6;">Se precisar abrir o voucher novamente, use este link:<br><a href="${safeUrl}" style="color:#92723d;">${safeUrl}</a></p>
          </td></tr>
          <tr><td style="padding:22px 32px;background:#0c2032;color:#d9dfdc;font-size:12px;line-height:1.6;">03 de setembro de 2026 · a partir das 9h<br>Teatro Municipal Paulo Machado de Carvalho - SCS<br><span style="color:#ead4a0;">Evento gratuito · vagas limitadas</span></td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function receiptText(lead) {
  return [
    `Olá, ${lead.name}. Sua inscrição para o evento WOW Tax foi confirmada.`,
    '',
    '03 de setembro de 2026 · a partir das 9h',
    'Teatro Municipal Paulo Machado de Carvalho - SCS',
    '',
    `Voucher: ${lead.voucherCode}`,
    `Código backup: ${lead.backupCode}`,
    '',
    `Abra seu voucher: ${receiptUrl(lead)}`
  ].join('\n');
}

async function sendLeadReceipt(lead) {
  const qrBuffer = await QRCode.toBuffer(lead.qrPayload, {
    type: 'png',
    width: 560,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0c2032', light: '#fffdf9' }
  });
  const info = await getTransporter().sendMail({
    from: SMTP_FROM,
    to: lead.email,
    subject: 'Comprovante de inscrição · Evento WOW Tax',
    text: receiptText(lead),
    html: receiptHtml(lead),
    attachments: [{
      filename: `voucher-${lead.voucherCode}.png`,
      content: qrBuffer,
      contentType: 'image/png',
      cid: 'qr-code@wowtax'
    }]
  });
  return { messageId: info.messageId };
}

module.exports = { sendLeadReceipt };
