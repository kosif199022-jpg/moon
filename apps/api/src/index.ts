import { pathToFileURL } from 'node:url';
import { app } from './app.js';
import { pool } from './db.js';

export { app, pool };

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntrypoint) {
  const port = Number.parseInt(process.env.PORT ?? '3001', 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Moon API is listening on http://0.0.0.0:${port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received; shutting down.`);
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}
