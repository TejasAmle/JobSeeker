import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import config from '../config.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

// Ensure data directory exists
const dataDir = path.dirname(config.paths.database);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create database connection
const db = new sqlite3.Database(config.paths.database, (err) => {
  if (err) {
    logger.error('Error opening database', err);
  } else {
    logger.info('Connected to SQLite database', { path: config.paths.database });
  }
});

// Promisify database methods
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

// Initialize database schema
export async function initializeDatabase() {
  try {
    // Jobs table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        location TEXT,
        salary TEXT,
        salary_numeric INTEGER,
        source_platform TEXT NOT NULL,
        source_url TEXT NOT NULL,
        apply_url TEXT,
        description TEXT,
        posted_date TEXT,
        discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        relevance_score INTEGER,
        notified BOOLEAN DEFAULT FALSE,
        notification_channels TEXT,
        status TEXT DEFAULT 'new'
      )
    `);

    // Scrape logs table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS scrape_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        scrape_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        jobs_found INTEGER,
        new_jobs INTEGER,
        errors TEXT,
        duration_seconds REAL
      )
    `);

    // Company watchlist table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS company_watchlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        career_url TEXT,
        ats_url TEXT,
        linkedin_url TEXT,
        priority TEXT DEFAULT 'Medium',
        notes TEXT,
        last_scraped DATETIME
      )
    `);

    // Blocked companies table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS blocked_companies (
        company_name TEXT PRIMARY KEY,
        reason TEXT,
        blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better query performance
    await dbRun('CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_jobs_discovered ON jobs(discovered_at)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_jobs_score ON jobs(relevance_score)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_scrape_logs_platform ON scrape_logs(platform)');

    logger.info('Database schema initialized successfully');
  } catch (error) {
    logger.error('Error initializing database', error);
    throw error;
  }
}

// Job operations
export async function insertJob(job) {
  try {
    await dbRun(
      `INSERT INTO jobs (
        id, title, company, location, salary, salary_numeric,
        source_platform, source_url, apply_url, description,
        posted_date, relevance_score, notified, notification_channels, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.id,
        job.title,
        job.company,
        job.location,
        job.salary,
        job.salary_numeric,
        job.source_platform,
        job.source_url,
        job.apply_url,
        job.description,
        job.posted_date,
        job.relevance_score,
        job.notified ? 1 : 0,
        JSON.stringify(job.notification_channels || []),
        job.status || 'new',
      ]
    );
    return true;
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      logger.debug('Job already exists in database', { jobId: job.id });
      return false;
    }
    throw error;
  }
}

export async function getJobById(id) {
  return await dbGet('SELECT * FROM jobs WHERE id = ?', [id]);
}

export async function updateJobStatus(id, status, notificationChannels = null) {
  const updateData = notificationChannels
    ? [1, JSON.stringify(notificationChannels), status, id]
    : [1, status, id];

  const query = notificationChannels
    ? 'UPDATE jobs SET notified = ?, notification_channels = ?, status = ? WHERE id = ?'
    : 'UPDATE jobs SET notified = ?, status = ? WHERE id = ?';

  await dbRun(query, updateData);
}

export async function getRecentJobs(hours = 24) {
  return await dbAll(
    `SELECT * FROM jobs
     WHERE discovered_at > datetime('now', '-' || ? || ' hours')
     ORDER BY relevance_score DESC, discovered_at DESC`,
    [hours]
  );
}

export async function getJobsByScoreRange(minScore, maxScore = 100) {
  return await dbAll(
    `SELECT * FROM jobs
     WHERE relevance_score >= ? AND relevance_score <= ?
     AND notified = FALSE
     ORDER BY relevance_score DESC, discovered_at DESC`,
    [minScore, maxScore]
  );
}

// Scrape log operations
export async function insertScrapeLog(log) {
  await dbRun(
    `INSERT INTO scrape_logs (platform, jobs_found, new_jobs, errors, duration_seconds)
     VALUES (?, ?, ?, ?, ?)`,
    [log.platform, log.jobs_found, log.new_jobs, log.errors, log.duration_seconds]
  );
}

export async function getLastScrapeTime(platform) {
  const result = await dbGet(
    'SELECT MAX(scrape_time) as last_scrape FROM scrape_logs WHERE platform = ?',
    [platform]
  );
  return result?.last_scrape;
}

// Watchlist operations
export async function upsertWatchlistCompany(company) {
  await dbRun(
    `INSERT INTO company_watchlist (company_name, career_url, ats_url, linkedin_url, priority, notes)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(company_name) DO UPDATE SET
       career_url = excluded.career_url,
       ats_url = excluded.ats_url,
       linkedin_url = excluded.linkedin_url,
       priority = excluded.priority,
       notes = excluded.notes`,
    [
      company.company_name,
      company.career_url,
      company.ats_url,
      company.linkedin_url,
      company.priority || 'Medium',
      company.notes,
    ]
  );
}

export async function getAllWatchlistCompanies() {
  return await dbAll('SELECT * FROM company_watchlist ORDER BY priority DESC');
}

export async function isCompanyBlocked(companyName) {
  const result = await dbGet(
    'SELECT 1 FROM blocked_companies WHERE LOWER(company_name) = LOWER(?)',
    [companyName]
  );
  return !!result;
}

// Statistics
export async function getStats() {
  const totalJobs = await dbGet('SELECT COUNT(*) as count FROM jobs');
  const notifiedJobs = await dbGet('SELECT COUNT(*) as count FROM jobs WHERE notified = TRUE');
  const todayJobs = await dbGet(
    "SELECT COUNT(*) as count FROM jobs WHERE DATE(discovered_at) = DATE('now')"
  );
  const avgScore = await dbGet('SELECT AVG(relevance_score) as avg FROM jobs');

  return {
    totalJobs: totalJobs.count,
    notifiedJobs: notifiedJobs.count,
    todayJobs: todayJobs.count,
    avgScore: Math.round(avgScore.avg || 0),
  };
}

// Cleanup old jobs (optional - keep last 90 days)
export async function cleanupOldJobs(days = 90) {
  const result = await dbRun(
    `DELETE FROM jobs WHERE discovered_at < datetime('now', '-' || ? || ' days')`,
    [days]
  );
  logger.info('Cleaned up old jobs', { deletedCount: result.changes, days });
  return result.changes;
}

// Close database connection
export function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
      } else {
        logger.info('Database connection closed');
        resolve();
      }
    });
  });
}

export default {
  initialize: initializeDatabase,
  insertJob,
  getJobById,
  updateJobStatus,
  getRecentJobs,
  getJobsByScoreRange,
  insertScrapeLog,
  getLastScrapeTime,
  upsertWatchlistCompany,
  getAllWatchlistCompanies,
  isCompanyBlocked,
  getStats,
  cleanupOldJobs,
  close: closeDatabase,
};
