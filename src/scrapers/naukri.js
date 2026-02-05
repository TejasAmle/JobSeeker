import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { BaseScraper } from './base-scraper.js';
import logger from '../utils/logger.js';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

/**
 * Naukri.com scraper
 * Searches for Product Manager roles with salary filter
 */
export class NaukriScraper extends BaseScraper {
  constructor() {
    super('Naukri');
  }

  async scrape() {
    let browser = null;

    try {
      // Launch browser
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ],
      });

      const page = await browser.newPage();

      // Set realistic user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      const jobs = [];

      // Search queries to try
      const searchQueries = [
        'Product Manager Bangalore',
        'Senior Product Manager Delhi',
        'Lead Product Manager Mumbai',
      ];

      for (const query of searchQueries) {
        try {
          logger.info(`Naukri: Searching for "${query}"`);

          // Construct search URL
          const searchUrl = `https://www.naukri.com/${encodeURIComponent(query)}-jobs`;

          await page.goto(searchUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000,
          });

          // Wait for job listings to load
          await page.waitForSelector('.srp-jobtuple-wrapper, .jobTuple', { timeout: 10000 }).catch(() => {
            logger.warn('No job listings found on Naukri for query', { query });
          });

          // Random delay to appear human
          await this.randomDelay(2000, 4000);

          // Extract job listings
          const pageJobs = await page.evaluate(() => {
            const jobCards = document.querySelectorAll('.srp-jobtuple-wrapper, .jobTuple');
            const results = [];

            jobCards.forEach((card) => {
              try {
                // Extract job data
                const titleElement = card.querySelector('.title, .jobTuple-title a');
                const companyElement = card.querySelector('.comp-name, .companyInfo a');
                const locationElement = card.querySelector('.location, .locWdth');
                const salaryElement = card.querySelector('.salary, .salaryInfo');
                const experienceElement = card.querySelector('.experience, .expWdth');
                const descElement = card.querySelector('.job-description, .jobTupleDesc');
                const linkElement = card.querySelector('.title, .jobTuple-title a');

                if (titleElement && companyElement) {
                  const title = titleElement.textContent.trim();
                  const company = companyElement.textContent.trim();
                  const location = locationElement?.textContent.trim() || '';
                  const salary = salaryElement?.textContent.trim() || '';
                  const experience = experienceElement?.textContent.trim() || '';
                  const description = descElement?.textContent.trim() || '';
                  let jobUrl = linkElement?.getAttribute('href') || '';

                  // Make URL absolute if it's relative
                  if (jobUrl && !jobUrl.startsWith('http')) {
                    jobUrl = `https://www.naukri.com${jobUrl}`;
                  }

                  results.push({
                    title,
                    company,
                    location,
                    salary,
                    experience,
                    description: description.substring(0, 500), // Limit description length
                    source_url: jobUrl,
                    apply_url: jobUrl,
                    posted_date: null, // Naukri doesn't always show posted date in listings
                  });
                }
              } catch (err) {
                console.error('Error parsing job card:', err);
              }
            });

            return results;
          });

          logger.info(`Naukri: Found ${pageJobs.length} jobs for "${query}"`);
          jobs.push(...pageJobs);

          // Delay between queries
          await this.randomDelay(3000, 5000);

        } catch (error) {
          logger.error(`Naukri: Error searching for "${query}"`, error);
          this.errors.push(`Search error for "${query}": ${error.message}`);
        }
      }

      await browser.close();

      // Remove duplicates based on URL
      const uniqueJobs = Array.from(
        new Map(jobs.map(job => [job.source_url, job])).values()
      );

      logger.info(`Naukri: Total unique jobs found: ${uniqueJobs.length}`);

      return uniqueJobs;

    } catch (error) {
      if (browser) {
        await browser.close();
      }
      throw error;
    }
  }
}

export default NaukriScraper;
