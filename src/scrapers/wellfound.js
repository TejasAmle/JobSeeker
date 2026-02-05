import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { BaseScraper } from './base-scraper.js';
import logger from '../utils/logger.js';

puppeteer.use(StealthPlugin());

/**
 * Wellfound (formerly AngelList Talent) scraper
 * Focuses on startup PM roles
 */
export class WellfoundScraper extends BaseScraper {
  constructor() {
    super('Wellfound');
    this.baseUrl = 'https://wellfound.com';
  }

  async scrape() {
    let browser = null;

    try {
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

      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      await page.setViewport({ width: 1920, height: 1080 });

      const jobs = [];

      // Search URLs for different roles
      const searchUrls = [
        `${this.baseUrl}/role/r/product-manager`,
        `${this.baseUrl}/role/r/senior-product-manager`,
        `${this.baseUrl}/jobs?role=Product%20Manager&location=India`,
      ];

      for (const url of searchUrls) {
        try {
          logger.info(`Wellfound: Fetching ${url}`);

          await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000,
          });

          // Wait for job listings
          await page.waitForSelector('[data-test="StartupResult"], .job-listing, .startup-link', {
            timeout: 10000,
          }).catch(() => {
            logger.warn('No job listings found on Wellfound for URL', { url });
          });

          await this.randomDelay(2000, 4000);

          // Extract job data
          const pageJobs = await page.evaluate(() => {
            const results = [];

            // Try multiple selectors as Wellfound's DOM structure may vary
            const selectors = [
              '[data-test="StartupResult"]',
              '.job-listing',
              '.startup-link',
              '.styles_component__1wQ8j', // Generic class they sometimes use
            ];

            let jobElements = [];
            for (const selector of selectors) {
              jobElements = document.querySelectorAll(selector);
              if (jobElements.length > 0) break;
            }

            jobElements.forEach((element) => {
              try {
                // Try to find job details within the element
                const titleEl = element.querySelector('[data-test="StartupResult-title"], .job-title, h2, h3, a');
                const companyEl = element.querySelector('[data-test="StartupResult-company"], .company-name, .startup-name');
                const locationEl = element.querySelector('[data-test="location"], .location, .location-text');
                const salaryEl = element.querySelector('.salary, .compensation, [data-test="compensation"]');
                const linkEl = element.querySelector('a[href*="/role"], a[href*="/jobs"]');

                if (titleEl) {
                  const title = titleEl.textContent?.trim() || '';
                  const company = companyEl?.textContent?.trim() || '';
                  const location = locationEl?.textContent?.trim() || 'Remote';
                  const salary = salaryEl?.textContent?.trim() || '';
                  let jobUrl = linkEl?.getAttribute('href') || '';

                  // Make URL absolute
                  if (jobUrl && !jobUrl.startsWith('http')) {
                    jobUrl = `https://wellfound.com${jobUrl}`;
                  }

                  // Only add if we have at least title and URL
                  if (title && jobUrl) {
                    results.push({
                      title,
                      company: company || 'Startup',
                      location,
                      salary,
                      source_url: jobUrl,
                      apply_url: jobUrl,
                      description: '', // Will need to visit individual pages for full description
                      posted_date: null,
                    });
                  }
                }
              } catch (err) {
                console.error('Error parsing job element:', err);
              }
            });

            return results;
          });

          logger.info(`Wellfound: Found ${pageJobs.length} jobs from ${url}`);
          jobs.push(...pageJobs);

          // Scroll down to load more jobs (if lazy loaded)
          try {
            await page.evaluate(() => {
              window.scrollTo(0, document.body.scrollHeight);
            });
            await this.delay(2000);

            // Try to extract more jobs after scroll
            const moreJobs = await page.evaluate(() => {
              const results = [];
              const jobElements = document.querySelectorAll('[data-test="StartupResult"], .job-listing');

              jobElements.forEach((element) => {
                try {
                  const titleEl = element.querySelector('[data-test="StartupResult-title"], .job-title, h2');
                  const companyEl = element.querySelector('[data-test="StartupResult-company"], .company-name');
                  const linkEl = element.querySelector('a[href*="/role"]');

                  if (titleEl && linkEl) {
                    const title = titleEl.textContent?.trim() || '';
                    const company = companyEl?.textContent?.trim() || 'Startup';
                    let jobUrl = linkEl?.getAttribute('href') || '';

                    if (jobUrl && !jobUrl.startsWith('http')) {
                      jobUrl = `https://wellfound.com${jobUrl}`;
                    }

                    if (title && jobUrl) {
                      results.push({
                        title,
                        company,
                        location: 'Remote/India',
                        salary: '',
                        source_url: jobUrl,
                        apply_url: jobUrl,
                        description: '',
                        posted_date: null,
                      });
                    }
                  }
                } catch (err) {
                  console.error('Error in scroll extraction:', err);
                }
              });

              return results;
            });

            jobs.push(...moreJobs);
          } catch (scrollError) {
            logger.debug('Wellfound: Scroll loading failed', { error: scrollError.message });
          }

          await this.randomDelay(3000, 5000);

        } catch (error) {
          logger.error(`Wellfound: Error fetching ${url}`, error);
          this.errors.push(`Fetch error for ${url}: ${error.message}`);
        }
      }

      await browser.close();

      // Remove duplicates based on URL
      const uniqueJobs = Array.from(
        new Map(jobs.map(job => [job.source_url, job])).values()
      );

      logger.info(`Wellfound: Total unique jobs found: ${uniqueJobs.length}`);

      return uniqueJobs;

    } catch (error) {
      if (browser) {
        await browser.close();
      }
      throw error;
    }
  }
}

export default WellfoundScraper;
