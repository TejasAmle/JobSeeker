# 🎯 Claude Code Agent Prompt: Job Hunter Agent for Tejas

> **Copy-paste this entire prompt into Claude Code to build the complete agent.**

---

## PROMPT START

You are building a **production-grade, autonomous Job Hunter Agent** that runs 24/7 on Railway/Render and finds Product Management jobs for Tejas. This agent scrapes multiple platforms, monitors LinkedIn posts, processes a company watchlist from an Excel file, deduplicates results, and sends instant notifications via Email, WhatsApp, and Telegram.

Read every section carefully. Do NOT skip any section. Do NOT assume defaults — follow every specification exactly.

---

### 👤 CANDIDATE PROFILE

```
Name: Tejas
Experience: 4+ years in Product Management
Current Role: Product Manager at LambdaTest (B2B SaaS, Developer Tools)
Key Skills: B2B Platform Products, $10M+ ARR products, 100K+ customer scale,
            Device Testing Infrastructure, AI-powered features, SQL, Amplitude,
            Accessibility Testing, Mobile/Web Testing Platforms
Domain: Open to any domain — not limited to B2B SaaS
WhatsApp: +91 9910282204
Gmail: tejas.amle71@gmail.com
Telegram Chat ID: [TEJAS_TO_FILL_CHAT_ID_HERE]
Telegram Bot Token: [TEJAS_TO_FILL_BOT_TOKEN_HERE]
```

---

### 🎯 JOB SEARCH CRITERIA

**Roles to match (ANY of these):**
- Product Manager (Senior / Lead / Principal)
- Senior Product Manager
- Lead Product Manager
- Group Product Manager
- Director of Product
- Platform PM / Infrastructure PM
- Product Manager (any specialization) — as long as comp matches

**Compensation:**
- Minimum: ₹25 LPA (or equivalent ~$30K+ USD for remote/global roles)
- If salary is not listed, still include the job but flag it as "Salary not disclosed — verify manually"

**Location preferences (in priority order):**
1. Bangalore, Delhi/NCR, Mumbai (highest priority)
2. Any other Indian city
3. Remote-friendly roles (India-eligible)
4. Global remote roles (if compensation meets threshold)

**Experience filter:**
- Target roles asking for 3-7 years experience
- Include roles asking for up to 8 years (stretch roles)
- Exclude roles explicitly requiring 10+ years
- Exclude VP-level or C-level roles

**Exclude:**
- Internships, Associate PM, Junior PM, APM programs
- Roles requiring mandatory relocation outside India (unless remote-friendly)
- Roles from known spam/fake job posters (build a blocklist over time)

---

### 🌐 PLATFORMS TO SCRAPE

Build a **modular scraper system** where each platform is a separate module. This makes it easy to add/remove platforms later.

#### Tier 1 — Job Boards (scrape every 30 minutes):
| Platform | URL | Method |
|----------|-----|--------|
| LinkedIn Jobs | linkedin.com/jobs | Use LinkedIn job search API/scraping. Search queries: "Product Manager", "Senior Product Manager", "Platform PM", "Lead PM" filtered to India + Remote |
| Naukri | naukri.com | Scrape search results for PM roles 25LPA+ |
| Instahyre | instahyre.com | Scrape/API for PM roles |
| IIMJobs | iimjobs.com | Scrape PM roles with salary filter |
| Cutshort | cutshort.io | API/scrape for PM roles |
| Wellfound (AngelList) | wellfound.com | Scrape startup PM roles |

