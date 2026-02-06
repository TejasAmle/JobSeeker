# 🎯 Job Hunter Agent

Autonomous job search agent that scrapes multiple job boards for Product Manager roles, scores them based on relevance, and sends instant notifications via Email and WhatsApp.

## ✨ Features

- **Multi-Platform Scraping**: Scrapes Naukri, Instahyre, and Wellfound (AngelList)
- **Intelligent Scoring**: Ranks jobs based on title, salary, location, experience fit, and company watchlist
- **Smart Deduplication**: Prevents duplicate notifications using hash-based and fuzzy matching
- **Multi-Channel Notifications**: Email (Gmail) and WhatsApp notifications for high-scoring matches
- **Company Watchlist**: Excel-based watchlist with hot-reload support
- **Salary Parser**: Handles various Indian salary formats (₹25L, 25 LPA, $30K USD, etc.)
- **SQLite Database**: Tracks all jobs, scrape logs, and notification history
- **Health Monitoring**: HTTP endpoints for health checks and status (essential for Render free tier)
- **Automated Scheduling**: Scrapes every 30 minutes (configurable)

## 📋 Prerequisites

- Node.js 20+ installed
- Gmail account for email notifications
- WhatsApp account for WhatsApp notifications (optional)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Then edit `.env` and fill in your credentials:

```env
# Gmail Configuration (Required)
GMAIL_ADDRESS=your_email@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password

# WhatsApp (Optional)
WHATSAPP_ENABLED=true
WHATSAPP_NUMBER=your_whatsapp_number_with_country_code

# Other settings (defaults are fine)
AGENT_ENABLED=true
NODE_ENV=development
LOG_LEVEL=info
PORT=3000
SCRAPE_INTERVAL_MINUTES=30
NOTIFY_THRESHOLD=60
MIN_SALARY_LPA=25
```

### 3. Get Gmail App Password

