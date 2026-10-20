import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export const normalizeEmail = (email) => typeof email === 'string' ? email.trim().toLowerCase() : '';
export const validEmail = (email) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  // Perform the same expensive operation even when the address has no account.
  const [salt, expected] = stored?.split(':') || ['00000000000000000000000000000000', '00'.repeat(64)];
  const actual = await scrypt(password, salt, 64);
  const expectedBytes = Buffer.from(expected, 'hex');
  return expectedBytes.length === actual.length && timingSafeEqual(actual, expectedBytes) && Boolean(stored);
}

function validateCredentials(email, password) {
  email = normalizeEmail(email);
  if (!validEmail(email)) throw new Error('Informe um e-mail válido para o administrador.');
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) {
    throw new Error('A senha deve ter de 12 a 256 caracteres.');
  }
  return email;
}

export async function createAdmin(db, email, password) {
  email = validateCredentials(email, password);
  if (db.prepare('SELECT id FROM admins WHERE email = ?').get(email)) {
    throw new Error('Já existe um administrador com esse e-mail.');
  }
  const passwordHash = await hashPassword(password);
  db.prepare('INSERT INTO admins (email, password_hash, created_at) VALUES (?, ?, ?)')
    .run(email, passwordHash, new Date().toISOString());
  return { email };
}

export async function resetAdminPassword(db, email, password) {
  email = validateCredentials(email, password);
  if (!db.prepare('SELECT id FROM admins WHERE email = ?').get(email)) {
    throw new Error('Nenhum administrador encontrado com esse e-mail.');
  }
  const passwordHash = await hashPassword(password);
  db.exec('BEGIN IMMEDIATE');
  try {
    const admin = db.prepare('SELECT id FROM admins WHERE email = ?').get(email);
    if (!admin) throw new Error('Nenhum administrador encontrado com esse e-mail.');
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(passwordHash, admin.id);
    db.prepare('DELETE FROM sessions WHERE admin_id = ?').run(admin.id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { email };
}
