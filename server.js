const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const db = require('./database');
const { sendLeadReceipt } = require('./mailer');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const SESSION_TTL_MS = Math.max(1, Number(process.env.SESSION_TTL_HOURS || 8)) * 60 * 60 * 1000;
const SCARCITY_BASE = Math.max(10, Number(process.env.SCARCITY_BASE || 40));
const MAX_BODY_BYTES = 32 * 1024;

// Meta CAPI (privado - nunca exposto no HTML)
const META_PIXEL_ID = String(process.env.META_PIXEL_ID || '1051554627771938').trim();
const META_ACCESS_TOKEN = String(process.env.META_ACCESS_TOKEN || '').trim();
const META_TEST_EVENT_CODE = String(process.env.META_TEST_EVENT_CODE || '').trim();
const PUBLIC_URL = String(process.env.PUBLIC_URL || 'https://evento.wowtaxmoment.com').replace(/\/$/, '');

function sha256Hex(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return null;
  return crypto.createHash('sha256').update(v, 'utf8').digest('hex');
}
function getHashedUserData(lead, request) {
  const cookies = parseCookies(request);
  const email = lead && lead.email ? String(lead.email).trim().toLowerCase() : null;
  const phoneDigits = lead && lead.phone ? String(lead.phone).replace(/\D/g, '') : null;
  // Meta expects phone with country code; normalize to 55+digits if missing
  let phNorm = null;
  if (phoneDigits) {
    phNorm = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;
  }
  const ud = {};
  const emHash = email ? sha256Hex(email) : null;
  if (emHash) ud.em = [emHash];
  const phHash = phNorm ? sha256Hex(phNorm) : null;
  if (phHash) ud.ph = [phHash];
  // Optional: name hashing for better match
  if (lead && lead.name) {
    const parts = String(lead.name).trim().toLowerCase().split(/\s+/);
    if (parts[0]) { const h = sha256Hex(parts[0]); if (h) ud.fn = [h]; }
    if (parts.length > 1) { const h = sha256Hex(parts.slice(-1)[0]); if (h) ud.ln = [h]; }
  }
  // Client info (plain, not hashed)
  const ip = (request.headers['x-forwarded-for'] || '').split(',')[0].trim() || clientAddress(request);
  if (ip && ip !== 'unknown') ud.client_ip_address = ip;
  const ua = String(request.headers['user-agent'] || '').trim();
  if (ua) ud.client_user_agent = ua;
  // _fbc / _fbp cookies for attribution
  if (cookies._fbc) ud.fbc = cookies._fbc;
  if (cookies._fbp) ud.fbp = cookies._fbp;
  return ud;
}
function sendMetaCAPI(eventName, lead, request, eventId) {
  if (!META_PIXEL_ID || !META_ACCESS_TOKEN) return Promise.resolve(null);
  const eventTime = Math.floor(Date.now() / 1000);
  const eventSourceUrl = PUBLIC_URL + (request.headers.referer || request.headers.origin || '/');
  // BUILD payload
  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime,
        event_id: eventId || `lead_${lead && lead.id ? lead.id : Date.now()}`,
        action_source: 'website',
        event_source_url: eventSourceUrl,
        user_data: getHashedUserData(lead, request)
      }
    ]
  };
  if (META_TEST_EVENT_CODE) payload.test_event_code = META_TEST_EVENT_CODE;
  const body = JSON.stringify(payload);
  const options = {
    hostname: 'graph.facebook.com',
    path: `/v20.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };
  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (process.env.META_PIXEL_DEBUG === 'true') console.log('[CAPI] success', eventName, data);
          resolve(data);
        } else {
          console.error('[CAPI] failed', res.statusCode, data);
          resolve(null);
        }
      });
    });
    req.on('error', (err) => {
      console.error('[CAPI] error', err.message);
      resolve(null);
    });
    req.write(body);
    req.end();
  });
}

const PAGE_ROUTES = new Map([
  ['/index.html', '/'],
  ['/login.html', '/login'],
  ['/obrigado.html', '/obrigado'],
  ['/crm.html', '/crm'],
  ['/leads.html', '/leads'],
  ['/leitor.html', '/leitor'],
  ['/admins.html', '/administradores']
]);

const CLEAN_PAGES = new Map([
  ['/login', 'login.html'],
  ['/obrigado', 'obrigado.html'],
  ['/crm', 'crm.html'],
  ['/leads', 'leads.html'],
  ['/leitor', 'leitor.html'],
  ['/administradores', 'admins.html']
]);

const PROTECTED_PAGES = new Set(['/crm', '/leads', '/leitor', '/administradores']);
const failedLogins = new Map();
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
};

function safeEqual(left, right) {
  const crypto = require('node:crypto');
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(request) {
  return String(request.headers.cookie || '').split(';').reduce((cookies, part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return cookies;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

async function getSession(request) {
  return db.getSession(parseCookies(request).wow_tax_session);
}

function sessionCookie(token, maxAge = Math.floor(SESSION_TTL_MS / 1000)) {
  const secure = NODE_ENV === 'production' ? '; Secure' : '';
  return `wow_tax_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...headers
  });
  response.end(JSON.stringify(payload));
}