1. Go to [myaccount.google.com](https://myaccount.google.com)
2. Navigate to **Security** → **2-Step Verification** (enable it if not already)
3. Go to **Security** → **App Passwords**
4. Generate an app password for "Mail"
5. Copy the 16-character password and paste it into `.env` as `GMAIL_APP_PASSWORD`

### 4. Run the Agent

```bash
npm start
```

### 5. Scan WhatsApp QR Code (if enabled)

When the agent starts, a QR code will appear in the terminal. Open WhatsApp on your phone:

1. Go to **Settings** → **Linked Devices**
2. Tap **Link a Device**
3. Scan the QR code displayed in the terminal

Once connected, WhatsApp notifications will work automatically.

## 📊 Monitoring

Once the agent is running, you can monitor it at:

- **Health Check**: http://localhost:3000/health
- **Detailed Status**: http://localhost:3000/status
- **Logs**: `logs/combined.log` and `logs/error.log`

## 🎯 How It Works

### 1. Job Scraping

The agent scrapes the following platforms every 30 minutes:

- **Naukri**: Product Manager roles in Bangalore, Delhi, Mumbai
- **Instahyre**: Senior PM and Lead PM roles
- **Wellfound**: Startup PM roles

### 2. Job Scoring

Each job is scored out of 100 based on:

- **Title Match** (30 points): "Senior Product Manager" = 30, "Product Manager" = 25
- **Compensation** (25 points): ≥30 LPA = 25, 25-30 LPA = 20
- **Location** (20 points): Bangalore/Delhi/Mumbai = 20, Remote = 18
- **Experience Fit** (15 points): 3-7 years = 15
- **Watchlist Bonus** (10 points): High priority company = 10

### 3. Notification Rules

- **Score ≥ 60**: Immediate notification via Email + WhatsApp
- **Score 40-59**: Included in daily digest (future feature)
- **Score < 40**: Logged only, no notification

### 4. Deduplication

- Jobs are deduplicated based on hash of (company + title + location)
- Fuzzy matching prevents similar jobs from triggering multiple notifications
- Jobs reposted after 30+ days are treated as new

## 📁 Company Watchlist

Place an Excel file named `companies_watchlist.xlsx` in the root directory with these columns:

| Column | Description | Required |
|--------|-------------|----------|
| Company Name | e.g., "Gartner", "Nike" | Yes |
| Career Page URL | Direct link to careers page | Optional |
| Greenhouse/Lever/ATS URL | ATS board URL if known | Optional |
| LinkedIn Company URL | e.g., linkedin.com/company/gartner | Optional |
| Priority | "High" / "Medium" / "Low" | Optional |
| Notes | Any notes | Optional |

The watchlist is checked for updates every 6 hours and hot-reloaded automatically.

## 🐳 Deployment to Render (Free)

### Option 1: Using Render Dashboard

1. Create account at [render.com](https://render.com)
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Set build command: (leave empty, uses Dockerfile)
5. Set start command: (leave empty, uses Dockerfile CMD)
6. Add environment variables from `.env`
7. Add a **Persistent Disk**:
   - Name: data-disk
   - Mount Path: /app/data
   - Size: 1GB
8. Deploy!

### Option 2: Using render.yaml

The repository includes `render.yaml` for Infrastructure as Code deployment:

```bash
# Push to GitHub first
git add .
git commit -m "Initial commit"
git push

# Then deploy via Render dashboard by connecting the repo
```

### Keep-Alive Strategy (Render Free Tier)

Render free tier spins down after 15 minutes of inactivity. To keep it alive:

1. Use [cron-job.org](https://cron-job.org) (free)
2. Create a new cron job to ping: `https://your-app.onrender.com/health`
3. Set interval: Every 10 minutes
4. This will keep your service alive 24/7

## 📈 Database Structure

The agent uses SQLite with the following tables:

- **jobs**: All discovered jobs with scores and notification status
- **scrape_logs**: Logs of each scrape cycle
- **company_watchlist**: Companies from Excel watchlist
- **blocked_companies**: Companies to exclude (spam/fake posters)

## 🔧 Configuration

Key environment variables:

```env
SCRAPE_INTERVAL_MINUTES=30     # How often to scrape (default: 30)
NOTIFY_THRESHOLD=60             # Minimum score for notifications (default: 60)
MIN_SALARY_LPA=25               # Minimum salary filter (default: 25)
WHATSAPP_ENABLED=true           # Enable/disable WhatsApp (default: true)
LOG_LEVEL=info                  # Logging level: debug, info, warn, error
```

## 📝 Logs

Logs are written to:

- `logs/combined.log`: All logs
- `logs/error.log`: Error logs only
- Console: Real-time output during development

## 🛠️ Development

### Run in Development Mode

```bash
npm run dev
```

### Trigger Manual Scrape

```bash
curl -X POST http://localhost:3000/scrape
```

### Check Status

```bash
curl http://localhost:3000/status | jq
```

## 🐛 Troubleshooting

### WhatsApp Not Connecting

- Make sure WhatsApp is installed on your phone
- QR code must be scanned within 60 seconds
- Check that `.wwebjs_auth/` directory exists and has proper permissions
- Try deleting `.wwebjs_auth/` and scanning QR again

### Email Not Sending

- Verify Gmail App Password (16 characters, no spaces)
- Check that 2-Step Verification is enabled on your Google account
- Ensure `GMAIL_ADDRESS` and `GMAIL_APP_PASSWORD` are set in `.env`

### No Jobs Found

- Check logs for scraper errors
- Job boards may have changed their HTML structure
- Try running scrapers individually to debug
- Some sites require proxies/rate limiting

### Render Service Keeps Spinning Down

- Set up cron-job.org to ping `/health` every 10 minutes
- Check that health check endpoint is responding
- Verify disk is properly mounted for database persistence

## 📊 Job Platforms Roadmap

**Current (MVP)**:
- ✅ Naukri
- ✅ Instahyre
- ✅ Wellfound (AngelList)

**Future**:
- IIMJobs
- Cutshort
- LinkedIn (with separate account)
- Greenhouse/Lever ATS boards
- Company career pages from watchlist

## 🔐 Security Notes

- Never commit `.env` file to git
- Use environment variables for all secrets
- WhatsApp session data in `.wwebjs_auth/` is sensitive
- Gmail App Password is different from your regular password
- Rotate credentials periodically

## 📜 License

MIT

## 👨‍💻 Author

Built by a Product Manager for Product Managers 🚀

---

Built with ❤️ using Node.js, Puppeteer, and lots of coffee ☕
