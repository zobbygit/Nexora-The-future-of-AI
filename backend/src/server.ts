import http from 'http';
import mongoose from 'mongoose';
import { createApp } from './app';
import { configWarnings, env } from './config/env';
import { startScheduler, stopScheduler } from './services/scheduler';
import { createSocketServer } from './sockets';
import { logger } from './utils/logger';

const main = async () => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  logger.info('mongodb connected');
  configWarnings().forEach((w) => logger.warn(`config: ${w}`));

  const app = createApp();
  const server = http.createServer(app);
  const io = createSocketServer(server);
  startScheduler();

  server.listen(env.PORT, () => logger.info(`nexora api listening on :${env.PORT}`, { env: env.NODE_ENV, mockAi: env.AI_MOCK }));

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    logger.info(`${signal} received, shutting down`);
    stopScheduler();
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    io.close();
    server.close(async () => {
      await mongoose.connection.close();
      logger.info('shutdown complete');
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (e) => logger.error('unhandledRejection', { err: String(e) }));
};

main().catch((e) => {
  logger.error('fatal startup error', { err: String(e) });
  process.exit(1);
});