#### Tier 2 — ATS & Career Pages (scrape every 2 hours):
| Platform | URL | Method |
|----------|-----|--------|
| Greenhouse boards | boards.greenhouse.io/* | Scrape career pages of companies from the Excel watchlist |
| Lever boards | jobs.lever.co/* | Same as above |
| Workday | *.myworkday.com | Scrape career pages from watchlist companies |
| Ashby | jobs.ashbyhq.com/* | Scrape from watchlist |
| Company career pages | Various | Use URLs from Excel watchlist |

#### Tier 3 — LinkedIn Post Monitoring (scrape every 1 hour):
| Source | What to monitor |
|--------|----------------|
| LinkedIn Feed Posts | Monitor posts containing keywords: "hiring PM", "hiring product manager", "looking for PM", "PM opening", "product role", "we're hiring", "DM me", "join my team", "product manager opening", "senior PM", "lead PM" |
| LinkedIn Recruiter Posts | Monitor posts from recruiters/founders in India who post casual hiring updates |
| LinkedIn Company Pages | Monitor job posts from watchlist companies' LinkedIn pages |

**IMPORTANT LinkedIn scraping notes:**
- Tejas has a FREE LinkedIn account (no Sales Navigator)
- Use rotating proxies and rate limiting to avoid detection
- Use libraries like `linkedin-api` (unofficial) or browser automation with `playwright`/`puppeteer`
- Implement exponential backoff on rate limits
- LinkedIn post monitoring should search for posts in the last 24 hours matching hiring keywords
- Cache LinkedIn session cookies securely

#### Tier 4 — Aggregators (scrape every 4 hours):
| Platform | Method |
|----------|--------|
| Google Jobs | Search "Product Manager India 25 LPA" on Google Jobs |
| Indeed India | indeed.co.in scrape |
| Glassdoor | glassdoor.co.in job listings |
| Hired | hired.com (if available in India) |
| TopHire | tophire.co |
| YCombinator Jobs | workatastartup.com |

---

### 📊 EXCEL WATCHLIST — COMPANY LIST

The agent must read from a local Excel file (`companies_watchlist.xlsx`) that Tejas will upload.

**Expected Excel format:**
| Column | Description | Required |
|--------|-------------|----------|
| Company Name | e.g., "Gartner", "Nike" | Yes |
| Career Page URL | Direct link to careers page | Optional |
| Greenhouse/Lever/ATS URL | ATS board URL if known | Optional |
| LinkedIn Company URL | e.g., linkedin.com/company/gartner | Optional |
| Priority | "High" / "Medium" / "Low" | Optional (default: Medium) |
| Notes | Any notes | Optional |

**Agent behavior with watchlist:**
1. On startup, read the Excel file and build a company registry
2. For companies WITH career page URLs — scrape those directly
3. For companies WITHOUT URLs — attempt to discover career pages via Google search (`"{company name}" careers site`)
4. For ALL companies — also search them on LinkedIn Jobs, Naukri, etc.
5. High-priority companies should trigger an immediate notification even for borderline matches
6. The watchlist is NOT exhaustive — the agent should find jobs from ANY company meeting the criteria, not just watchlist companies
7. Support hot-reloading: if the Excel file is updated, pick up changes without restart
8. Store discovered career page URLs back to a JSON cache so we don't re-discover them

---

### 🧠 JOB MATCHING & RELEVANCE SCORING

Implement a scoring system to rank job relevance:

```
SCORING RUBRIC (out of 100):

Title Match (0-30 points):
  - Exact "Senior Product Manager" / "Lead PM" → 30
  - "Product Manager" (generic) → 25
  - "Group PM" / "Director of Product" → 20
  - Related roles ("Technical PM", "Platform PM") → 20
  - Vague titles ("Product Lead", "Product Owner") → 10

Compensation Match (0-25 points):
  - Confirmed ≥ 30 LPA → 25
  - Confirmed 25-30 LPA → 20
  - Salary not disclosed but company is known to pay well → 15
  - Salary not disclosed, unknown company → 5

Location Match (0-20 points):
  - Bangalore / Delhi / Mumbai → 20
  - Other Indian city → 15
  - Remote (India eligible) → 18
  - Global remote → 10

Experience Fit (0-15 points):
  - Asks for 3-5 years → 15
  - Asks for 4-7 years → 15
  - Asks for 5-8 years → 10
  - Asks for 2-3 years → 5

Company Watchlist Bonus (0-10 points):
  - High priority company → 10
  - Medium priority → 5
  - Low priority → 3
  - Not on watchlist → 0

THRESHOLDS:
  - Score ≥ 60 → Send notification immediately
  - Score 40-59 → Include in daily digest email
  - Score < 40 → Log but don't notify
```

---

### 🔔 NOTIFICATION SYSTEM

The agent sends notifications via THREE channels. All three should be attempted for every qualifying job (score ≥ 60).

#### Channel 1: Email (Primary — Most Reliable)

```
Provider: Gmail SMTP (free)
Requires: Gmail App Password (NOT regular password)
Library: nodemailer (Node.js) or smtplib (Python)

Setup instructions for Tejas:
1. Go to myaccount.google.com → Security → 2-Step Verification (enable it)
2. Go to myaccount.google.com → Security → App Passwords
3. Generate an app password for "Mail"
4. Save as env var: GMAIL_APP_PASSWORD

Email format:
- FROM: Tejas's own Gmail (so it appears in Sent)
- TO: Tejas's Gmail
- SUBJECT: "🎯 [Score: XX] {Job Title} @ {Company} — {Location}"
- BODY: (see notification template below)
```

#### Channel 2: WhatsApp (via whatsapp-web.js — Free but Fragile)

```
Library: whatsapp-web.js
WhatsApp Number: +91 9910282204

Setup:
1. On first run, generate QR code in terminal
2. Tejas scans QR with WhatsApp (Link a Device)
3. Session persists in .wwebjs_auth/ directory
4. Send messages to self (Tejas's own number)

IMPORTANT stability measures:
- Implement session persistence (LocalAuth strategy)
- Auto-reconnect on disconnect with exponential backoff
- Health check every 5 minutes — if WhatsApp is disconnected, log warning + rely on Email/Telegram
- Rate limit: Max 1 message per 30 seconds to avoid ban
- If WhatsApp fails for 3+ consecutive attempts, disable it and alert via Email/Telegram
- NEVER send more than 50 WhatsApp messages per day (self-imposed limit to avoid ban)

WhatsApp message format (keep SHORT — WhatsApp has character limits):
```
🎯 *{Job Title}* @ *{Company}*
📍 {Location} | 💰 {Salary/CTC}
⭐ Match Score: {score}/100
🔗 {apply_link}
📅 Posted: {date}
```
```

#### Channel 3: Telegram Bot (Backup — Most Reliable Free Option)

```
Setup instructions for Tejas:
1. Open Telegram → Search @BotFather
2. Send /newbot → Name it "Tejas Job Hunter"
3. Copy the Bot Token → Save as env var: TELEGRAM_BOT_TOKEN
4. Send a message to your new bot
5. Visit: https://api.telegram.org/bot{TOKEN}/getUpdates
6. Copy your chat_id → Save as env var: TELEGRAM_CHAT_ID

Library: node-telegram-bot-api or python-telegram-bot

Telegram message format (supports Markdown):
```
🎯 *{Job Title}* @ *{Company}*

📍 Location: {Location}
💰 CTC: {Salary}
📊 Match Score: {score}/100
🏢 Source: {platform}
📅 Posted: {date}

🔗 [Apply Here]({apply_link})

{If watchlist company: "⭐ WATCHLIST COMPANY — {priority} priority"}
{If salary not disclosed: "⚠️ Salary not disclosed — verify manually"}
```
```

#### Notification Template (Full — for Email):

```html
Subject: 🎯 [Score: {score}] {title} @ {company} — {location}

Hi Tejas,

New PM role found that matches your criteria:

━━━━━━━━━━━━━━━━━━━━━━━
🏢 Company: {company}
💼 Role: {title}
📍 Location: {location}
💰 CTC: {salary or "Not disclosed"}
📊 Match Score: {score}/100
🏷️ Source: {platform_name}
📅 Posted: {posted_date}
🔗 Apply: {direct_link}
━━━━━━━━━━━━━━━━━━━━━━━

Job Description Summary:
{First 300 chars of JD}

Why this matched:
- {reason_1: e.g., "Title exact match: Senior PM"}
- {reason_2: e.g., "Location: Bangalore (preferred)"}
- {reason_3: e.g., "Watchlist company: High priority"}

━━━━━━━━━━━━━━━━━━━━━━━
This is an automated alert from your Job Hunter Agent.
To stop notifications, set AGENT_ENABLED=false in your environment.
```

#### Daily Digest Email (for score 40-59 jobs):

Send once daily at 9:00 AM IST. Compile all medium-score jobs found in the last 24 hours into a single email with a table format.

---

### 🗃️ DATABASE & DEDUPLICATION

Use **SQLite** (file-based, zero config, perfect for Railway/Render).

```sql
-- Core tables
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,  -- hash of (company + title + location + source)
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT,
    salary TEXT,
    salary_numeric INTEGER,  -- parsed salary in LPA for filtering
    source_platform TEXT NOT NULL,
    source_url TEXT NOT NULL,
    apply_url TEXT,
    description TEXT,
    posted_date TEXT,
    discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    relevance_score INTEGER,
    notified BOOLEAN DEFAULT FALSE,
    notification_channels TEXT,  -- JSON array: ["email", "whatsapp", "telegram"]
    status TEXT DEFAULT 'new'  -- new, notified, applied, rejected, expired
);

CREATE TABLE scrape_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    scrape_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    jobs_found INTEGER,
    new_jobs INTEGER,
    errors TEXT,
    duration_seconds REAL
);

CREATE TABLE company_watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    career_url TEXT,
    ats_url TEXT,
    linkedin_url TEXT,
    priority TEXT DEFAULT 'Medium',
    notes TEXT,
    last_scraped DATETIME
);

CREATE TABLE blocked_companies (
    company_name TEXT PRIMARY KEY,
    reason TEXT,
    blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Deduplication logic:**
- Generate a job ID by hashing: `SHA256(company_lower + title_lower + location_lower)`
- Before sending any notification, check if job ID exists in DB
- If it exists AND was found in the last 7 days → skip (duplicate)
- If it exists but was found 30+ days ago → treat as re-posted, notify again
- Also do fuzzy matching: if title has >85% similarity (Levenshtein) to an existing job at same company → likely duplicate

---

### 🏗️ PROJECT STRUCTURE

```
job-hunter-agent/
├── package.json (or requirements.txt for Python)
├── .env.example              # Template for env vars
├── .env                      # Actual env vars (gitignored)
├── Dockerfile                # For Railway/Render deployment
├── railway.json              # Railway config (if using Railway)
├── render.yaml               # Render config (if using Render)
│
├── src/
│   ├── index.js              # Main entry point + scheduler
│   ├── config.js             # All configuration, env vars, constants
│   │
│   ├── scrapers/             # Modular scraper system
│   │   ├── base-scraper.js   # Abstract base class with common logic
│   │   ├── linkedin-jobs.js
│   │   ├── linkedin-posts.js # Casual "we're hiring" post monitor
│   │   ├── naukri.js
│   │   ├── instahyre.js
│   │   ├── iimjobs.js
│   │   ├── cutshort.js
│   │   ├── wellfound.js
│   │   ├── greenhouse.js     # Generic Greenhouse board scraper
│   │   ├── lever.js          # Generic Lever board scraper
│   │   ├── workday.js
│   │   ├── google-jobs.js
│   │   ├── indeed.js
│   │   ├── ycombinator.js
│   │   └── career-page.js    # Generic career page scraper
│   │
│   ├── matching/
│   │   ├── scorer.js         # Relevance scoring engine
│   │   ├── salary-parser.js  # Parse salary strings to numeric LPA
│   │   └── dedup.js          # Deduplication logic
│   │
│   ├── notifications/
│   │   ├── email.js          # Gmail SMTP sender
│   │   ├── whatsapp.js       # whatsapp-web.js integration
│   │   ├── telegram.js       # Telegram bot sender
│   │   └── digest.js         # Daily digest compiler
│   │
│   ├── data/
│   │   ├── watchlist.js      # Excel file reader + hot-reload
│   │   └── db.js             # SQLite database layer
│   │
│   └── utils/
│       ├── proxy.js          # Proxy rotation for scraping
│       ├── rate-limiter.js   # Per-platform rate limiting
│       ├── logger.js         # Structured logging
│       └── health-check.js   # Self-monitoring + alerts
│
├── data/
│   ├── companies_watchlist.xlsx   # Tejas uploads this
│   ├── jobs.db                     # SQLite database
│   └── career-urls-cache.json      # Discovered career page URLs
│
└── logs/
    └── agent.log
```

---

### ⚙️ ENVIRONMENT VARIABLES

Create a `.env.example` file:

```env
# === Agent Config ===
AGENT_ENABLED=true
NODE_ENV=production
LOG_LEVEL=info

# === Gmail ===
GMAIL_ADDRESS=[TEJAS_TO_FILL]
GMAIL_APP_PASSWORD=[TEJAS_TO_FILL]

# === WhatsApp ===
WHATSAPP_ENABLED=true
WHATSAPP_NUMBER=919910282204

# === Telegram ===
TELEGRAM_BOT_TOKEN=[TEJAS_TO_FILL]
TELEGRAM_CHAT_ID=[TEJAS_TO_FILL]

# === LinkedIn (free account) ===
LINKEDIN_EMAIL=[TEJAS_TO_FILL]
LINKEDIN_PASSWORD=[TEJAS_TO_FILL]

# === Proxy (optional but recommended) ===
PROXY_LIST=  # comma-separated proxy URLs
PROXY_ROTATION=round-robin  # or random

# === Scraping Intervals (in minutes) ===
INTERVAL_TIER1=30
INTERVAL_TIER2=120
INTERVAL_TIER3=60
INTERVAL_TIER4=240
DIGEST_TIME=09:00  # IST, 24hr format

# === Scoring Thresholds ===
NOTIFY_THRESHOLD=60
DIGEST_THRESHOLD=40
```

---

### 🚀 DEPLOYMENT — Railway/Render

**For Railway:**
```json
// railway.json
{
  "build": { "builder": "DOCKERFILE" },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Dockerfile:**
```dockerfile
FROM node:20-slim

# Install Chromium for Playwright/Puppeteer (needed for LinkedIn + WhatsApp)
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .

# Persist SQLite DB and WhatsApp session
VOLUME ["/app/data", "/app/.wwebjs_auth"]

CMD ["node", "src/index.js"]
```

**IMPORTANT deployment notes:**
- Railway free tier gives 500 hours/month — agent needs ~720 hours → Use Railway's Hobby plan ($5/month) OR Render free tier with cron workaround
- For WhatsApp session persistence, use Railway volumes or Render persistent disks
- Set up health check endpoint (HTTP on port 3000) so Railway/Render knows the agent is alive
- Add a `/status` endpoint that returns JSON with: last scrape times, jobs found today, notification status, WhatsApp connection status

---

### 🛡️ ERROR HANDLING & RESILIENCE

1. **Per-scraper isolation**: If one scraper crashes, others continue. Wrap each scraper in try-catch.
2. **Retry logic**: 3 retries with exponential backoff (1s, 5s, 15s) for network errors.
3. **Circuit breaker**: If a platform fails 5 consecutive times, disable it for 1 hour, then retry.
4. **Rate limiting**: Respect per-platform limits. LinkedIn is the most sensitive — max 50 requests/hour.
5. **Proxy rotation**: If proxies are configured, rotate per request. If a proxy fails, mark it dead for 10 minutes.
6. **Self-monitoring**: If the agent hasn't found any jobs in 12 hours, send an alert: "⚠️ Job Hunter Agent: No jobs found in 12 hours. Possible scraping issue."
7. **Graceful shutdown**: On SIGTERM, finish current scrape cycle, flush DB, then exit.
8. **Memory management**: Clear browser instances after each scrape cycle. Log memory usage.
9. **WhatsApp recovery**: If WhatsApp disconnects, send Telegram + Email alert: "WhatsApp disconnected. Please re-scan QR code at {health_check_url}."

---

### 📋 SCHEDULER

Use `node-cron` or `APScheduler` (Python):

```
Every 30 min  → Tier 1 scrapers (LinkedIn Jobs, Naukri, Instahyre, IIMJobs, Cutshort, Wellfound)
Every 1 hour  → Tier 3 (LinkedIn post monitoring)
Every 2 hours → Tier 2 scrapers (Greenhouse, Lever, Workday, career pages from watchlist)
Every 4 hours → Tier 4 scrapers (Google Jobs, Indeed, YCombinator)
Every 24 hrs  → Daily digest email (9:00 AM IST)
Every 5 min   → Health check (WhatsApp connection, DB size, memory)
Every 6 hours → Watchlist Excel hot-reload check
```

---

### 🔧 IMPLEMENTATION PRIORITIES

Build in this exact order:

```
Phase 1 — Foundation (build first):
  ✅ Project scaffolding + config
  ✅ SQLite database setup
  ✅ Email notification (Gmail SMTP)
  ✅ Telegram bot notification
  ✅ Basic scoring engine
  ✅ Deduplication

Phase 2 — Core Scrapers:
  ✅ LinkedIn Jobs scraper
  ✅ Naukri scraper
  ✅ Instahyre scraper
  ✅ Greenhouse generic scraper
  ✅ Company watchlist Excel reader

Phase 3 — Extended Scrapers:
  ✅ LinkedIn post monitor ("we're hiring" posts)
  ✅ IIMJobs, Cutshort, Wellfound
  ✅ Lever, Workday scrapers
  ✅ Google Jobs, Indeed

Phase 4 — WhatsApp + Polish:
  ✅ WhatsApp integration (whatsapp-web.js)
  ✅ Daily digest email
  ✅ Health check endpoint
  ✅ Dockerfile + Railway/Render deploy config
  ✅ Hot-reload for Excel watchlist

Phase 5 — Hardening:
  ✅ Proxy rotation
  ✅ Circuit breaker pattern
  ✅ Self-monitoring alerts
  ✅ Fuzzy dedup
  ✅ Salary parser for various formats
```

---

### ⚠️ CRITICAL CONSTRAINTS — DO NOT IGNORE

1. **Language**: Use Node.js (JavaScript) — better ecosystem for whatsapp-web.js, puppeteer, and web scraping. Use Python only if a specific scraper absolutely requires it (in which case, call it as a subprocess).

2. **No paid APIs**: Do not use any paid scraping APIs (Proxycurl, PhantomBuster, etc.). Use open-source libraries and direct HTTP/browser automation only.

3. **LinkedIn caution**: LinkedIn is aggressive with bot detection. The agent MUST:
   - Use realistic request intervals (random 3-10 second delays)
   - Rotate User-Agent strings
   - Use headless browser with stealth plugins (`puppeteer-extra-plugin-stealth`)
   - Never exceed 50 job searches per hour
   - Cache results aggressively to minimize requests

4. **Salary parsing**: Indian job sites express salary in many formats. Handle ALL of these:
   - "₹25,00,000 - ₹35,00,000" → 25-35 LPA
   - "25-35 LPA" → 25-35 LPA
   - "₹25L - ₹35L" → 25-35 LPA
   - "2500000" → 25 LPA
   - "$30,000 - $50,000 USD" → Convert to LPA (~25-40 LPA)
   - "Not disclosed" → Flag accordingly
   - "Competitive" → Treat as unknown

5. **Timezone**: All times in IST (Asia/Kolkata). Store timestamps in UTC internally, display in IST.

6. **Security**: 
   - Never commit `.env` or credentials to git
   - Encrypt LinkedIn cookies at rest
   - WhatsApp session data in `.wwebjs_auth/` should be in gitignore
   - Use environment variables for ALL secrets

7. **Logging**: Use structured JSON logging. Every scrape cycle should log: platform, jobs_found, new_jobs, errors, duration.

8. **Idempotency**: The agent should be safe to restart at any time. No duplicate notifications on restart.

9. **Graceful degradation**: If LinkedIn is blocked → other scrapers continue. If WhatsApp dies → Email + Telegram continue. If Email fails → Telegram continues. NEVER let one failure cascade to others.

10. **Excel file**: The agent must handle:
    - File not found → Log warning, continue scraping other platforms
    - Malformed data → Skip bad rows, process good ones
    - Empty file → Log info, rely on keyword-based scraping only

---

### 🧪 TESTING

Before deploying, verify:

```
□ Email notification sends successfully
□ Telegram message sends successfully  
□ WhatsApp QR code generates and session persists
□ LinkedIn Jobs returns results for "Senior Product Manager India"
□ Naukri scraper returns results
□ SQLite DB creates tables and stores jobs
□ Deduplication prevents duplicate notifications
□ Scoring engine correctly scores a sample job
□ Salary parser handles "25-35 LPA", "₹25,00,000", "$30,000 USD"
□ Watchlist Excel reader loads companies correctly
□ Health check endpoint returns status JSON
□ Agent recovers from a simulated crash (kill + restart)
□ Daily digest email compiles correctly
```

---

### 🏁 FIRST RUN INSTRUCTIONS FOR TEJAS

After the agent is built, Tejas needs to:

```
1. Fill in .env file:
   - GMAIL_ADDRESS=your@gmail.com
   - GMAIL_APP_PASSWORD=(generate at myaccount.google.com → App Passwords)
   - LINKEDIN_EMAIL=your LinkedIn email
   - LINKEDIN_PASSWORD=your LinkedIn password
   - TELEGRAM_BOT_TOKEN=(from @BotFather)
   - TELEGRAM_CHAT_ID=(from getUpdates API call)

2. Upload companies_watchlist.xlsx to data/ folder

3. Run locally first:
   npm install
   node src/index.js
   → Scan WhatsApp QR code when prompted
   → Verify first notifications arrive

4. Deploy to Railway:
   railway login
   railway init
   railway up
   → Set env vars in Railway dashboard
   → Attach volume for /app/data and /app/.wwebjs_auth
```

---

## PROMPT END

---

### 📝 NOTES FOR CLAUDE CODE

- Build the ENTIRE project end to end. Do not stop midway.
- Follow the phased implementation order exactly.
- Test each phase before moving to the next.
- If any platform's scraping approach doesn't work, find an alternative and document what you tried.
- After building, provide a README.md with setup instructions.
- Ask Tejas to fill in placeholders marked with `[TEJAS_TO_FILL]` before deploying.