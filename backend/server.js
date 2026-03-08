import { createApp } from './app.js';
import { getConfig, validateConfig } from './config.js';
import { createLogger } from './middleware/logging.js';

const logger = createLogger('server');

try {
  // Validate configuration on startup
  validateConfig();
  const config = getConfig();

  // Create and start server
  const app = createApp();

  app.listen(config.port, () => {
    logger.info('🚀 Rally Forge Backend Started', {
      port: config.port,
      environment: config.nodeEnv,
      database: config.database.url.split('//')[1].split('@')[1],
      redis: `${config.redis.host}:${config.redis.port}`
    });

    console.log(`
╔════════════════════════════════════════════════════════╗
║         🚀 Rally Forge Backend Ready                  ║
╠════════════════════════════════════════════════════════╣
║ Server:  http://localhost:${config.port}            
║ API:     http://localhost:${config.port}/api
║ Health:  http://localhost:${config.port}/api/health
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

