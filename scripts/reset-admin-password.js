import { openDatabase } from '../server/db.js';
import { resetAdminPassword } from '../server/auth.js';
import { readAdminCredentials } from './admin-input.js';

let db;
try {
  const { email, password } = await readAdminCredentials({ reset: true });
  db = openDatabase();
  const admin = await resetAdminPassword(db, email, password);
  console.log(`Senha de ${admin.email} redefinida. As sessões anteriores foram encerradas; entre novamente com a nova senha.`);
} catch (error) {
  console.error(error instanceof SyntaxError || error instanceof TypeError ? 'Entrada JSON inválida.' : error.message);
  process.exitCode = 1;
} finally { db?.close(); }
