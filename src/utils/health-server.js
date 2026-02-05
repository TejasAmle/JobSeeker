import express from 'express';
import config from '../config.js';
import logger from './logger.js';
import db from '../data/db.js';
import watchlist from '../data/watchlist.js';
import whatsapp from '../notifications/whatsapp.js';
import scheduler from './scheduler.js';

let server = null;

/**
 * Start health check HTTP server
 * This is essential for Render free tier to know the service is alive
 */
export function startHealthServer() {
  const app = express();
  const port = config.port;

  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      const stats = await db.getStats();
      const whatsappStatus = whatsapp.getStatus();
      const schedulerStatus = scheduler.getStatus();
      const watchlistStats = watchlist.getStats();

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
          connected: true,
          totalJobs: stats.totalJobs,
          notifiedJobs: stats.notifiedJobs,
          todayJobs: stats.todayJobs,
          avgScore: stats.avgScore,
        },
        whatsapp: whatsappStatus,
        scheduler: schedulerStatus,
        watchlist: watchlistStats,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      });
    } catch (error) {
      logger.error('Health check failed', error);
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
      });
    }
  });

  // Status endpoint (more detailed)
  app.get('/status', async (req, res) => {
    try {
      const stats = await db.getStats();
      const whatsappStatus = whatsapp.getStatus();
      const schedulerStatus = scheduler.getStatus();
      const watchlistStats = watchlist.getStats();

      // Get recent scrape logs
      const recentLogs = await db.dbAll(
        'SELECT * FROM scrape_logs ORDER BY scrape_time DESC LIMIT 10'
      );

      // Get recent jobs
      const recentJobs = await db.getRecentJobs(24);

      res.json({
        agent: {
          name: 'Job Hunter Agent',
          version: '1.0.0',
          status: config.agentEnabled ? 'running' : 'disabled',
          environment: config.nodeEnv,
        },
        timestamp: new Date().toISOString(),
        uptime: {
          seconds: Math.floor(process.uptime()),
          formatted: formatUptime(process.uptime()),
        },
        database: {
          connected: true,
          stats,
        },
        notifications: {
          whatsapp: whatsappStatus,
          email: {
            configured: !!(config.gmail.address && config.gmail.appPassword),
          },
        },
        scheduler: schedulerStatus,
        watchlist: watchlistStats,
        recentScrapes: recentLogs.map((log) => ({
          platform: log.platform,
          time: log.scrape_time,
          jobsFound: log.jobs_found,
          newJobs: log.new_jobs,
          errors: log.errors ? JSON.parse(log.errors).length : 0,
        })),
        recentJobs: recentJobs.slice(0, 5).map((job) => ({
          title: job.title,
          company: job.company,
          score: job.relevance_score,
          notified: job.notified,
        })),
        memory: process.memoryUsage(),
      });
    } catch (error) {
      logger.error('Status check failed', error);
      res.status(500).json({
        status: 'error',
        error: error.message,
      });
    }
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      service: 'Job Hunter Agent',
      status: 'running',
      message: 'Autonomous job search agent for Product Manager roles',
      endpoints: {
        health: '/health',
        status: '/status',
      },
    });
  });

  // Trigger manual scrape (useful for testing)
  app.post('/scrape', async (req, res) => {
    try {
      logger.info('Manual scrape triggered via API');
      res.json({
        message: 'Scrape started',
        note: 'Check /status for progress',
      });

      // Run scrape in background
      scheduler.triggerManual().catch((error) => {
        logger.error('Manual scrape failed', error);
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
      });
    }
  });

  // Start server
  server = app.listen(port, () => {
    logger.info(`Health check server running on port ${port}`);
    console.log(`\n🏥 Health check server running at http://localhost:${port}`);
    console.log(`   - Health: http://localhost:${port}/health`);
    console.log(`   - Status: http://localhost:${port}/status\n`);
  });

  return server;
}

/**
 * Stop health check server
 */
export function stopHealthServer() {
  if (server) {
    return new Promise((resolve) => {
      server.close(() => {
        logger.info('Health check server stopped');
        resolve();
      });
    });
  }
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

export default {
  start: startHealthServer,
  stop: stopHealthServer,
};
