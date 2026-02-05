import logger from '../utils/logger.js';

// Exchange rate USD to INR (approximate - update periodically)
const USD_TO_INR = 83;

/**
 * Parse salary string and convert to LPA (Lakhs Per Annum)
 * Handles various Indian salary formats
 *
 * Examples:
 * - "₹25,00,000 - ₹35,00,000" → { min: 25, max: 35, avg: 30 }
 * - "25-35 LPA" → { min: 25, max: 35, avg: 30 }
 * - "₹25L - ₹35L" → { min: 25, max: 35, avg: 30 }
 * - "2500000" → { min: 25, max: 25, avg: 25 }
 * - "$30,000 - $50,000 USD" → { min: 25, max: 42, avg: 33 }
 * - "Not disclosed" → null
 */
export function parseSalary(salaryString) {
  if (!salaryString || typeof salaryString !== 'string') {
    return null;
  }

  const cleaned = salaryString.trim().toLowerCase();

  // Check for "not disclosed", "competitive", etc.
  const undisclosedKeywords = ['not disclosed', 'competitive', 'negotiable', 'tbd', 'to be discussed'];
  if (undisclosedKeywords.some(keyword => cleaned.includes(keyword))) {
    return null;
  }

  try {
    // Pattern 1: USD format ($30,000 - $50,000 or $30K - $50K)
    const usdPattern = /\$\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*k?\s*(?:-|to)\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*k?/i;
    const usdMatch = cleaned.match(usdPattern);
    if (usdMatch) {
      let min = parseFloat(usdMatch[1].replace(/,/g, ''));
      let max = parseFloat(usdMatch[2].replace(/,/g, ''));

      // If it has 'K' in the original string, multiply by 1000
      if (cleaned.includes('k')) {
        min *= 1000;
        max *= 1000;
      }

      // Convert USD to LPA
      min = Math.round((min * USD_TO_INR) / 100000);
      max = Math.round((max * USD_TO_INR) / 100000);

      return {
        min,
        max,
        avg: Math.round((min + max) / 2),
        currency: 'USD_CONVERTED',
      };
    }

    // Pattern 2: Single USD value
    const singleUsdPattern = /\$\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*k?/i;
    const singleUsdMatch = cleaned.match(singleUsdPattern);
    if (singleUsdMatch) {
      let value = parseFloat(singleUsdMatch[1].replace(/,/g, ''));
      if (cleaned.includes('k')) {
        value *= 1000;
      }
      value = Math.round((value * USD_TO_INR) / 100000);

      return {
        min: value,
        max: value,
        avg: value,
        currency: 'USD_CONVERTED',
      };
    }

    // Pattern 3: LPA format (25-35 LPA or 25 - 35 LPA)
    const lpaPattern = /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*lpa/i;
    const lpaMatch = cleaned.match(lpaPattern);
    if (lpaMatch) {
      const min = parseFloat(lpaMatch[1]);
      const max = parseFloat(lpaMatch[2]);

      return {
        min,
        max,
        avg: Math.round((min + max) / 2),
        currency: 'INR',
      };
    }

    // Pattern 4: Single LPA value (25 LPA)
    const singleLpaPattern = /(\d+(?:\.\d+)?)\s*lpa/i;
    const singleLpaMatch = cleaned.match(singleLpaPattern);
    if (singleLpaMatch) {
      const value = parseFloat(singleLpaMatch[1]);

      return {
        min: value,
        max: value,
        avg: value,
        currency: 'INR',
      };
    }

    // Pattern 5: Lakhs format (₹25L - ₹35L or 25L - 35L)
    const lakhsPattern = /₹?\s*(\d+(?:\.\d+)?)\s*l\s*(?:-|to)\s*₹?\s*(\d+(?:\.\d+)?)\s*l/i;
    const lakhsMatch = cleaned.match(lakhsPattern);
    if (lakhsMatch) {
      const min = parseFloat(lakhsMatch[1]);
      const max = parseFloat(lakhsMatch[2]);

      return {
        min,
        max,
        avg: Math.round((min + max) / 2),
        currency: 'INR',
      };
    }

    // Pattern 6: Single lakhs value (₹25L or 25L)
    const singleLakhsPattern = /₹?\s*(\d+(?:\.\d+)?)\s*l(?:akhs?)?/i;
    const singleLakhsMatch = cleaned.match(singleLakhsPattern);
    if (singleLakhsMatch) {
      const value = parseFloat(singleLakhsMatch[1]);

      return {
        min: value,
        max: value,
        avg: value,
        currency: 'INR',
      };
    }

    // Pattern 7: Rupees format (₹25,00,000 - ₹35,00,000)
    const rupeesPattern = /₹\s*(\d+(?:,\d+)*)\s*(?:-|to)\s*₹\s*(\d+(?:,\d+)*)/i;
    const rupeesMatch = cleaned.match(rupeesPattern);
    if (rupeesMatch) {
      const min = Math.round(parseFloat(rupeesMatch[1].replace(/,/g, '')) / 100000);
      const max = Math.round(parseFloat(rupeesMatch[2].replace(/,/g, '')) / 100000);

      return {
        min,
        max,
        avg: Math.round((min + max) / 2),
        currency: 'INR',
      };
    }

    // Pattern 8: Single rupees value (₹25,00,000 or 2500000)
    const singleRupeesPattern = /₹?\s*(\d+(?:,\d+)*)/i;
    const singleRupeesMatch = cleaned.match(singleRupeesPattern);
    if (singleRupeesMatch) {
      const value = parseFloat(singleRupeesMatch[1].replace(/,/g, ''));

      // Only process if it looks like a salary (> 100,000)
      if (value > 100000) {
        const lpa = Math.round(value / 100000);

        return {
          min: lpa,
          max: lpa,
          avg: lpa,
          currency: 'INR',
        };
      }
    }

    // Pattern 9: Per month format (₹2L/month or ₹2,00,000 per month)
    const monthlyPattern = /₹?\s*(\d+(?:,\d+)*)\s*(?:l|lakhs?)?\s*(?:\/|per)\s*month/i;
    const monthlyMatch = cleaned.match(monthlyPattern);
    if (monthlyMatch) {
      let monthly = parseFloat(monthlyMatch[1].replace(/,/g, ''));

      // If it has 'L' or 'lakhs', it's already in lakhs
      if (cleaned.match(/(\d+)\s*l(?:akhs?)?/i)) {
        monthly = monthly; // Already in lakhs
      } else {
        monthly = monthly / 100000; // Convert to lakhs
      }

      const annual = Math.round(monthly * 12);

      return {
        min: annual,
        max: annual,
        avg: annual,
        currency: 'INR',
      };
    }

    // If we couldn't parse it, log and return null
    logger.debug('Could not parse salary string', { salaryString });
    return null;

  } catch (error) {
    logger.error('Error parsing salary', error, { salaryString });
    return null;
  }
}

/**
 * Format salary for display
 */
export function formatSalary(salaryData) {
  if (!salaryData) {
    return 'Not disclosed';
  }

  const { min, max, currency } = salaryData;

  if (min === max) {
    return currency === 'USD_CONVERTED'
      ? `₹${min} LPA (converted from USD)`
      : `₹${min} LPA`;
  }

  return currency === 'USD_CONVERTED'
    ? `₹${min}-${max} LPA (converted from USD)`
    : `₹${min}-${max} LPA`;
}

/**
 * Check if salary meets minimum threshold
 */
export function meetsMinimumSalary(salaryData, minLPA) {
  if (!salaryData) {
    return false; // Undisclosed salary doesn't meet threshold
  }

  // Use average salary for comparison
  return salaryData.avg >= minLPA;
}

export default {
  parseSalary,
  formatSalary,
  meetsMinimumSalary,
};
