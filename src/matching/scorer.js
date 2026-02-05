import config from '../config.js';
import { parseSalary } from './salary-parser.js';
import logger from '../utils/logger.js';

/**
 * Calculate relevance score for a job posting
 * Returns score out of 100 based on:
 * - Title match (30 points)
 * - Compensation match (25 points)
 * - Location match (20 points)
 * - Experience fit (15 points)
 * - Company watchlist bonus (10 points)
 */
export function calculateRelevanceScore(job, watchlistCompany = null) {
  let score = 0;
  const scoreBreakdown = {};

  // 1. Title Match (0-30 points)
  const titleScore = scoreTitleMatch(job.title);
  score += titleScore;
  scoreBreakdown.title = titleScore;

  // 2. Compensation Match (0-25 points)
  const compScore = scoreCompensation(job.salary, job.salary_numeric);
  score += compScore;
  scoreBreakdown.compensation = compScore;

  // 3. Location Match (0-20 points)
  const locationScore = scoreLocation(job.location);
  score += locationScore;
  scoreBreakdown.location = locationScore;

  // 4. Experience Fit (0-15 points)
  const expScore = scoreExperienceFit(job.description, job.title);
  score += expScore;
  scoreBreakdown.experience = expScore;

  // 5. Company Watchlist Bonus (0-10 points)
  const watchlistScore = scoreWatchlist(watchlistCompany);
  score += watchlistScore;
  scoreBreakdown.watchlist = watchlistScore;

  logger.debug('Job scored', {
    jobId: job.id,
    company: job.company,
    title: job.title,
    totalScore: score,
    breakdown: scoreBreakdown,
  });

  return {
    score: Math.min(score, 100), // Cap at 100
    breakdown: scoreBreakdown,
  };
}

/**
 * Score title match (0-30 points)
 */
function scoreTitleMatch(title) {
  if (!title) return 0;

  const titleLower = title.toLowerCase();

  // Exact matches for senior/lead roles
  const exactSeniorMatches = [
    'senior product manager',
    'lead product manager',
    'sr product manager',
    'sr. product manager',
    'lead pm',
    'senior pm',
  ];

  for (const match of exactSeniorMatches) {
    if (titleLower.includes(match)) {
      return 30;
    }
  }

  // Group PM / Director
  const groupMatches = ['group product manager', 'director of product', 'director product', 'group pm'];
  for (const match of groupMatches) {
    if (titleLower.includes(match)) {
      return 28;
    }
  }

  // Generic Product Manager
  if (titleLower.includes('product manager') && !titleLower.includes('associate') && !titleLower.includes('junior')) {
    return 25;
  }

  // Platform / Infrastructure / Technical PM
  const specializedMatches = ['platform pm', 'infrastructure pm', 'technical product manager', 'staff product manager'];
  for (const match of specializedMatches) {
    if (titleLower.includes(match)) {
      return 25;
    }
  }

  // Related roles
  const relatedMatches = ['product lead', 'product owner'];
  for (const match of relatedMatches) {
    if (titleLower.includes(match)) {
      return 15;
    }
  }

  // Principal PM (might be too senior but worth considering)
  if (titleLower.includes('principal product')) {
    return 20;
  }

  return 0;
}

/**
 * Score compensation (0-25 points)
 */
function scoreCompensation(salaryString, salaryNumeric) {
  // If we already have parsed numeric value
  if (salaryNumeric) {
    if (salaryNumeric >= 30) return 25;
    if (salaryNumeric >= 25) return 20;
    if (salaryNumeric >= 20) return 10;
    return 5;
  }

  // Try to parse salary string
  if (salaryString) {
    const parsed = parseSalary(salaryString);
    if (parsed) {
      if (parsed.avg >= 30) return 25;
      if (parsed.avg >= 25) return 20;
      if (parsed.avg >= 20) return 10;
      return 5;
    }
  }

  // Salary not disclosed - give some points for unknown but reputable companies
  return 5;
}

