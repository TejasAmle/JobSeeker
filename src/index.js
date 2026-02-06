#!/usr/bin/env node

/**
 * Job Hunter Agent - Main Entry Point
 * Autonomous job search agent for Product Manager roles
 *
 * Description: Scrapes job boards, scores relevance, and sends notifications
 */

import config, { validateConfig } from './config.js';
import logger from './utils/logger.js';
import db from './data/db.js';
import watchlist from './data/watchlist.js';
import emailNotifications from './notifications/email.js';
import whatsappNotifications from './notifications/whatsapp.js';
import scheduler from './utils/scheduler.js';
import healthServer from './utils/health-server.js';

// ASCII Art Banner
const banner = `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        🎯  JOB HUNTER AGENT  🎯                          ║
║                                                           ║
║     Autonomous Product Manager Job Search Agent          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`;

/**
 * Initialize the agent
 */
async function initialize() {
  console.log(banner);
  console.log('Starting Job Hunter Agent...\n');

  try {
    // 1. Validate configuration
    logger.info('Validating configuration...');
    const configValid = validateConfig();

    if (!configValid) {
      console.warn('⚠️  Some configuration warnings detected. Check logs for details.\n');
    }

    // 2. Initialize database
    logger.info('Initializing database...');
    await db.initialize();
    console.log('✅ Database initialized\n');

    // 3. Load company watchlist
    logger.info('Loading company watchlist...');
    try {
      await watchlist.load();
      const stats = watchlist.getStats();
      console.log(`✅ Watchlist loaded: ${stats.total} companies\n`);
    } catch (error) {
      logger.warn('Could not load watchlist (continuing without it)', error);
      console.log('⚠️  Watchlist not loaded (continuing without it)\n');
    }

    // 4. Initialize email notifications
    logger.info('Initializing email notifications...');
    const emailInit = emailNotifications.initialize();

    if (emailInit) {
      const emailTest = await emailNotifications.testConnection();

      if (emailTest.success) {
        console.log('✅ Email notifications configured and tested\n');
      } else {
        console.log(`⚠️  Email connection test failed: ${emailTest.error}\n`);
      }
    } else {
      console.log('⚠️  Email notifications not configured\n');
    }

    // 5. Initialize WhatsApp (if enabled)
    if (config.whatsapp.enabled) {
      logger.info('Initializing WhatsApp...');
      console.log('📱 Initializing WhatsApp...');
      console.log('   (You may need to scan a QR code)\n');

      await whatsappNotifications.initialize();
    } else {
      console.log('⚠️  WhatsApp notifications disabled\n');
    }

    // 6. Start health check server
    logger.info('Starting health check server...');
    healthServer.start();

    // 7. Start scheduler
    logger.info('Starting job scraper scheduler...');
    await scheduler.start();
    console.log(`✅ Scheduler started (scraping every ${config.scraping.intervalMinutes} minutes)\n`);

    // Success message
    console.log('═'.repeat(60));
    console.log('🚀 Job Hunter Agent is now running!');
    console.log('═'.repeat(60));
    console.log('\nThe agent will:');
    console.log(`  • Scrape job boards every ${config.scraping.intervalMinutes} minutes`);
    console.log('  • Score jobs based on relevance');
    console.log('  • Send notifications for high-scoring matches (score ≥ 60)');
    console.log('  • Deduplicate to avoid repeat notifications');
    console.log('\nNotification channels:');
    console.log(`  • Email: ${config.gmail.address || 'Not configured'}`);
    console.log(`  • WhatsApp: ${config.whatsapp.enabled ? 'Enabled' : 'Disabled'}`);
    console.log('\nMonitoring:');
    console.log(`  • Health check: http://localhost:${config.port}/health`);
    console.log(`  • Status: http://localhost:${config.port}/status`);
    console.log(`  • Logs: ${config.paths.logs}/combined.log`);
    console.log('\nPress Ctrl+C to stop the agent.\n');

    logger.info('Job Hunter Agent started successfully');

  } catch (error) {
    logger.error('Failed to initialize agent', error);
    console.error('\n❌ Failed to start agent:', error.message);
    console.error('Check logs for details:', `${config.paths.logs}/error.log\n`);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal) {
  console.log(`\n\nReceived ${signal}, shutting down gracefully...`);
  logger.info(`Shutdown initiated by ${signal}`);

  try {
    // 1. Stop scheduler
    logger.info('Stopping scheduler...');
    scheduler.stop();
    console.log('✅ Scheduler stopped');

    // 2. Stop health server
    logger.info('Stopping health server...');
    await healthServer.stop();
    console.log('✅ Health server stopped');

    // 3. Close WhatsApp
    if (config.whatsapp.enabled) {
      logger.info('Closing WhatsApp connection...');
      await whatsappNotifications.shutdown();
      console.log('✅ WhatsApp closed');
    }

    // 4. Close database
    logger.info('Closing database connection...');
    await db.close();
    console.log('✅ Database closed');

    console.log('\n👋 Job Hunter Agent stopped successfully\n');
    logger.info('Agent shutdown completed');

    process.exit(0);

  } catch (error) {
    logger.error('Error during shutdown', error);
    console.error('Error during shutdown:', error.message);
    process.exit(1);
  }
}

/**
 * Error handlers
 */
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  console.error('\n❌ Uncaught exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', new Error(String(reason)));
  console.error('\n❌ Unhandled rejection:', reason);
});

// Start the agent
initialize().catch((error) => {
  logger.error('Fatal error during initialization', error);
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
