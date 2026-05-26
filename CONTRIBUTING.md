# Contributing to JobSeeker

Thanks for your interest in contributing! This guide covers everything you need to get the Job Hunter Agent running locally and make your first contribution.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Project Structure](#project-structure)
- [Running the Agent](#running-the-agent)
- [How to Add a New Job Board Scraper](#how-to-add-a-new-job-board-scraper)
- [How to Add a New Notification Channel](#how-to-add-a-new-notification-channel)
- [Code Style](#code-style)
- [Pull Request Checklist](#pull-request-checklist)

---

## Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 9
- A **Gmail account** (for email notifications)
- Optional: WhatsApp account (for WhatsApp notifications)

---

## Local Setup

```bash
# 1. Fork and clone the repo
git clone https://github.com/<your-username>/JobSeeker.git
cd JobSeeker

# 2. Install dependencies
npm install

# 3. Copy and configure environment variables
cp .env.example .env
# Edit .env and fill in at minimum:
#   GMAIL_ADDRESS, GMAIL_APP_PASSWORD

# 4. (Optional) Add companies to the watchlist
# Edit companies_watchlist.xlsx — any company listed here gets a score boost

# 5. Run in development mode
node src/index.js
```

---

## Project Structure

```
JobSeeker/
├── src/
│   ├── index.js              # Entry point — starts scheduler, HTTP server
│   ├── scrapers/             # One file per job board
│   │   ├── naukri.js         # Naukri scraper
│   │   ├── instahyre.js      # Instahyre scraper
│   │   └── wellfound.js      # Wellfound (AngelList) scraper
│   ├── scorer.js             # Job relevance scoring (title, salary, location…)
│   ├── dedup.js              # Hash + fuzzy duplicate detection
│   ├── notifiers/            # One file per notification channel
│   │   ├── email.js          # Gmail notifier
│   │   └── whatsapp.js       # WhatsApp notifier
│   ├── db.js                 # SQLite database layer (jobs, logs, notifications)
│   ├── watchlist.js          # Excel-based company watchlist with hot-reload
│   └── health.js             # HTTP health-check endpoints
├── .env.example              # Environment variable template
├── companies_watchlist.xlsx  # Company watchlist (Excel)
├── Dockerfile                # Container setup
└── render.yaml               # Render.com deployment config
```

---

## Running the Agent

```bash
# Start the agent (scrapes every SCRAPE_INTERVAL_MINUTES, default 30)
node src/index.js

# Check health status (once the agent is running)
curl http://localhost:3000/health
curl http://localhost:3000/status
```

The agent will:
1. Scrape all enabled job boards
2. Score each job
3. Deduplicate against the SQLite database
4. Send notifications for jobs above `NOTIFY_THRESHOLD` (default: 60)

---

## How to Add a New Job Board Scraper

1. **Create a new file** in `src/scrapers/`:

```js
// src/scrapers/linkedin.js

/**
 * LinkedIn Job Scraper
 * @returns {Promise<Job[]>} Array of normalized job objects
 */
export async function scrapeLinkedIn() {
  const jobs = [];

  // Fetch and parse job listings...

  return jobs.map(raw => ({
    title: raw.title,
    company: raw.companyName,
    location: raw.location,
    salary: null,          // parse if available
    url: raw.applyUrl,
    source: 'linkedin',
    postedAt: new Date(raw.postedDate),
  }));
}
```

2. **Register the scraper** in `src/index.js`:

```js
import { scrapeLinkedIn } from './scrapers/linkedin.js';

// Add to the scrapers array:
const scrapers = [scrapeNaukri, scrapeInstahyre, scrapeWellfound, scrapeLinkedIn];
```

3. **Add an enable/disable env variable** in `.env.example`:

```env
LINKEDIN_ENABLED=true
```

---

## How to Add a New Notification Channel

1. **Create a notifier** in `src/notifiers/`:

```js
// src/notifiers/telegram.js

export async function sendTelegramNotification(job) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const text = `🎯 *${job.title}* — ${job.company}\n💰 ${job.salary ?? 'N/A'}\n🔗 ${job.url}`;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' }),
  });
}
```

2. **Add env vars** to `.env.example`:

```env
TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

---

## Code Style

- Use **ES modules** (`import`/`export`)
- Prefer `async/await` over raw Promises
- Keep scrapers stateless — no side effects other than returning job arrays
- Log with `console.log` / `console.error` (the agent uses `LOG_LEVEL` env var)

---

## Pull Request Checklist

Before opening a PR:

- [ ] `node src/index.js` starts without errors with a minimal `.env`
- [ ] New scrapers return jobs in the normalized `Job` shape
- [ ] New env vars are documented in `.env.example`
- [ ] No secrets or API keys committed
- [ ] PR description explains _what_ changed and _why_
- [ ] Branch is up to date with `main`

---

## Questions?

Open a [GitHub Issue](https://github.com/TejasAmle/JobSeeker/issues) — happy to help!
