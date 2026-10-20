import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import { openDatabase } from '../server/db.js';
import { createAdmin } from '../server/auth.js';

let db;
try {
  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;
  if (process.argv.includes('--stdin-json')) {
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk;
      if (input.length > 4096) throw new Error('Entrada muito grande.');
    }
    ({ email, password } = JSON.parse(input));
  } else if (!email || !password) {
    if (!process.stdin.isTTY) throw new Error('Execute em um terminal interativo para cadastrar o administrador.');
    let muted = false;
    const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk, encoding); callback(); } });
    const terminal = readline.createInterface({ input: process.stdin, output, terminal: true });
    try {
      email = await terminal.question('E-mail do administrador: ');
      process.stdout.write('Senha (mínimo 12 caracteres; entrada oculta): ');
      muted = true;
      password = await terminal.question('');
      muted = false;
      process.stdout.write('\nConfirme a senha: ');
      muted = true;
      const confirmation = await terminal.question('');
      muted = false;
      process.stdout.write('\n');
      if (password !== confirmation) throw new Error('As senhas não coincidem.');
    } finally { terminal.close(); }
  }
  db = openDatabase();
  const admin = await createAdmin(db, email, password);
  console.log(`Administrador ${admin.email} cadastrado. Use a área administrativa do site para entrar.`);
} catch (error) {
  console.error(error instanceof SyntaxError ? 'Entrada JSON inválida.' : error.message);
  process.exitCode = 1;
} finally { db?.close(); }
