const crypto = require('node:crypto');
const { Pool } = require('pg');

const TOTAL_SLOTS = 1600;
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'wowtax',
  user: process.env.DB_USER || 'wowtax',
  password: process.env.DB_PASSWORD || '',
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const digest = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${digest.toString('hex')}`;
}

function verifyPassword(password, encoded) {
  const [, saltHex, digestHex] = String(encoded || '').split('$');
  if (!saltHex || !digestHex) return false;
  try {
    const digest = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64).toString('hex');
    const left = Buffer.from(digest);
    const right = Buffer.from(digestHex);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  } catch (error) {
    return false;
  }
}

function rowToLead(row) {
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    email: row.email,
    company: row.company,
    phone: row.phone,
    consent: row.consent,
    status: row.status,
    validatedAt: row.validated_at,
    validatedBy: row.validated_by,
    voucherCode: row.voucher_code,
    backupCode: row.backup_code,
    qrPayload: row.qr_payload
  };
}

function rowToAdmin(row) {
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    email: row.email,
    role: row.role
  };
}

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'Administrador',
      password_hash TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT NOT NULL,
      phone TEXT NOT NULL,
      consent BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'validado')),
      validated_at TIMESTAMPTZ,
      validated_by TEXT,
      voucher_code TEXT NOT NULL UNIQUE,
      backup_code TEXT NOT NULL UNIQUE,
      qr_payload TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
  `);

  await pool.query(`
    INSERT INTO app_settings (key, value)
    VALUES ('total_slots', $1)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `, [String(TOTAL_SLOTS)]);

  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPasswordHash = String(process.env.ADMIN_PASSWORD_HASH || '');
  const adminPassword = String(process.env.ADMIN_PASSWORD || '');
  if (!adminEmail || (!adminPasswordHash && !adminPassword)) {
    throw new Error('Configure ADMIN_EMAIL and ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH) before starting the server.');
  }
  const existing = await pool.query('SELECT id FROM admins WHERE email = $1 LIMIT 1', [adminEmail]);
  if (!existing.rowCount) {
    await pool.query(
      `INSERT INTO admins (id, name, email, role, password_hash) VALUES ($1, $2, $3, $4, $5)`,
      [`admin_${crypto.randomUUID()}`, 'Equipe WOW Tax', adminEmail, 'Administrador', adminPasswordHash || hashPassword(adminPassword)]
    );
  }
}

async function getAdminByEmail(email) {
  const result = await pool.query('SELECT * FROM admins WHERE lower(email) = lower($1) AND active = TRUE LIMIT 1', [email]);
  return result.rows[0] || null;
}

async function getAdminById(id) {
  const result = await pool.query('SELECT * FROM admins WHERE id = $1 AND active = TRUE LIMIT 1', [id]);
  return result.rows[0] || null;
}

async function createSession(adminId, ttlMs) {
  const id = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ttlMs);
  await pool.query('INSERT INTO sessions (id, admin_id, expires_at) VALUES ($1, $2, $3)', [id, adminId, expiresAt]);
  return { id, expiresAt };
}

async function getSession(id) {
  if (!id) return null;
  const result = await pool.query(
    `SELECT s.id, s.expires_at, a.id AS admin_id, a.email, a.name, a.role
     FROM sessions s JOIN admins a ON a.id = s.admin_id
     WHERE s.id = $1 AND s.expires_at > NOW() AND a.active = TRUE`,
    [id]
  );
  if (!result.rowCount) return null;
  return result.rows[0];
}

async function deleteSession(id) {
  if (id) await pool.query('DELETE FROM sessions WHERE id = $1', [id]);
}

async function cleanupSessions() {
  await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
}

async function listLeads() {
  const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
  return result.rows.map(rowToLead);
}

async function countLeads() {
  const result = await pool.query('SELECT COUNT(*)::int AS count FROM leads');
  return result.rows[0].count;
}

async function availableSlots() {
  const result = await pool.query("SELECT value::int AS total FROM app_settings WHERE key = 'total_slots'");
  const total = result.rows[0]?.total ?? TOTAL_SLOTS;
  return Math.max(0, total - await countLeads());
}

