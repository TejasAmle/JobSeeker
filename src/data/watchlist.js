import xlsx from 'xlsx';
import fs from 'fs';
import config from '../config.js';
import logger from '../utils/logger.js';
import db from './db.js';

let watchlistData = [];
let lastModifiedTime = null;
let watchCheckInterval = null;

/**
 * Load company watchlist from Excel file
 */
export async function loadWatchlist() {
  const filePath = config.paths.watchlistExcel;

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logger.warn('Watchlist Excel file not found', { path: filePath });
      logger.info('Continuing without watchlist. Agent will still scrape job boards.');
      return [];
    }

    // Read Excel file
    const workbook = xlsx.readFile(filePath);

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data = xlsx.utils.sheet_to_json(worksheet);

    logger.info('Watchlist loaded from Excel', {
      file: filePath,
      companies: data.length,
      sheet: sheetName,
    });

    // Process and normalize the data
    watchlistData = data.map((row) => ({
      company_name: row['Company Name'] || row['Company'] || row['company_name'] || '',
      career_url: row['Career Page URL'] || row['Career URL'] || row['career_url'] || null,
      ats_url: row['Greenhouse/Lever/ATS URL'] || row['ATS URL'] || row['ats_url'] || null,
      linkedin_url: row['LinkedIn Company URL'] || row['LinkedIn'] || row['linkedin_url'] || null,
      priority: row['Priority'] || row['priority'] || 'Medium',
      notes: row['Notes'] || row['notes'] || null,
    })).filter(company => company.company_name); // Filter out rows without company name

    // Store in database
    for (const company of watchlistData) {
      await db.upsertWatchlistCompany(company);
    }

    logger.info('Watchlist synchronized to database', {
      companiesProcessed: watchlistData.length,
    });

    // Update last modified time
    const stats = fs.statSync(filePath);
    lastModifiedTime = stats.mtime;

    return watchlistData;

  } catch (error) {
    logger.error('Error loading watchlist from Excel', error, { path: filePath });
    throw error;
  }
}

/**
 * Check if watchlist file has been modified and reload if necessary
 */
export async function checkAndReloadWatchlist() {
  const filePath = config.paths.watchlistExcel;

  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const stats = fs.statSync(filePath);

    // If file was modified since last load, reload it
    if (!lastModifiedTime || stats.mtime > lastModifiedTime) {
      logger.info('Watchlist file modified, reloading...', {
        lastModified: lastModifiedTime,
        newModified: stats.mtime,
      });

      await loadWatchlist();
      return true;
    }

    return false;

  } catch (error) {
    logger.error('Error checking watchlist modification', error);
    return false;
  }
}

/**
 * Start watching the watchlist file for changes
 * Checks every 6 hours by default
 */
export function startWatchlistMonitoring(intervalHours = 6) {
  if (watchCheckInterval) {
    logger.warn('Watchlist monitoring already started');
    return;
  }

  const intervalMs = intervalHours * 60 * 60 * 1000;

  watchCheckInterval = setInterval(async () => {
    logger.debug('Checking for watchlist updates...');
    await checkAndReloadWatchlist();
  }, intervalMs);

  logger.info('Watchlist hot-reload monitoring started', {
    checkIntervalHours: intervalHours,
  });
}

/**
 * Stop watching the watchlist file
 */
export function stopWatchlistMonitoring() {
  if (watchCheckInterval) {
    clearInterval(watchCheckInterval);
    watchCheckInterval = null;
    logger.info('Watchlist monitoring stopped');
  }
}

/**
 * Get all watchlist companies
 */
export function getWatchlistCompanies() {
  return watchlistData;
}

/**
 * Get a specific watchlist company by name (case-insensitive)
 */
export function getWatchlistCompany(companyName) {
  if (!companyName) return null;

  const normalized = companyName.toLowerCase().trim();

  return watchlistData.find(
    (company) => company.company_name.toLowerCase().trim() === normalized
  );
}

/**
 * Check if a company is in the watchlist
 */
export function isWatchlistCompany(companyName) {
  return getWatchlistCompany(companyName) !== null;
}

/**
 * Get companies by priority
 */
export function getCompaniesByPriority(priority) {
  return watchlistData.filter(
    (company) => company.priority.toLowerCase() === priority.toLowerCase()
  );
}

/**
 * Get high priority companies
 */
export function getHighPriorityCompanies() {
  return getCompaniesByPriority('High');
}

/**
 * Export watchlist statistics
 */
export function getWatchlistStats() {
  const stats = {
    total: watchlistData.length,
    withCareerUrl: watchlistData.filter((c) => c.career_url).length,
    withAtsUrl: watchlistData.filter((c) => c.ats_url).length,
    withLinkedInUrl: watchlistData.filter((c) => c.linkedin_url).length,
    byPriority: {
      high: getCompaniesByPriority('High').length,
      medium: getCompaniesByPriority('Medium').length,
      low: getCompaniesByPriority('Low').length,
    },
  };

  return stats;
}

export default {
  load: loadWatchlist,
  checkAndReload: checkAndReloadWatchlist,
  startMonitoring: startWatchlistMonitoring,
  stopMonitoring: stopWatchlistMonitoring,
  getAll: getWatchlistCompanies,
  get: getWatchlistCompany,
  isWatchlist: isWatchlistCompany,
  getByPriority: getCompaniesByPriority,
  getHighPriority: getHighPriorityCompanies,
  getStats: getWatchlistStats,
};