function redirect(response, location, statusCode = 302) {
  response.writeHead(statusCode, { Location: location, 'Cache-Control': 'no-store' });
  response.end();
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
        request.destroy();
      }
    });
    request.on('end', () => {
      if (!body) return resolve({});
      try {
        const contentType = String(request.headers['content-type'] || '');
        if (contentType.includes('application/json')) return resolve(JSON.parse(body));
        return resolve(Object.fromEntries(new URLSearchParams(body)));
      } catch (error) {
        reject(Object.assign(new Error('Invalid request body'), { statusCode: 400 }));
      }
    });
    request.on('error', reject);
  });
}

function clientAddress(request) {
  return String(request.socket.remoteAddress || 'unknown');
}

function isRateLimited(request) {
  const record = failedLogins.get(clientAddress(request));
  if (!record) return false;
  if (record.resetAt <= Date.now()) {
    failedLogins.delete(clientAddress(request));
    return false;
  }
  return record.count >= 10;
}

function recordFailedLogin(request) {
  const key = clientAddress(request);
  const current = failedLogins.get(key);
  const now = Date.now();
  if (!current || current.resetAt <= now) {
    failedLogins.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return;
  }
  current.count += 1;
}

function safeNext(value) {
  const candidate = String(value || '');
  return candidate.startsWith('/') && !candidate.startsWith('//') ? candidate : '/crm';
}

function safeFilePath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const requested = path.resolve(ROOT, `.${decoded}`);
  return requested.startsWith(ROOT + path.sep) || requested === ROOT ? requested : null;
}

function serveFile(response, filename) {
  const filePath = safeFilePath(`/${filename}`);
  if (!filePath) return sendJson(response, 400, { error: 'Invalid file path' });
  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) return sendJson(response, 404, { error: 'Not found' });
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=0, must-revalidate',
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff'
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

function serveStatic(response, urlPath) {
  const filePath = safeFilePath(urlPath);
  if (!filePath) return sendJson(response, 400, { error: 'Invalid file path' });
  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) return sendJson(response, 404, { error: 'Not found' });
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff'
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

