import { openDatabase } from '../server/db.js';
import { createAdmin } from '../server/auth.js';
import { readAdminCredentials } from './admin-input.js';

let db;
try {
  const { email, password } = await readAdminCredentials();
  db = openDatabase();
  const admin = await createAdmin(db, email, password);
  console.log(`Administrador ${admin.email} cadastrado. Use a área administrativa do site para entrar.`);
} catch (error) {
  console.error(error instanceof SyntaxError ? 'Entrada JSON inválida.' : error.message);
  process.exitCode = 1;
} finally { db?.close(); }
