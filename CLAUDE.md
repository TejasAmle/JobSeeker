# Job Hunter Agent - Development Log

## Project Overview
Autonomous job hunting agent that scrapes job boards for Product Manager roles matching Tejas's profile and sends notifications via Email and WhatsApp.

## Implementation Status

### ✅ ALL MVP FEATURES COMPLETED!

#### Phase 1: Foundation ✅
- [x] Project scaffolding
  - Created directory structure: `src/{scrapers,matching,notifications,data,utils}`
  - Set up package.json with all dependencies (nodemailer, whatsapp-web.js, puppeteer, sqlite3, etc.)
  - Created .gitignore to exclude sensitive files

- [x] Configuration (src/config.js)
  - Loads environment variables from .env
  - Centralized configuration for all modules
  - Includes candidate profile, job criteria, paths
  - Validation function for critical config

- [x] Logger (src/utils/logger.js)
  - Winston-based structured logging
  - Console + file logging (combined.log, error.log)
  - Helper functions: logScrape, logError, logNotification

- [x] SQLite Database (src/data/db.js)
  - Tables created: jobs, scrape_logs, company_watchlist, blocked_companies
  - Indexed for performance
  - CRUD operations for all tables
  - Deduplication built into insertJob
  - Statistics and cleanup functions

- [x] Email Notifications (src/notifications/email.js)
  - Gmail SMTP integration using nodemailer
  - Beautiful HTML email templates for job notifications
  - Daily digest email support
  - Match reasons in notifications
  - Test connection function

- [x] WhatsApp Notifications (src/notifications/whatsapp.js)
  - whatsapp-web.js integration
  - QR code generation for linking
  - Session persistence with LocalAuth
  - Rate limiting (30 second delay between messages)
  - Auto-reconnect on disconnect
  - Message queue for reliability

- [x] Job Scoring Engine (src/matching/scorer.js)
  - 100-point scoring system
  - Title match, compensation, location, experience, watchlist bonus
  - Exclusion logic for unwanted roles
  - Notification action determination

- [x] Salary Parser (src/matching/salary-parser.js)
  - Handles ₹25L, 25 LPA, $30K USD, ₹25,00,000, etc.
  - USD to INR conversion
  - Range extraction (min/max/avg)
  - Format normalization

- [x] Deduplication Module (src/matching/dedup.js)
  - Hash-based exact matching
  - Fuzzy matching using string similarity (>85% threshold)
  - 7-day duplicate window
  - 30+ day repost detection

- [x] Excel Watchlist Reader (src/data/watchlist.js)
  - Reads PM_Companies_Comprehensive_Tejas.xlsx
  - Hot-reload every 6 hours
  - Priority-based company scoring
  - Sync to database

#### Phase 2: Core Scrapers (MVP) ✅
- [x] Naukri Scraper (src/scrapers/naukri.js)
  - Puppeteer-based scraping
  - Multiple search queries (Bangalore, Delhi, Mumbai)
  - Stealth plugin to avoid detection
  - Rate limiting and random delays

- [x] Instahyre Scraper (src/scrapers/instahyre.js)
  - HTTP/Cheerio-based scraping
  - Multiple location searches
  - API fallback approach
  - Error resilience

- [x] Wellfound Scraper (src/scrapers/wellfound.js)
  - Puppeteer-based scraping
  - Startup-focused PM roles
  - Scroll-to-load support
  - Multiple selector strategies

- [x] Base Scraper Class (src/scrapers/base-scraper.js)
  - Common scraping logic
  - Job processing pipeline (dedupe → score → save → notify)
  - Error handling and logging
  - Rate limiting helpers

#### Phase 3: Infrastructure ✅
- [x] Scheduler (src/utils/scheduler.js)
  - node-cron based scheduling
  - Scrapes every 30 minutes (configurable)
  - Watchlist hot-reload every 6 hours
  - Database cleanup daily at 3 AM
  - Manual trigger endpoint

- [x] Health Check Server (src/utils/health-server.js)
  - Express server on port 3000
  - /health endpoint for Render
  - /status endpoint with detailed stats
  - POST /scrape for manual triggers
  - Memory and uptime monitoring

- [x] Main Entry Point (src/index.js)
  - Initialization sequence
  - ASCII banner
  - Graceful shutdown handling
  - Signal handlers (SIGTERM, SIGINT)
  - Error handling

#### Phase 4: Deployment ✅
- [x] Dockerfile
  - Node 20 slim base image
  - Chromium installation for Puppeteer
  - Health check configuration
  - Volume mounts for data and WhatsApp session

- [x] Render Configuration (render.yaml)
  - Free tier web service config
  - Environment variables
  - Persistent disk for database
  - Health check path

- [x] Documentation
  - Comprehensive README.md with setup instructions
  - Gmail app password setup guide
  - WhatsApp QR scan instructions
  - Deployment guide for Render
  - Troubleshooting section
  - .env.example template

