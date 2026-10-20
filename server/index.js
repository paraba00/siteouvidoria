import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const app = createApp();
app.server.listen(port, host, () => console.log(`Ouvidoria iniciada na porta ${port}.`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => { await app.close(); process.exit(0); });
}
app.server.on('error', error => {
  console.error(`Não foi possível iniciar o servidor: ${error.code || error.message}`);
  process.exitCode = 1;
  app.db.close();
});
