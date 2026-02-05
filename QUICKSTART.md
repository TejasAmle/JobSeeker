# ⚡ Quick Start Guide

Get the Job Hunter Agent running in 5 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

This installs all required packages (will take 2-3 minutes).

## Step 2: Set Up Gmail App Password

1. Open browser and go to: https://myaccount.google.com/apppasswords
2. You might need to enable 2-Step Verification first (if not already enabled)
3. Click "Select app" → Choose "Mail"
4. Click "Select device" → Choose "Other" → Type "Job Hunter Agent"
5. Click "Generate"
6. Copy the 16-character password (looks like: `abcd efgh ijkl mnop`)

## Step 3: Configure Environment

```bash
cp .env.example .env
```

Then open `.env` in any text editor and update:

```env
GMAIL_ADDRESS=tejas.amle71@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop    # Paste your 16-char password here (no spaces)
```

Save the file.

## Step 4: Run the Agent

```bash
npm start
```

You should see:
```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        🎯  JOB HUNTER AGENT  🎯                          ║
║                                                           ║
║     Autonomous Product Manager Job Search Agent          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

## Step 5: Scan WhatsApp QR Code

A QR code will appear in the terminal. On your phone:

1. Open WhatsApp
2. Tap the three dots (menu) → Linked Devices
3. Tap "Link a Device"
4. Scan the QR code on your computer screen

Wait for "✅ WhatsApp connected successfully!"

## Step 6: Wait for First Jobs

The agent will:
1. Initialize database ✅
2. Load company watchlist ✅
3. Start health server ✅
4. Connect WhatsApp ✅
5. Run first scrape (takes ~2-3 minutes)
6. Send notifications for any high-scoring jobs found!

## 🎉 That's It!

The agent is now running. You'll receive:
- Email notifications to: tejas.amle71@gmail.com
- WhatsApp messages to: +91 9910282204

## Monitoring

While it's running, you can check:
- **Health**: http://localhost:3000/health
- **Status**: http://localhost:3000/status
- **Logs**: `logs/combined.log`

## Stopping the Agent

Press `Ctrl+C` in the terminal. It will shut down gracefully.

## Troubleshooting

### "Cannot find module"
```bash
npm install
```

### "Gmail authentication failed"
- Double-check your app password (16 characters, no spaces)
- Make sure 2-Step Verification is enabled
- Try generating a new app password

### WhatsApp QR code not showing
- Check that `WHATSAPP_ENABLED=true` in `.env`
- Try deleting `.wwebjs_auth/` folder and restarting
- Make sure you have a stable internet connection

### No jobs found
- This is normal on first run if scrapers hit rate limits
- Wait 30 minutes for next scrape cycle
- Check logs for any errors: `cat logs/error.log`

## Next Steps

Once confirmed working locally:
1. Read `README.md` for deployment to Render
2. Set up cron-job.org to keep Render service alive
3. Monitor daily for new job notifications!

---

Need help? Check CLAUDE.md for detailed implementation notes.
