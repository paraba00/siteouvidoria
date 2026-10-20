import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { statSync, readFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { openDatabase, complaintView } from './db.js';
import { hashToken, normalizeEmail, validEmail, verifyPassword } from './auth.js';

const dist = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const categories = new Set(['Infraestrutura', 'Atendimento', 'Acadêmico', 'Financeiro', 'Outro']);
const sessionTTL = 8 * 60 * 60 * 1000;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function textField(value, label, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new RequestError(400, `${label} deve ter de ${min} a ${max} caracteres.`);
  }
  return value.trim();
}
async function readJSON(req) {
  if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    throw new RequestError(415, 'Envie os dados no formato JSON.');
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 65536) { req.resume(); throw new RequestError(413, 'O conteúdo enviado é muito grande.'); }
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new RequestError(400, 'Os dados enviados não são válidos.'); }
}

export function createApp({ dataDir, secureCookies = process.env.COOKIE_SECURE === 'true', rateLimit = true, appOrigin = process.env.APP_ORIGIN } = {}) {
  const db = openDatabase(dataDir);
  const limits = new Map();

  function limit(req, kind, maximum, windowMs) {
    if (!rateLimit) return;
    const now = Date.now();
    // No IP addresses are stored in the database or in request logs.
    for (const [key, entry] of limits) if (entry.until <= now) limits.delete(key);
    const key = `${kind}:${req.socket.remoteAddress}`;
    const bucket = limits.get(key) || { count: 0, until: now + windowMs };
    if (++bucket.count > maximum || (limits.size >= 10000 && !limits.has(key))) {
      throw new RequestError(429, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
    }
    limits.set(key, bucket);
  }
  function cookie(token, age) {
    return `ouvidoria_session=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${age}${secureCookies ? '; Secure' : ''}`;
  }
  function adminFor(req) {
    const token = req.headers.cookie?.split(';').map(c => c.trim()).find(c => c.startsWith('ouvidoria_session='))?.slice('ouvidoria_session='.length);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new RequestError(401, 'Entre com sua conta de administrador.');
    const admin = db.prepare(`SELECT admins.id, admins.email FROM sessions JOIN admins ON admins.id = sessions.admin_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?`).get(hashToken(token), Date.now());
    if (!admin) throw new RequestError(401, 'Sua sessão expirou. Entre novamente.');
    return admin;
  }
  function checkOrigin(req, required = false) {
    const origin = req.headers.origin;
    if (!origin && !required && req.headers['sec-fetch-site'] !== 'cross-site') return;
    let allowed = false;
    if (origin && appOrigin) allowed = origin === appOrigin;
    else if (origin) {
      try {
        const parsed = new URL(origin);
        allowed = ['http:', 'https:'].includes(parsed.protocol) && parsed.host === req.headers.host && parsed.origin === origin;
      } catch { /* reject malformed origins */ }
    }
    if (!allowed) throw new RequestError(403, 'Origem da solicitação não permitida.');
  }
  function json(res, code, data, headers = {}) {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
    res.end(JSON.stringify(data));
  }

  async function handle(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    if (secureCookies) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    const url = new URL(req.url, 'http://internal');
    const pathname = url.pathname;
    if (!['GET', 'HEAD'].includes(req.method)) checkOrigin(req);

    if (req.method === 'GET' && pathname === '/api/health') {
      db.prepare('SELECT 1').get();
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && pathname === '/api/complaints') {
      limit(req, 'complaint', 20, 60 * 60 * 1000);
      const body = await readJSON(req);
      if (typeof body.anonymous !== 'boolean') throw new RequestError(400, 'Escolha se deseja se identificar.');
      if (!categories.has(body.category)) throw new RequestError(400, 'Escolha uma categoria válida.');
      const subject = textField(body.subject, 'O assunto', 5, 160);
      const description = textField(body.description, 'A descrição', 20, 10000);
      const name = body.anonymous ? null : textField(body.name, 'O nome', 2, 120);
      const email = body.anonymous ? null : normalizeEmail(body.email);
      if (!body.anonymous && !validEmail(email)) throw new RequestError(400, 'Informe um e-mail válido.');
      const createdAt = new Date().toISOString();
      let protocol;
      do { protocol = `OUV-${new Date().getUTCFullYear()}-${randomBytes(6).toString('hex').toUpperCase()}`; }
      while (db.prepare('SELECT id FROM complaints WHERE protocol = ?').get(protocol));
      const accessKey = randomBytes(16).toString('hex');
      db.prepare(`INSERT INTO complaints (protocol, access_key_hash, anonymous, name, email, category, subject, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(protocol, hashToken(accessKey), Number(body.anonymous), name, email, body.category, subject, description, createdAt, createdAt);
      return json(res, 201, { protocol, accessKey, createdAt, status: 'open' });
    }
    const publicMatch = pathname.match(/^\/api\/complaints\/([A-Za-z0-9-]+)$/);
    if (req.method === 'GET' && publicMatch) {
      limit(req, 'lookup', 120, 15 * 60 * 1000);
      const row = db.prepare('SELECT * FROM complaints WHERE protocol = ?').get(publicMatch[1].toUpperCase());
      const key = url.searchParams.get('key') || '';
      const actual = hashToken(key);
      if (!row || !key || key.length > 128 || !timingSafeEqual(Buffer.from(actual), Buffer.from(row.access_key_hash))) {
        throw new RequestError(404, 'Protocolo ou chave de acesso não encontrados. Confira os dados.');
      }
      return json(res, 200, complaintView(row));
    }
    if (req.method === 'POST' && pathname === '/api/admin/login') {
      limit(req, 'login', 10, 15 * 60 * 1000);
      const body = await readJSON(req);
      if (typeof body.password !== 'string' || body.password.length > 256 || !body.password.length || typeof body.email !== 'string' || body.email.length > 254) {
        throw new RequestError(401, 'E-mail ou senha incorretos.');
      }
      const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(normalizeEmail(body.email));
      if (!await verifyPassword(body.password, admin?.password_hash)) throw new RequestError(401, 'E-mail ou senha incorretos.');
      const token = randomBytes(32).toString('hex');
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
      db.prepare('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?, ?, ?)').run(hashToken(token), admin.id, Date.now() + sessionTTL);
      return json(res, 200, { admin: { email: admin.email } }, { 'Set-Cookie': cookie(token, sessionTTL / 1000) });
    }
    if (pathname.startsWith('/api/admin/')) {
      const admin = adminFor(req);
      if (req.method === 'GET' && pathname === '/api/admin/session') return json(res, 200, { admin: { email: admin.email } });
      if (req.method === 'POST' && pathname === '/api/admin/logout') {
        checkOrigin(req, true);
        const token = req.headers.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('ouvidoria_session=')).slice('ouvidoria_session='.length);
        db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
        return json(res, 200, { ok: true }, { 'Set-Cookie': cookie('', 0) });
      }
      if (req.method === 'GET' && pathname === '/api/admin/complaints') {
        const rows = db.prepare('SELECT * FROM complaints ORDER BY created_at DESC, id DESC').all();
        return json(res, 200, { complaints: rows.map(row => complaintView(row, true)) });
      }
      const updateMatch = pathname.match(/^\/api\/admin\/complaints\/(\d+)$/);
      if (req.method === 'PATCH' && updateMatch) {
        checkOrigin(req, true);
        const body = await readJSON(req);
        if (!['open', 'resolved'].includes(body.status)) throw new RequestError(400, 'Escolha um status válido.');
        const resolution = body.status === 'resolved' ? textField(body.resolution, 'A resposta', 5, 5000) : null;
        const row = db.prepare('SELECT id FROM complaints WHERE id = ?').get(updateMatch[1]);
        if (!row) throw new RequestError(404, 'Chamado não encontrado.');
        const now = new Date().toISOString();
        db.prepare('UPDATE complaints SET status = ?, resolution = ?, updated_at = ?, resolved_at = ? WHERE id = ?')
          .run(body.status, resolution, now, body.status === 'resolved' ? now : null, row.id);
        return json(res, 200, { complaint: complaintView(db.prepare('SELECT * FROM complaints WHERE id = ?').get(row.id), true) });
      }
    }
    if (pathname === '/api' || pathname.startsWith('/api/')) throw new RequestError(404, 'Recurso não encontrado.');
    if (!['GET', 'HEAD'].includes(req.method)) throw new RequestError(405, 'Método não permitido.');
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { throw new RequestError(400, 'Endereço inválido.'); }
    if (decoded.includes('\0')) throw new RequestError(400, 'Endereço inválido.');
    let filename = path.resolve(dist, `.${decoded}`);
    if (filename !== dist && !filename.startsWith(dist + path.sep)) throw new RequestError(404, 'Página não encontrada.');
    try {
      if (!statSync(filename).isFile()) filename = path.join(dist, 'index.html');
    } catch { filename = path.extname(decoded) ? filename : path.join(dist, 'index.html'); }
    let contents;
    try { contents = readFileSync(filename); }
    catch { throw new RequestError(404, 'Página não encontrada. Execute npm run build antes de iniciar o site.'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': filename.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : contents);
  }
  const server = http.createServer((req, res) => {
    handle(req, res).catch(error => {
      if (!error.status) console.error('Falha interna ao atender solicitação:', error.code || error.name);
      if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'Não foi possível concluir. Tente novamente.' });
      else res.end();
    });
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 15000;
  return {
    server, db,
    async close() {
      if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      db.close();
    },
  };
}
