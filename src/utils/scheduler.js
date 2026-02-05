import cron from 'node-cron';
import logger from './logger.js';
import config from '../config.js';
import NaukriScraper from '../scrapers/naukri.js';
import InstahyreScraper from '../scrapers/instahyre.js';
import WellfoundScraper from '../scrapers/wellfound.js';
import watchlist from '../data/watchlist.js';
import db from '../data/db.js';

let scheduledTasks = [];
let isRunning = false;

/**
 * Initialize and start all scheduled tasks
 */
export async function startScheduler() {
  if (isRunning) {
    logger.warn('Scheduler already running');
    return;
  }

  isRunning = true;
  logger.info('Starting job scheduler...');

  // Create scraper instances
  const scrapers = [
    new NaukriScraper(),
    new InstahyreScraper(),
    new WellfoundScraper(),
  ];

  // Schedule scraper runs
  const intervalMinutes = config.scraping.intervalMinutes;
  const cronExpression = `*/${intervalMinutes} * * * *`; // Every N minutes

  const scraperTask = cron.schedule(cronExpression, async () => {
    logger.info('Running scheduled scrape cycle...');
    await runAllScrapers(scrapers);
  });

  scheduledTasks.push(scraperTask);

  logger.info(`Scrapers scheduled to run every ${intervalMinutes} minutes`);

  // Schedule watchlist hot-reload check (every 6 hours)
  const watchlistTask = cron.schedule('0 */6 * * *', async () => {
    logger.info('Checking for watchlist updates...');
    await watchlist.checkAndReload();
  });

  scheduledTasks.push(watchlistTask);

  logger.info('Watchlist hot-reload scheduled every 6 hours');

  // Schedule database cleanup (daily at 3 AM IST)
  const cleanupTask = cron.schedule('0 3 * * *', async () => {
    logger.info('Running database cleanup...');
    try {
      await db.cleanupOldJobs(90); // Keep 90 days of job history
      logger.info('Database cleanup completed');
    } catch (error) {
      logger.error('Database cleanup failed', error);
    }
  });

  scheduledTasks.push(cleanupTask);

  logger.info('Database cleanup scheduled daily at 3 AM');

  // Run scrapers immediately on startup (don't wait for first interval)
  logger.info('Running initial scrape on startup...');
  setTimeout(async () => {
    await runAllScrapers(scrapers);
  }, 5000); // Wait 5 seconds after startup

  logger.info('All scheduled tasks started successfully');
}

/**
 * Run all scrapers sequentially
 */
async function runAllScrapers(scrapers) {
  const startTime = Date.now();
  let totalJobsFound = 0;
  let totalNewJobs = 0;

  logger.info('='.repeat(60));
  logger.info('Starting scrape cycle for all platforms');
  logger.info('='.repeat(60));

  for (const scraper of scrapers) {
    try {
      const result = await scraper.run();

      totalJobsFound += result.jobsFound;
      totalNewJobs += result.newJobs;

      if (!result.success) {
        logger.error(`Scraper ${scraper.platformName} failed`, {
          error: result.error,
        });
      }

      // Delay between scrapers to avoid overwhelming the system
      await delay(10000); // 10 second delay between scrapers

    } catch (error) {
      logger.error(`Unexpected error running scraper ${scraper.platformName}`, error);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  logger.info('='.repeat(60));
  logger.info('Scrape cycle completed', {
    totalJobsFound,
    totalNewJobs,
    durationSeconds: duration,
  });
  logger.info('='.repeat(60));

  // If no new jobs found for a while, might want to alert
  if (totalJobsFound === 0) {
    logger.warn('No jobs found in this scrape cycle - possible scraping issue');
  }
}

/**
 * Stop all scheduled tasks
 */
export function stopScheduler() {
  if (!isRunning) {
    logger.warn('Scheduler not running');
    return;
  }

  logger.info('Stopping scheduler...');

  scheduledTasks.forEach((task) => {
    task.stop();
  });

  scheduledTasks = [];
  isRunning = false;

  logger.info('Scheduler stopped');
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  return {
    running: isRunning,
    activeTasks: scheduledTasks.length,
    intervalMinutes: config.scraping.intervalMinutes,
  };
}

/**
 * Manually trigger a scrape cycle
 */
export async function triggerManualScrape() {
  logger.info('Manual scrape triggered');

  const scrapers = [
    new NaukriScraper(),
    new InstahyreScraper(),
    new WellfoundScraper(),
  ];

  await runAllScrapers(scrapers);
}

// Helper function
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default {
  start: startScheduler,
  stop: stopScheduler,
  getStatus: getSchedulerStatus,
  triggerManual: triggerManualScrape,
};