/**
 * Score location match (0-20 points)
 */
function scoreLocation(location) {
  if (!location) return 5; // Some points for unspecified (might be remote)

  const locationLower = location.toLowerCase();

  // Preferred locations (Bangalore, Delhi/NCR, Mumbai)
  const preferredLocations = ['bangalore', 'bengaluru', 'blr', 'delhi', 'ncr', 'gurgaon', 'gurugram', 'noida', 'mumbai', 'bom'];
  for (const loc of preferredLocations) {
    if (locationLower.includes(loc)) {
      return 20;
    }
  }

  // Remote (India eligible)
  if (locationLower.includes('remote') && (locationLower.includes('india') || locationLower.includes('anywhere'))) {
    return 18;
  }

  // Other Indian cities
  const indianCities = ['hyderabad', 'pune', 'chennai', 'kolkata', 'ahmedabad', 'jaipur', 'chandigarh'];
  for (const city of indianCities) {
    if (locationLower.includes(city)) {
      return 15;
    }
  }

  // India (general)
  if (locationLower.includes('india') || locationLower.includes('in')) {
    return 12;
  }

  // Global remote
  if (locationLower.includes('remote')) {
    return 10;
  }

  return 5;
}

/**
 * Score experience fit (0-15 points)
 * Look for experience requirements in title and description
 */
function scoreExperienceFit(description, title) {
  const text = `${title} ${description || ''}`.toLowerCase();

  // Extract years of experience mentioned
  const expPatterns = [
    /(\d+)\s*(?:-|to)\s*(\d+)\s*(?:years?|yrs?)/i,
    /(\d+)\+?\s*(?:years?|yrs?)/i,
  ];

  for (const pattern of expPatterns) {
    const match = text.match(pattern);
    if (match) {
      const min = parseInt(match[1]);
      const max = match[2] ? parseInt(match[2]) : min;

      // Tejas has 4 years experience
      const tejasExp = config.candidate.experience;

      // Perfect fit: 3-7 years
      if (min <= tejasExp && max >= tejasExp) {
        return 15;
      }

      // Close fit: 2-5 or 5-8
      if ((min <= tejasExp + 1 && max >= tejasExp - 1)) {
        return 12;
      }

      // Acceptable: asking for up to 8 years
      if (max <= 8 && min <= tejasExp) {
        return 10;
      }

      // Too senior (10+ years)
      if (min >= 10) {
        return 0;
      }

      // Too junior (1-2 years)
      if (max <= 2) {
        return 3;
      }

      return 7;
    }
  }

  // No experience mentioned - give neutral score
  return 8;
}

/**
 * Score watchlist bonus (0-10 points)
 */
function scoreWatchlist(watchlistCompany) {
  if (!watchlistCompany) {
    return 0;
  }

  const priority = watchlistCompany.priority?.toLowerCase() || 'medium';

  if (priority === 'high') return 10;
  if (priority === 'medium') return 5;
  if (priority === 'low') return 3;

  return 0;
}

/**
 * Check if job should be excluded based on role
 */
export function shouldExcludeJob(title, description) {
  const text = `${title} ${description || ''}`.toLowerCase();

  // Exclude keywords from config
  for (const excluded of config.jobCriteria.excludeRoles) {
    if (text.includes(excluded.toLowerCase())) {
      logger.debug('Job excluded', { title, reason: `Matched exclude keyword: ${excluded}` });
      return true;
    }
  }

  return false;
}

/**
 * Determine notification action based on score
 */
export function getNotificationAction(score) {
  if (score >= config.scoring.notifyThreshold) {
    return 'notify'; // Send immediate notification
  }
  if (score >= 40) {
    return 'digest'; // Include in daily digest
  }
  return 'log'; // Just log, don't notify
}

export default {
  calculateRelevanceScore,
  shouldExcludeJob,
  getNotificationAction,
};
