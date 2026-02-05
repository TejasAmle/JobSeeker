import axios from 'axios';
import * as cheerio from 'cheerio';
import { BaseScraper } from './base-scraper.js';
import logger from '../utils/logger.js';

/**
 * Instahyre scraper
 * Note: Instahyre requires login for full access, so this scraper
 * will try to scrape publicly available job listings
 */
export class InstahyreScraper extends BaseScraper {
  constructor() {
    super('Instahyre');
    this.baseUrl = 'https://www.instahyre.com';
  }

  async scrape() {
    try {
      const jobs = [];

      // Instahyre job search URLs
      const searchUrls = [
        '/search-jobs/product-manager-jobs-in-bangalore/',
        '/search-jobs/product-manager-jobs-in-delhi/',
        '/search-jobs/senior-product-manager-jobs/',
      ];

      for (const searchPath of searchUrls) {
        try {
          logger.info(`Instahyre: Fetching ${searchPath}`);

          const response = await axios.get(`${this.baseUrl}${searchPath}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
            },
            timeout: 30000,
          });

          const $ = cheerio.load(response.data);

          // Parse job listings
          $('.job-card, .opportunity-card').each((index, element) => {
            try {
              const $el = $(element);

              const title = $el.find('.job-title, .opportunity-title').text().trim();
              const company = $el.find('.company-name, .employer-name').text().trim();
              const location = $el.find('.job-location, .location').text().trim();
              const salary = $el.find('.salary, .compensation').text().trim();
              const experience = $el.find('.experience, .yoe').text().trim();
              const description = $el.find('.job-description, .description').text().trim();

              let jobUrl = $el.find('a').attr('href') || '';
              if (jobUrl && !jobUrl.startsWith('http')) {
                jobUrl = `${this.baseUrl}${jobUrl}`;
              }

              if (title && company && jobUrl) {
                jobs.push({
                  title,
                  company,
                  location: location || '',
                  salary: salary || '',
                  experience,
                  description: description.substring(0, 500),
                  source_url: jobUrl,
                  apply_url: jobUrl,
                  posted_date: null,
                });
              }
            } catch (error) {
              logger.debug('Error parsing Instahyre job card', error);
            }
          });

          logger.info(`Instahyre: Found ${jobs.length} jobs from ${searchPath}`);

          // Rate limiting - delay between requests
          await this.randomDelay(3000, 5000);

        } catch (error) {
          logger.error(`Instahyre: Error fetching ${searchPath}`, error);
          this.errors.push(`Fetch error for ${searchPath}: ${error.message}`);
        }
      }

      // If HTML scraping didn't work, try API approach
      if (jobs.length === 0) {
        logger.warn('Instahyre: No jobs found via HTML scraping, attempting API approach');
        const apiJobs = await this.scrapeViaApi();
        jobs.push(...apiJobs);
      }

      // Remove duplicates
      const uniqueJobs = Array.from(
        new Map(jobs.map(job => [job.source_url, job])).values()
      );

      logger.info(`Instahyre: Total unique jobs found: ${uniqueJobs.length}`);

      return uniqueJobs;

    } catch (error) {
      logger.error('Instahyre scraper failed', error);
      throw error;
    }
  }

  /**
   * Alternative approach: Try to find Instahyre's API endpoints
   * Note: This may not work if Instahyre requires authentication
   */
  async scrapeViaApi() {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/jobs/search`,
        {
          keywords: 'Product Manager',
          locations: ['Bangalore', 'Delhi', 'Mumbai'],
          experience_min: 3,
          experience_max: 8,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          timeout: 30000,
        }
      );

      if (response.data && Array.isArray(response.data.jobs)) {
        return response.data.jobs.map(job => ({
          title: job.title || job.role,
          company: job.company_name || job.company,
          location: job.location || job.city,
          salary: job.salary_range || job.ctc,
          experience: job.experience || '',
          description: job.description?.substring(0, 500) || '',
          source_url: job.url || `${this.baseUrl}/job/${job.id}`,
          apply_url: job.apply_url || job.url || `${this.baseUrl}/job/${job.id}`,
          posted_date: job.posted_on || job.created_at,
        }));
      }

      return [];

    } catch (error) {
      logger.debug('Instahyre API approach failed (may require auth)', { error: error.message });
      return [];
    }
  }
}

export default InstahyreScraper;