## Design Decisions

### MVP Scope (Based on User Preferences)
- **Deployment**: Render free tier (with keep-alive strategy)
- **LinkedIn**: EXCLUDED - Manual checks only (avoid account ban risk)
- **Notifications**: Email (Gmail) + WhatsApp (no Telegram in MVP)
- **Job Platforms**: Naukri, Instahyre, Wellfound only (easier to scrape)

### Technical Choices
- **Language**: Node.js (JavaScript) with ES modules
- **Database**: SQLite (file-based, zero config, perfect for Render)
- **Email**: Gmail SMTP with app password (free)
- **WhatsApp**: whatsapp-web.js (free but requires QR scan)
- **Scraping**: Puppeteer with stealth plugin for complex sites
- **Scheduler**: node-cron for timed scraping

## Dependencies Installed
```json
{
  "axios": "^1.6.5",              // HTTP requests
  "cheerio": "^1.0.0-rc.12",      // HTML parsing
  "dotenv": "^16.4.1",            // Environment variables
  "express": "^4.18.2",           // Health check endpoint
  "node-cron": "^3.0.3",          // Job scheduler
  "nodemailer": "^6.9.8",         // Email sending
  "puppeteer": "^21.7.0",         // Browser automation
  "puppeteer-extra": "^3.3.6",    // Puppeteer plugins
  "puppeteer-extra-plugin-stealth": "^2.11.2",  // Anti-detection
  "sqlite3": "^5.1.7",            // Database
  "whatsapp-web.js": "^1.23.0",   // WhatsApp integration
  "winston": "^3.11.0",           // Logging
  "xlsx": "^0.18.5",              // Excel file reading
  "string-similarity": "^4.0.4",  // Fuzzy deduplication
  "qrcode-terminal": "^0.12.0"    // WhatsApp QR display
}
```

## Configuration Required (.env)

```env
# Critical (must be filled by user):
GMAIL_ADDRESS=tejas.amle71@gmail.com
GMAIL_APP_PASSWORD=[Generate at myaccount.google.com/apppasswords]

# Optional:
AGENT_ENABLED=true
NODE_ENV=production
LOG_LEVEL=info
PORT=3000
WHATSAPP_ENABLED=true
WHATSAPP_NUMBER=919910282204
SCRAPE_INTERVAL_MINUTES=30
NOTIFY_THRESHOLD=60
MIN_SALARY_LPA=25
```

## File Structure
```
JobSearch/
├── package.json
├── .env.example
├── .gitignore
├── CLAUDE.md (this file)
├── promptPrd.md (original requirements)
├── PM_Companies_Comprehensive_Tejas.xlsx (company watchlist)
├── src/
│   ├── config.js ✅
│   ├── index.js (pending)
│   ├── data/
│   │   └── db.js ✅
│   ├── notifications/
│   │   ├── email.js ✅
│   │   └── whatsapp.js (in progress)
│   ├── matching/ (pending)
│   ├── scrapers/ (pending)
│   └── utils/
│       └── logger.js ✅
├── data/
│   ├── jobs.db (created at runtime)
│   └── career-urls-cache.json (created at runtime)
└── logs/
    ├── combined.log
    └── error.log
```

## Known Issues / Notes

### Render Free Tier Limitations
- Spins down after 15 minutes of inactivity
- Solution: Use external cron service (cron-job.org) to ping health endpoint every 10 minutes
- Alternative: GitHub Actions scheduled workflow to keep alive

### WhatsApp Stability
- whatsapp-web.js requires persistent session
- On Render, need persistent disk for .wwebjs_auth/ directory
- Session may disconnect - need auto-reconnect logic
- Rate limiting: max 1 message per 30 seconds to avoid ban

### Scraping Challenges
- Job boards actively block scrapers
- Need to implement:
  - User-Agent rotation
  - Request delays (3-10 seconds)
  - Retry logic with exponential backoff
  - Fallback to API endpoints where available

## Next Steps (Current Session)
1. ✅ Create CLAUDE.md tracking file
2. 🚧 Build WhatsApp notification module
3. ⏭️ Create job scoring engine with salary parser
4. ⏭️ Build deduplication logic
5. ⏭️ Create Excel watchlist reader

## Testing Checklist (Before Deployment)
- [ ] Email sends successfully (test connection)
- [ ] WhatsApp QR code generates and connects
- [ ] Database creates tables on first run
- [ ] Job scoring works correctly
- [ ] Salary parser handles various formats (₹25L, 25 LPA, $30K USD, etc.)
- [ ] Deduplication prevents duplicate notifications
- [ ] Excel watchlist loads companies
- [ ] Health endpoint returns status
- [ ] Scrapers return results from each platform

