import { createApp } from './app.js';
import { getConfig, validateConfig } from './config.js';
import { createLogger } from './core/logging/logger.js';
import { startWorker } from './va_scanner/queue/pdfWorker.js';

const logger = createLogger('server-v2');

try {
  // Validate configuration on startup
  validateConfig();
  const config = getConfig();

  // Create and start server
  const app = createApp();

  // Start async PDF worker — polls only when Redis is available, no-op otherwise
  startWorker();

  app.listen(config.port, () => {
    logger.info('🚀 Rally Forge Backend v2.0 Started - All Scanners Modernized', {
      port: config.port,
      environment: config.nodeEnv,
      database: config.database.url.split('//')[1].split('@')[1],
      redis: `${config.redis.host}:${config.redis.port}`,
      scanners: ['OCR v2.0', 'DD214 v3.0', 'STR v3.0', 'RatingDecision v4.2'],
      queue: 'Redis Bull v2.0',
      graphVersion: 'v2.0'
    });

    console.log(`
╔════════════════════════════════════════════════════════╗
║    🚀 Rally Forge Backend v2.0 Ready (Modernized)     ║
║            All Scanners Upgraded to v3+               ║
╠════════════════════════════════════════════════════════╣
║ Server:  http://localhost:${config.port}
║ API:     http://localhost:${config.port}/api
║ Health:  http://localhost:${config.port}/api/health
║ Scanners: OCR v2, DD214 v3, STR v3, RatingDecision v4.2
║ Queue:   Redis Bull v2.0 (async processing)
║ Graph:   Veteran Evidence Graph v2.0
║ Logs:    ${config.logging.dir}/
║ Mode:    ${config.nodeEnv === 'development' ? '🔧 Development' : '⚙️  Production'}
╚════════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });

} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  if (error.stack) console.error(error.stack);
  process.exit(1);
}