function publicLead(lead) {
  if (!lead) return null;
  return {
    id: lead.id,
    createdAt: lead.createdAt,
    name: lead.name,
    company: lead.company,
    voucherCode: lead.voucherCode,
    backupCode: lead.backupCode,
    qrPayload: lead.qrPayload
  };
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatPhone(value) {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCnpj(value) {
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

function leadInput(body) {
  const phoneDigits = digitsOnly(body.phone);
  const cnpjDigits = digitsOnly(body.cnpj);
  const data = {
    name: String(body.name || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    company: String(body.company || '').trim(),
    phone: formatPhone(phoneDigits),
    cnpj: formatCnpj(cnpjDigits),
    consent: Boolean(body.consent)
  };
  if (!data.name || !data.email || !data.company || phoneDigits.length < 10 || phoneDigits.length > 11 || !isValidCnpj(cnpjDigits) || !data.consent) {
    const error = new Error('Preencha os campos obrigatórios com dados válidos e aceite receber informações sobre o evento.');
    error.code = 'INVALID_LEAD';
    throw error;
  }
  return data;
}

async function handleApi(request, response, pathname, requestUrl) {
  if (pathname === '/api/auth/me' && request.method === 'GET') {
    const session = await getSession(request);
    if (!session) return sendJson(response, 401, { authenticated: false });
    return sendJson(response, 200, { authenticated: true, user: { id: session.admin_id, email: session.email, name: session.name, role: session.role } });
  }

  if (pathname === '/api/auth/login' && request.method === 'POST') {
    if (isRateLimited(request)) return sendJson(response, 429, { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    let body;
    try { body = await readBody(request); } catch (error) { return sendJson(response, error.statusCode || 400, { error: error.message }); }
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const admin = await db.getAdminByEmail(email);
    if (!admin || !safeEqual(email, admin.email) || !db.verifyPassword(password, admin.password_hash)) {
      recordFailedLogin(request);
      return sendJson(response, 401, { error: 'E-mail ou senha inválidos.' });
    }
    failedLogins.delete(clientAddress(request));
    const session = await db.createSession(admin.id, SESSION_TTL_MS);
    return sendJson(response, 200, { authenticated: true, user: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } }, { 'Set-Cookie': sessionCookie(session.id) });
  }

  if (pathname === '/api/auth/logout' && (request.method === 'POST' || request.method === 'GET')) {
    const session = await getSession(request);
    if (session) await db.deleteSession(session.id);
    return sendJson(response, 200, { authenticated: false }, { 'Set-Cookie': sessionCookie('', 0) });
  }

  if (pathname === '/api/leads' && request.method === 'POST') {
    let body;
    try { body = await readBody(request); } catch (error) { return sendJson(response, error.statusCode || 400, { error: error.message }); }
    try {
      const lead = await db.createLead(leadInput(body));
      // Fire CAPI server-side (non-blocking for user, deduplicated with browser via event_id lead_<id>)
      const capiEventId = `lead_${lead.id}`;
      sendMetaCAPI('CompleteRegistration', lead, request, capiEventId).catch(() => {});
      // Also send Lead event for optimization flexibility
      sendMetaCAPI('Lead', lead, request, `lead_lead_${lead.id}`).catch(() => {});
      try {
        await sendLeadReceipt(lead);
        await db.updateLeadEmailStatus(lead.id, 'sent');
        return sendJson(response, 201, { lead: { ...lead, emailStatus: 'sent' }, emailStatus: 'sent' });
      } catch (emailError) {
        console.error(`Lead receipt email failed for ${lead.id}:`, emailError.message);
        await db.updateLeadEmailStatus(lead.id, 'failed', emailError.message);
        return sendJson(response, 201, {
          lead: { ...lead, emailStatus: 'failed' },
          emailStatus: 'failed',
          emailMessage: 'Inscrição confirmada, mas não foi possível enviar o comprovante por e-mail.'
        });
      }
    } catch (error) {
      if (error.code === 'SLOTS_FULL') return sendJson(response, 409, { error: error.message });
      if (error.code === 'INVALID_LEAD') return sendJson(response, 400, { error: error.message });
      throw error;
    }
  }

  const leadMatch = pathname.match(/^\/api\/leads\/([^/]+)$/);
  if (leadMatch && request.method === 'GET') {
    const lead = await db.getLead(decodeURIComponent(leadMatch[1]));
    if (!lead) return sendJson(response, 404, { error: 'Inscrição não encontrada.' });
    const session = await getSession(request);
    return sendJson(response, 200, { lead: session ? lead : publicLead(lead) });
  }

  if (pathname === '/api/leads' && request.method === 'GET') {
    if (!await getSession(request)) return sendJson(response, 401, { error: 'Não autenticado.' });
    return sendJson(response, 200, { leads: await db.listLeads() });
  }

  if (leadMatch && request.method === 'PATCH') {
    if (!await getSession(request)) return sendJson(response, 401, { error: 'Não autenticado.' });
    let body;
    try { body = await readBody(request); } catch (error) { return sendJson(response, error.statusCode || 400, { error: error.message }); }
    const updated = await db.updateLead(decodeURIComponent(leadMatch[1]), body);
    if (!updated) return sendJson(response, 404, { error: 'Inscrição não encontrada.' });
    return sendJson(response, 200, { lead: updated });
  }

  if (leadMatch && request.method === 'DELETE') {
    if (!await getSession(request)) return sendJson(response, 401, { error: 'Não autenticado.' });
    const removed = await db.deleteLead(decodeURIComponent(leadMatch[1]));
    if (!removed) return sendJson(response, 404, { error: 'Inscrição não encontrada.' });
    return sendJson(response, 200, { lead: removed });
  }

  if (pathname === '/api/checkins/resolve' && request.method === 'POST') {
    if (!await getSession(request)) return sendJson(response, 401, { error: 'Não autenticado.' });
    let body;
    try { body = await readBody(request); } catch (error) { return sendJson(response, error.statusCode || 400, { error: error.message }); }
    let rawCode = String(body.code || '').trim();
    if (rawCode.startsWith('WOWTAX|')) {
      const parts = rawCode.split('|');
      rawCode = parts[1] || rawCode;
    }
    const lead = await db.getLeadByCode(rawCode);
    if (!lead && String(body.code || '').startsWith('WOWTAX|')) {
      const parts = String(body.code).split('|');
      const byId = await db.getLead(parts[1]);
      if (byId && byId.qrPayload === body.code) return sendJson(response, 200, { lead: byId });
    }
    return sendJson(response, lead ? 200 : 404, lead ? { lead } : { error: 'Código não encontrado.' });
  }

  if (pathname === '/api/availability' && request.method === 'GET') {
    const scarcity = Math.max(1, SCARCITY_BASE - await db.countLeadsToday());
    return sendJson(response, 200, {
      availableSlots: await db.availableSlots(),
      scarcity,
      recentSignups: await db.recentLeadSignups(6)
    });
  }

  if (pathname === '/api/signups/live' && request.method === 'GET') {
    return sendJson(response, 200, { recentSignups: await db.recentLeadSignups(6) });
  }

  if (pathname === '/api/stats' && request.method === 'GET') {
    if (!await getSession(request)) return sendJson(response, 401, { error: 'Não autenticado.' });
    const [leads, available, admins] = await Promise.all([db.listLeads(), db.availableSlots(), db.countAdmins()]);
    return sendJson(response, 200, { leads, availableSlots: available, adminsCount: admins });
  }

  if (pathname === '/api/admins' && request.method === 'GET') {
    if (!await getSession(request)) return sendJson(response, 401, { error: 'Não autenticado.' });
    return sendJson(response, 200, { admins: await db.listAdmins() });
  }

  if (pathname === '/api/admins' && request.method === 'POST') {
    if (!await getSession(request)) return sendJson(response, 401, { error: 'Não autenticado.' });
    let body;
    try { body = await readBody(request); } catch (error) { return sendJson(response, error.statusCode || 400, { error: error.message }); }
    try {
      const admin = await db.createAdmin(body);
      return sendJson(response, 201, { admin });
    } catch (error) {
      if (error.code === 'INVALID_ADMIN' || error.code === '23505') return sendJson(response, 400, { error: error.code === '23505' ? 'Este e-mail já possui um acesso.' : error.message });
      throw error;
    }
  }

  const adminMatch = pathname.match(/^\/api\/admins\/([^/]+)$/);
  if (adminMatch && request.method === 'DELETE') {
    const session = await getSession(request);
    if (!session) return sendJson(response, 401, { error: 'Não autenticado.' });
    try {
      const removed = await db.deleteAdmin(decodeURIComponent(adminMatch[1]), session.admin_id);
      return sendJson(response, removed ? 200 : 404, removed ? { removed: true } : { error: 'Administrador não encontrado.' });
    } catch (error) {
      if (error.code === 'SELF_REMOVE') return sendJson(response, 400, { error: error.message });
      throw error;
    }
  }

  if (pathname.startsWith('/api/')) return sendJson(response, 404, { error: 'API route not found' });
  return null;
}

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname.replace(/\/+/g, '/') || '/';
  if (pathname.startsWith('/api/')) {
    const result = await handleApi(request, response, pathname, requestUrl);
    if (result !== null) return result;
  }

  if (PAGE_ROUTES.has(pathname)) return redirect(response, `${PAGE_ROUTES.get(pathname)}${requestUrl.search}`);
  if (CLEAN_PAGES.has(pathname)) {
    if (PROTECTED_PAGES.has(pathname) && !await getSession(request)) {
      return redirect(response, `/login?next=${encodeURIComponent(`${pathname}${requestUrl.search}`)}`);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { error: 'Method not allowed' });
    return serveFile(response, CLEAN_PAGES.get(pathname));
  }
  if (pathname === '/') {
    if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { error: 'Method not allowed' });
    return serveFile(response, 'index.html');
  }
  if (pathname.endsWith('.html')) return sendJson(response, 404, { error: 'Not found' });
  if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { error: 'Method not allowed' });
  return serveStatic(response, pathname);
}

async function start() {
  await db.initDatabase();
  setInterval(() => db.cleanupSessions().catch((error) => console.error('Session cleanup failed:', error.message)), 10 * 60 * 1000).unref();
  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      console.error(error);
      if (!response.headersSent) sendJson(response, 500, { error: 'Erro interno do servidor' });
      else response.destroy();
    });
  });
  server.listen(PORT, HOST, () => console.log(`WOW Tax Event listening on http://${HOST}:${PORT}`));
}

start().catch((error) => {
  console.error('Could not start WOW Tax Event:', error.message);
  process.exit(1);
});
