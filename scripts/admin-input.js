import readline from 'node:readline/promises';
import { Writable } from 'node:stream';

export async function readAdminCredentials({ reset = false } = {}) {
  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;
  if (process.argv.includes('--stdin-json')) {
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk;
      if (input.length > 4096) throw new Error('Entrada muito grande.');
    }
    const credentials = JSON.parse(input);
    if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
      throw new Error('Entrada JSON inválida.');
    }
    return credentials;
  }
  if (email && password) return { email, password };
  if (!process.stdin.isTTY) {
    throw new Error(`Execute em um terminal interativo para ${reset ? 'redefinir a senha' : 'cadastrar o administrador'}.`);
  }
  let muted = false;
  const output = new Writable({ write(chunk, encoding, callback) { if (!muted) process.stdout.write(chunk, encoding); callback(); } });
  const terminal = readline.createInterface({ input: process.stdin, output, terminal: true });
  try {
    email = await terminal.question('E-mail do administrador: ');
    process.stdout.write(`${reset ? 'Nova senha' : 'Senha'} (mínimo 12 caracteres; entrada oculta): `);
    muted = true;
    password = await terminal.question('');
    muted = false;
    process.stdout.write(`\nConfirme ${reset ? 'a nova senha' : 'a senha'}: `);
    muted = true;
    const confirmation = await terminal.question('');
    muted = false;
    process.stdout.write('\n');
    if (password !== confirmation) throw new Error('As senhas não coincidem.');
    return { email, password };
  } finally { terminal.close(); }
}
