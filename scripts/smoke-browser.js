import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import { createApp } from '../server/app.js';
import { createAdmin } from '../server/auth.js';

// Exercise the real built frontend and API without touching institutional data.
const dataDir = await mkdtemp(path.join(tmpdir(), 'ouvidoria-browser-'));
const app = createApp({ dataDir, rateLimit: false, secureCookies: false, appOrigin: null });
const password = randomBytes(24).toString('base64url');
const email = 'browser-validation@example.test';
const errors = [];
let browser;
try {
  await createAdmin(app.db, email, password);
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const baseURL = `http://127.0.0.1:${app.server.address().port}`;
  const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL);
  await expect(page.getByRole('heading', { name: 'Como podemos ajudar?' })).toBeVisible();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'desktop has no horizontal overflow');
  assert.equal(await page.locator('input[name="name"]').count(), 0, 'anonymous form requests no name');
  await page.locator('select[name="category"]').selectOption('Infraestrutura');
  await page.locator('input[name="subject"]').fill('Acessibilidade da biblioteca');
  await page.locator('textarea[name="description"]').fill('O elevador da biblioteca precisa de manutenção para garantir o acesso de todos.');
  await page.getByRole('button', { name: 'Enviar manifestação', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Manifestação registrada!' })).toBeVisible();
  const protocol = await page.locator('.receipt-data strong').nth(0).textContent();
  const accessKey = await page.locator('.receipt-data strong').nth(1).textContent();
  assert.match(protocol, /^OUV-\d{4}-[A-F0-9]{12}$/);
  assert.match(accessKey, /^[a-f0-9]{32}$/);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar comprovante' }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), `${protocol}.txt`);
  let receiptText = '';
  for await (const chunk of await download.createReadStream()) receiptText += chunk.toString();
  assert.ok(receiptText.includes(protocol) && receiptText.includes(accessKey), 'receipt contains both consultation credentials');

  await page.getByRole('tab', { name: 'Acompanhar protocolo' }).click();
  await page.locator('input[name="protocol"]').fill(protocol);
  await page.locator('input[name="key"]').fill('invalid-key');
  await page.getByRole('button', { name: 'Consultar manifestação', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Protocolo ou chave de acesso não encontrados');
  await page.locator('input[name="key"]').fill(accessKey);
  await page.getByRole('button', { name: 'Consultar manifestação', exact: true }).click();
  await expect(page.locator('.tracked-record .status')).toHaveText('Em aberto');

  await page.getByRole('button', { name: 'Área administrativa', exact: true }).click();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Entrar no painel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Escutar. Acompanhar. Resolver.' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.table-row')).toHaveCount(1);
  await page.locator('.table-row').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.querySelector('dialog').contains(document.activeElement)), true, 'modal retains keyboard focus');
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.table-row').click();
  await page.getByLabel('Resposta e solução').fill('O elevador foi revisado e o acesso à biblioteca está restabelecido.');
  await page.getByRole('button', { name: 'Marcar como resolvida', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Solução registrada' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar detalhes' }).click();
  await expect(page.locator('.table-row .status')).toHaveText('Resolvido');
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Entrar no painel', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Acompanhar protocolo', exact: true }).click();
  await page.locator('input[name="protocol"]').fill(protocol);
  await page.locator('input[name="key"]').fill(accessKey);
  await page.getByRole('button', { name: 'Consultar manifestação', exact: true }).click();
  await expect(page.locator('.tracked-record .status')).toHaveText('Resolvido');
  await expect(page.locator('.record-response')).toContainText('O elevador foi revisado');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL);
  await expect(page.getByRole('heading', { name: 'Como podemos ajudar?' })).toBeVisible();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile has no horizontal overflow');
  if (process.env.SCREENSHOT_DIR) {
    await mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await page.getByRole('radio', { name: /Quero me identificar/ }).check();
  await page.locator('input[name="name"]').fill('Ana da comunidade acadêmica');
  await page.locator('input[name="email"]').fill('ana@example.test');
  await page.locator('select[name="category"]').selectOption('Atendimento');
  await page.locator('input[name="subject"]').fill('Atendimento na secretaria');
  await page.locator('textarea[name="description"]').fill('Preciso de orientação sobre os horários de atendimento da secretaria da faculdade.');
  await page.getByRole('button', { name: 'Enviar manifestação', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Manifestação registrada!' })).toBeVisible();
  await page.getByRole('button', { name: 'Área administrativa', exact: true }).click();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Entrar no painel', exact: true }).click();
  await expect(page.locator('.table-row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Em aberto', exact: true }).click();
  await expect(page.locator('.table-row')).toHaveCount(1);
  await page.locator('.table-row').click();
  await expect(page.getByRole('dialog')).toContainText('ana@example.test');
  assert.deepEqual(errors, [], 'browser has no uncaught JavaScript errors');
  console.log('Navegador: envio anônimo e identificado, comprovante, consulta, login, sessão, resolução, filtros e acesso por celular passaram.');
} finally {
  await browser?.close();
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
}