## Cost Breakdown
- Render free tier: $0 (500 hours/month = ~20 days)
- Gmail SMTP: $0 (using app password)
- WhatsApp Web.js: $0 (uses personal WhatsApp)
- External cron service: $0 (free tier on cron-job.org)
- **Total: $0/month** ✅

## Future Enhancements (Post-MVP)
- Add Telegram bot notifications
- Add more job platforms (IIMJobs, Cutshort, etc.)
- Implement LinkedIn post monitoring (separate account)
- Add Greenhouse/Lever ATS scrapers for watchlist companies
- Daily digest email at 9 AM IST
- Fuzzy deduplication using Levenshtein distance
- Proxy rotation for better scraping reliability
- Company career page discovery via Google search

---

## 🎉 MVP Complete - Ready to Run!

### Immediate Next Steps for Tejas

1. **Install Dependencies**
   ```bash
   cd "/Users/tejasa/Tejas Personal/Projects/JobSearch"
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env and fill in:
   # - GMAIL_ADDRESS (already filled)
   # - GMAIL_APP_PASSWORD (get from myaccount.google.com/apppasswords)
   ```

3. **Test Locally First**
   ```bash
   npm start
   ```
   - Scan WhatsApp QR code when it appears
   - Wait for first scrape cycle to complete
   - Check email and WhatsApp for test notifications

4. **Deploy to Render**
   - Push code to GitHub
   - Connect repository on render.com
   - Set environment variables in Render dashboard
   - Attach persistent disk for /app/data
   - Deploy!

5. **Set Up Keep-Alive**
   - Create account at cron-job.org
   - Add cron job to ping: https://your-app.onrender.com/health
   - Interval: Every 10 minutes

### Testing Checklist

Before deploying, verify:
- [ ] `npm install` completes without errors
- [ ] `.env` file is properly configured
- [ ] `npm start` launches successfully
- [ ] WhatsApp QR code appears and can be scanned
- [ ] First scrape cycle completes
- [ ] At least one notification received (Email or WhatsApp)
- [ ] Health endpoint accessible: http://localhost:3000/health
- [ ] Status endpoint shows stats: http://localhost:3000/status
- [ ] Logs appear in logs/combined.log

### Known Limitations (MVP)

1. **Scraper Fragility**: Job boards may change their HTML structure
   - Solution: Monitor error logs and update selectors as needed
   - Some scrapers may fail silently - check logs regularly

2. **WhatsApp Session**: Requires QR scan on every deployment
   - On Render: First deployment requires QR scan via logs
   - Session persists if disk is mounted correctly
   - May disconnect after long idle periods

3. **Rate Limiting**: Aggressive scraping may get IP blocked
   - Current delays: 3-10 seconds between requests
   - If blocked, increase delays or add proxies

4. **Salary Not Disclosed**: Many jobs don't list salary
   - Agent still notifies but flags as "Salary not disclosed"
   - Manual verification needed

5. **LinkedIn Excluded**: Manual checks required
   - Too risky to scrape with free account
   - Check LinkedIn separately for now

### Monitoring in Production

Once deployed to Render:

1. **Check Logs**
   - Render Dashboard → Your Service → Logs
   - Look for "Scrape cycle completed" messages
   - Monitor for errors

2. **Health Check**
   - Visit: https://your-app.onrender.com/health
   - Should return JSON with status: "healthy"

3. **Stats**
   - Visit: https://your-app.onrender.com/status
   - Shows recent scrapes, jobs found, notification status

4. **Database**
   - Jobs stored in /app/data/jobs.db
   - Accessible via disk mount or export endpoint (future)

### Future Enhancements (Post-MVP)

Priority order based on impact:

1. **Add More Scrapers** (High Impact)
   - IIMJobs (targets MBA grads, good for PM roles)
   - Cutshort (verified startups)
   - LinkedIn (with separate throwaway account)

2. **Daily Digest Email** (Medium Impact)
   - Compile jobs with score 40-59
   - Send once daily at 9 AM IST
   - Reduces notification fatigue

3. **Telegram Bot** (Low Effort, Medium Impact)
   - Alternative to WhatsApp (more reliable on Render)
   - No session persistence issues
   - Easy to set up

4. **Career Page Scrapers** (High Impact for Watchlist)
   - Greenhouse/Lever ATS boards
   - Company-specific career pages
   - Targeted for high-priority companies

5. **Proxy Rotation** (Medium Impact)
   - Avoid IP blocks
   - Use free proxy lists or residential proxies
   - Improve scraping reliability

6. **Fuzzy Company Matching** (Low Impact)
   - Match "Google" with "Google India", "Google Inc."
   - Improve watchlist hit rate

7. **Job Application Tracking** (Future)
   - Mark jobs as applied/rejected
   - Track application status
   - Interview scheduling reminders

---

Last Updated: 2026-02-06 (MVP Completed)