async function getLead(id) {
  const result = await pool.query('SELECT * FROM leads WHERE id = $1 LIMIT 1', [id]);
  return rowToLead(result.rows[0]);
}

async function getLeadByCode(code) {
  const normalized = String(code || '').toUpperCase().replace(/\s/g, '');
  if (!normalized) return null;
  const result = await pool.query(
    `SELECT * FROM leads
     WHERE upper(replace(voucher_code, ' ', '')) = $1
        OR upper(replace(backup_code, ' ', '')) = $1
        OR qr_payload = $2
     LIMIT 1`,
    [normalized, code]
  );
  return rowToLead(result.rows[0]);
}

async function createLead(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const settings = await client.query("SELECT value::int AS total FROM app_settings WHERE key = 'total_slots' FOR UPDATE");
    const total = settings.rows[0]?.total ?? TOTAL_SLOTS;
    const countResult = await client.query('SELECT COUNT(*)::int AS count FROM leads');
    if (countResult.rows[0].count >= total) {
      const error = new Error('As vagas já foram preenchidas.');
      error.code = 'SLOTS_FULL';
      throw error;
    }

    const id = `lead_${crypto.randomUUID()}`;
    const voucherCode = `WOW26-${randomCode(6)}`;
    const backupCode = `W26-${randomCode(4)}-${randomCode(4)}`;
    const qrPayload = `WOWTAX|${id}|${voucherCode}|${backupCode}`;
    const result = await client.query(
      `INSERT INTO leads (id, name, email, company, phone, consent, voucher_code, backup_code, qr_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, String(data.name || '').trim(), String(data.email || '').trim().toLowerCase(), String(data.company || '').trim(), String(data.phone || '').trim(), Boolean(data.consent), voucherCode, backupCode, qrPayload]
    );
    await client.query('COMMIT');
    return rowToLead(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateLead(id, changes) {
  const allowed = {
    status: changes.status,
    validated_at: changes.validatedAt || null,
    validated_by: changes.validatedBy || null
  };
  const result = await pool.query(
    `UPDATE leads SET status = COALESCE($2, status), validated_at = $3, validated_by = $4
     WHERE id = $1 RETURNING *`,
    [id, allowed.status || null, allowed.validated_at, allowed.validated_by]
  );
  return rowToLead(result.rows[0]);
}

async function deleteLead(id) {
  const result = await pool.query('DELETE FROM leads WHERE id = $1 RETURNING *', [id]);
  return rowToLead(result.rows[0]);
}

async function listAdmins() {
  const result = await pool.query('SELECT * FROM admins WHERE active = TRUE ORDER BY created_at ASC');
  return result.rows.map(rowToAdmin);
}

async function countAdmins() {
  const result = await pool.query('SELECT COUNT(*)::int AS count FROM admins WHERE active = TRUE');
  return result.rows[0].count;
}

async function createAdmin(data) {
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '');
  if (!email || password.length < 8) {
    const error = new Error('Informe um e-mail e uma senha com pelo menos 8 caracteres.');
    error.code = 'INVALID_ADMIN';
    throw error;
  }
  const result = await pool.query(
    `INSERT INTO admins (id, name, email, role, password_hash)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [`admin_${crypto.randomUUID()}`, String(data.name || '').trim(), email, String(data.role || 'Operador de leads').trim(), hashPassword(password)]
  );
  return rowToAdmin(result.rows[0]);
}

async function deleteAdmin(id, currentAdminId) {
  if (id === currentAdminId) {
    const error = new Error('Você não pode remover o próprio acesso.');
    error.code = 'SELF_REMOVE';
    throw error;
  }
  const result = await pool.query('UPDATE admins SET active = FALSE WHERE id = $1 RETURNING id', [id]);
  return Boolean(result.rowCount);
}

function randomCode(length) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return result;
}

module.exports = {
  TOTAL_SLOTS,
  availableSlots,
  cleanupSessions,
  countAdmins,
  countLeads,
  createAdmin,
  createLead,
  createSession,
  deleteAdmin,
  deleteLead,
  deleteSession,
  getAdminByEmail,
  getAdminById,
  getLead,
  getLeadByCode,
  getSession,
  hashPassword,
  initDatabase,
  listAdmins,
  listLeads,
  pool,
  updateLead,
  verifyPassword
};
