import logger, { logScrape } from '../utils/logger.js';
import db from '../data/db.js';
import { parseSalary } from '../matching/salary-parser.js';
import { calculateRelevanceScore, shouldExcludeJob, getNotificationAction } from '../matching/scorer.js';
import { checkDuplicate, generateJobId } from '../matching/dedup.js';
import watchlist from '../data/watchlist.js';
import emailNotifications from '../notifications/email.js';
import whatsappNotifications from '../notifications/whatsapp.js';

/**
 * Base scraper class with common functionality
 * All platform-specific scrapers should extend this class
 */
export class BaseScraper {
  constructor(platformName) {
    this.platformName = platformName;
    this.jobsFound = 0;
    this.newJobs = 0;
    this.errors = [];
    this.startTime = null;
  }

  /**
   * Main scrape method - to be implemented by subclasses
   * Should return array of job objects
   */
  async scrape() {
    throw new Error('scrape() must be implemented by subclass');
  }

  /**
   * Run the scraper with common error handling and logging
   */
  async run() {
    this.startTime = Date.now();
    this.jobsFound = 0;
    this.newJobs = 0;
    this.errors = [];

    logger.info(`Starting ${this.platformName} scraper...`);

    try {
      // Call the platform-specific scrape method
      const jobs = await this.scrape();

      this.jobsFound = jobs.length;
      logger.info(`${this.platformName} scraper found ${jobs.length} jobs`);

      // Process each job
      for (const job of jobs) {
        try {
          await this.processJob(job);
        } catch (error) {
          logger.error(`Error processing job from ${this.platformName}`, error, {
            job: job.title,
            company: job.company,
          });
          this.errors.push(`Processing error: ${error.message}`);
        }
      }

      // Log scrape completion
      const duration = (Date.now() - this.startTime) / 1000;

      await db.insertScrapeLog({
        platform: this.platformName,
        jobs_found: this.jobsFound,
        new_jobs: this.newJobs,
        errors: this.errors.length > 0 ? JSON.stringify(this.errors) : null,
        duration_seconds: duration,
      });

      logScrape(this.platformName, {
        jobsFound: this.jobsFound,
        newJobs: this.newJobs,
        errors: this.errors.length,
        durationSeconds: duration.toFixed(2),
      });

      return {
        success: true,
        jobsFound: this.jobsFound,
        newJobs: this.newJobs,
        errors: this.errors,
      };

    } catch (error) {
      logger.error(`${this.platformName} scraper failed`, error);

      const duration = (Date.now() - this.startTime) / 1000;

      await db.insertScrapeLog({
        platform: this.platformName,
        jobs_found: 0,
        new_jobs: 0,
        errors: JSON.stringify([error.message]),
        duration_seconds: duration,
      });

      return {
        success: false,
        error: error.message,
        jobsFound: 0,
        newJobs: 0,
      };
    }
  }

  /**
   * Process a single job: deduplicate, score, save, notify
   */
  async processJob(job) {
    // 1. Check if job should be excluded
    if (shouldExcludeJob(job.title, job.description)) {
      logger.debug('Job excluded based on title/description', {
        title: job.title,
        company: job.company,
      });
      return;
    }

    // 2. Parse salary
    const salaryData = parseSalary(job.salary);
    const salaryNumeric = salaryData?.avg || null;

    // 3. Check if company is in watchlist
    const watchlistCompany = watchlist.get(job.company);
    const isWatchlist = !!watchlistCompany;

    // 4. Calculate relevance score
    const scoringResult = calculateRelevanceScore(
      { ...job, salary_numeric: salaryNumeric },
      watchlistCompany
    );

    // 5. Generate job ID
    const jobId = generateJobId(job.company, job.title, job.location);

    // 6. Check for duplicates
    const dupCheck = await checkDuplicate({
      id: jobId,
      company: job.company,
      title: job.title,
      location: job.location,
    });

    if (dupCheck.isDuplicate) {
      logger.debug('Duplicate job skipped', {
        jobId,
        title: job.title,
        company: job.company,
        reason: dupCheck.reason,
      });
      return;
    }

    // 7. Prepare job object for database
    const jobToSave = {
      id: jobId,
      title: job.title,
      company: job.company,
      location: job.location,
      salary: job.salary,
      salary_numeric: salaryNumeric,
      source_platform: this.platformName,
      source_url: job.source_url,
      apply_url: job.apply_url || job.source_url,
      description: job.description,
      posted_date: job.posted_date,
      relevance_score: scoringResult.score,
      notified: false,
      notification_channels: [],
      status: 'new',
      is_watchlist: isWatchlist,
      watchlist_priority: watchlistCompany?.priority,
    };

    // 8. Save to database
    const inserted = await db.insertJob(jobToSave);

    if (!inserted) {
      logger.debug('Job already in database', { jobId });
      return;
    }

    this.newJobs++;

    logger.info('New job added', {
      jobId,
      title: job.title,
      company: job.company,
      score: scoringResult.score,
      isWatchlist,
    });

    // 9. Determine notification action
    const action = getNotificationAction(scoringResult.score);

    if (action === 'notify') {
      await this.sendNotifications(jobToSave);
    } else if (action === 'digest') {
      logger.info('Job will be included in daily digest', {
        jobId,
        title: job.title,
        score: scoringResult.score,
      });
    } else {
      logger.debug('Job score too low for notification', {
        jobId,
        title: job.title,
        score: scoringResult.score,
      });
    }
  }

  /**
   * Send notifications for a job
   */
  async sendNotifications(job) {
    const notificationChannels = [];

    // Send email notification
    try {
      const emailSent = await emailNotifications.sendJobNotification(job);
      if (emailSent) {
        notificationChannels.push('email');
      }
    } catch (error) {
      logger.error('Failed to send email notification', error, { jobId: job.id });
    }

    // Send WhatsApp notification
    try {
      const whatsappSent = await whatsappNotifications.sendJobNotification(job);
      if (whatsappSent) {
        notificationChannels.push('whatsapp');
      }
    } catch (error) {
      logger.error('Failed to send WhatsApp notification', error, { jobId: job.id });
    }

    // Update job status
    if (notificationChannels.length > 0) {
      await db.updateJobStatus(job.id, 'notified', notificationChannels);

      logger.info('Notifications sent', {
        jobId: job.id,
        title: job.title,
        company: job.company,
        channels: notificationChannels,
      });
    }
  }

  /**
   * Helper: Add delay between requests (rate limiting)
   */
  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper: Random delay between min and max ms
   */
  async randomDelay(minMs, maxMs) {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await this.delay(delay);
  }
}

export default BaseScraper;
