import crypto from 'crypto';
import stringSimilarity from 'string-similarity';
import logger from '../utils/logger.js';
import db from '../data/db.js';

/**
 * Generate a unique ID for a job posting
 * Uses hash of: company + title + location
 */
export function generateJobId(company, title, location) {
  const normalized = [
    company?.toLowerCase().trim() || '',
    title?.toLowerCase().trim() || '',
    location?.toLowerCase().trim() || '',
  ].join('|');

  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

/**
 * Check if a job is a duplicate
 * Returns { isDuplicate: boolean, reason: string, existingJob: object }
 */
export async function checkDuplicate(job) {
  const jobId = generateJobId(job.company, job.title, job.location);

  // 1. Check exact ID match (hash-based)
  const existingJob = await db.getJobById(jobId);

  if (existingJob) {
    // Check if it's a recent duplicate (within 7 days)
    const existingDate = new Date(existingJob.discovered_at);
    const daysSinceDiscovered = (Date.now() - existingDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceDiscovered <= 7) {
      logger.debug('Duplicate job found (exact match, recent)', {
        jobId,
        company: job.company,
        title: job.title,
        daysSinceDiscovered: Math.round(daysSinceDiscovered),
      });

      return {
        isDuplicate: true,
        reason: 'exact_match_recent',
        existingJob,
        daysSinceDiscovered: Math.round(daysSinceDiscovered),
      };
    }

    // If it's old (30+ days), treat as reposted
    if (daysSinceDiscovered >= 30) {
      logger.info('Job reposted after 30+ days', {
        jobId,
        company: job.company,
        title: job.title,
        daysSinceDiscovered: Math.round(daysSinceDiscovered),
      });

      return {
        isDuplicate: false,
        reason: 'reposted',
        existingJob,
        daysSinceDiscovered: Math.round(daysSinceDiscovered),
      };
    }

    // Between 7-30 days: Log but treat as duplicate (don't notify again)
    logger.debug('Duplicate job found (exact match, moderately old)', {
      jobId,
      company: job.company,
      title: job.title,
      daysSinceDiscovered: Math.round(daysSinceDiscovered),
    });

    return {
      isDuplicate: true,
      reason: 'exact_match_moderate',
      existingJob,
      daysSinceDiscovered: Math.round(daysSinceDiscovered),
    };
  }

  // 2. Fuzzy matching check (for similar jobs at same company)
  const fuzzyDuplicate = await checkFuzzyDuplicate(job);

  if (fuzzyDuplicate.isDuplicate) {
    return fuzzyDuplicate;
  }

  // Not a duplicate
  return {
    isDuplicate: false,
    reason: 'unique',
    jobId,
  };
}

/**
 * Check for fuzzy duplicates using string similarity
 * Looks for jobs with similar titles at the same company
 */
async function checkFuzzyDuplicate(job) {
  try {
    // Get recent jobs (last 30 days) from the same company
    const recentJobs = await db.getRecentJobs(30 * 24); // 30 days in hours

    const sameCompanyJobs = recentJobs.filter(
      (existingJob) =>
        existingJob.company.toLowerCase() === job.company.toLowerCase()
    );

    if (sameCompanyJobs.length === 0) {
      return { isDuplicate: false };
    }

    // Check title similarity
    for (const existingJob of sameCompanyJobs) {
      const similarity = stringSimilarity.compareTwoStrings(
        job.title.toLowerCase(),
        existingJob.title.toLowerCase()
      );

      // If titles are >85% similar, consider it a duplicate
      if (similarity >= 0.85) {
        const existingDate = new Date(existingJob.discovered_at);
        const daysSinceDiscovered = (Date.now() - existingDate.getTime()) / (1000 * 60 * 60 * 24);

        logger.debug('Fuzzy duplicate found', {
          newTitle: job.title,
          existingTitle: existingJob.title,
          similarity: Math.round(similarity * 100),
          company: job.company,
          daysSinceDiscovered: Math.round(daysSinceDiscovered),
        });

        return {
          isDuplicate: true,
          reason: 'fuzzy_match',
          existingJob,
          similarity: Math.round(similarity * 100),
          daysSinceDiscovered: Math.round(daysSinceDiscovered),
        };
      }

      // Check for location changes (same title, different location = might be new role)
      if (similarity >= 0.95) {
        const locationDifferent =
          job.location &&
          existingJob.location &&
          job.location.toLowerCase() !== existingJob.location.toLowerCase();

        if (locationDifferent) {
          logger.info('Similar job with different location - treating as unique', {
            title: job.title,
            company: job.company,
            newLocation: job.location,
            existingLocation: existingJob.location,
          });

          return { isDuplicate: false, reason: 'different_location' };
        }
      }
    }

    return { isDuplicate: false };

  } catch (error) {
    logger.error('Error in fuzzy duplicate check', error);
    // If fuzzy check fails, return not duplicate to be safe
    return { isDuplicate: false };
  }
}

/**
 * Normalize company name for better matching
 * Removes common suffixes like "Inc", "Ltd", "Pvt Ltd", etc.
 */
export function normalizeCompanyName(companyName) {
  if (!companyName) return '';

  let normalized = companyName.toLowerCase().trim();

  // Remove common suffixes
  const suffixes = [
    'inc.',
    'inc',
    'ltd.',
    'ltd',
    'pvt ltd',
    'pvt. ltd.',
    'private limited',
    'llc',
    'corporation',
    'corp',
    'corp.',
    'technologies',
    'tech',
    'software',
    'solutions',
  ];

  for (const suffix of suffixes) {
    if (normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, -suffix.length).trim();
    }
  }

  return normalized;
}

/**
 * Check if job should be deduplicated based on URL
 * Some job boards list the same job multiple times with different URLs
 */
export function isSameJobUrl(url1, url2) {
  if (!url1 || !url2) return false;

  try {
    const u1 = new URL(url1);
    const u2 = new URL(url2);

    // Same domain and path = same job
    return u1.hostname === u2.hostname && u1.pathname === u2.pathname;
  } catch {
    // If URL parsing fails, do string comparison
    return url1 === url2;
  }
}

export default {
  generateJobId,
  checkDuplicate,
  normalizeCompanyName,
  isSameJobUrl,
};
