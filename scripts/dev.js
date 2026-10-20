import { spawn } from 'node:child_process';
import { createServer } from 'vite';

const api = spawn(process.execPath, ['--watch', 'server/index.js'], { stdio: 'inherit', env: { ...process.env, PORT: process.env.API_PORT || '3000' } });
let web;
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  api.kill('SIGTERM');
  await web?.close();
  process.exitCode = code;
}
api.on('error', error => { console.error(error.message); stop(1); });
api.on('exit', code => stop(code || 0));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
try {
  web = await createServer({ clearScreen: false, server: { host: process.env.HOST || '127.0.0.1', strictPort: true } });
  if (stopping) await web.close();
  else { await web.listen(); web.printUrls(); }
} catch (error) {
  console.error(error.message);
  await stop(1);
}
