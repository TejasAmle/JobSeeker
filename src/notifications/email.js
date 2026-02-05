import nodemailer from 'nodemailer';
import config from '../config.js';
import logger, { logNotification } from '../utils/logger.js';

let transporter = null;

// Initialize email transporter
export function initializeEmailTransporter() {
  if (!config.gmail.address || !config.gmail.appPassword) {
    logger.warn('Gmail credentials not configured. Email notifications will be disabled.');
    return false;
  }

  try {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.gmail.address,
        pass: config.gmail.appPassword,
      },
    });

    logger.info('Email transporter initialized', { email: config.gmail.address });
    return true;
  } catch (error) {
    logger.error('Failed to initialize email transporter', error);
    return false;
  }
}

// Format job notification email
function formatJobEmail(job) {
  const matchReasons = [];

  // Analyze why this job matched
  if (job.relevance_score >= 80) {
    matchReasons.push('High relevance score - Strong match for your profile');
  }
  if (job.salary_numeric && job.salary_numeric >= 30) {
    matchReasons.push(`Competitive compensation: ${job.salary}`);
  }
  if (job.location && ['Bangalore', 'Delhi', 'Mumbai', 'NCR'].some(loc =>
      job.location.toLowerCase().includes(loc.toLowerCase()))) {
    matchReasons.push(`Preferred location: ${job.location}`);
  }
  if (job.is_watchlist) {
    matchReasons.push(`⭐ Watchlist company (${job.watchlist_priority} priority)`);
  }

  const subject = `🎯 [Score: ${job.relevance_score}] ${job.title} @ ${job.company} — ${job.location || 'Location TBD'}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
    .job-details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .detail-row { display: flex; margin: 10px 0; }
    .detail-label { font-weight: bold; min-width: 120px; color: #555; }
    .detail-value { color: #333; }
    .description { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; max-height: 200px; overflow-y: auto; }
    .reasons { background: #e8f5e9; padding: 15px; border-radius: 6px; border-left: 4px solid #4caf50; }
    .reasons ul { margin: 10px 0; padding-left: 20px; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
    .footer { text-align: center; color: #777; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
    .score-badge { background: #4caf50; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; display: inline-block; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 New Job Match Found!</h1>
      <div class="score-badge">Match Score: ${job.relevance_score}/100</div>
    </div>

    <div class="content">
      <div class="job-details">
        <h2 style="margin-top: 0; color: #667eea;">${job.title}</h2>

        <div class="detail-row">
          <div class="detail-label">🏢 Company:</div>
          <div class="detail-value">${job.company}</div>
        </div>

        <div class="detail-row">
          <div class="detail-label">📍 Location:</div>
          <div class="detail-value">${job.location || 'Not specified'}</div>
        </div>

        <div class="detail-row">
          <div class="detail-label">💰 Salary:</div>
          <div class="detail-value">${job.salary || '⚠️ Not disclosed — verify manually'}</div>
        </div>

        <div class="detail-row">
          <div class="detail-label">🏷️ Source:</div>
          <div class="detail-value">${job.source_platform}</div>
        </div>

        <div class="detail-row">
          <div class="detail-label">📅 Posted:</div>
          <div class="detail-value">${job.posted_date || 'Recently'}</div>
        </div>
      </div>

      ${job.description ? `
      <div class="description">
        <h3 style="margin-top: 0;">📄 Job Description</h3>
        <p>${job.description.substring(0, 500)}${job.description.length > 500 ? '...' : ''}</p>
      </div>
      ` : ''}

      ${matchReasons.length > 0 ? `
      <div class="reasons">
        <h3 style="margin-top: 0;">✨ Why This Matched</h3>
        <ul>
          ${matchReasons.map(reason => `<li>${reason}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      <div style="text-align: center;">
        <a href="${job.apply_url || job.source_url}" class="cta-button">
          🚀 Apply Now
        </a>
      </div>
    </div>

    <div class="footer">
      <p>━━━━━━━━━━━━━━━━━━━━━━━</p>
      <p>This is an automated alert from your Job Hunter Agent.</p>
      <p>To manage notifications, update your .env configuration.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
New PM Role Found That Matches Your Criteria

━━━━━━━━━━━━━━━━━━━━━━━
🏢 Company: ${job.company}
💼 Role: ${job.title}
📍 Location: ${job.location || 'Not specified'}
💰 CTC: ${job.salary || 'Not disclosed'}
📊 Match Score: ${job.relevance_score}/100
🏷️ Source: ${job.source_platform}
📅 Posted: ${job.posted_date || 'Recently'}
🔗 Apply: ${job.apply_url || job.source_url}
━━━━━━━━━━━━━━━━━━━━━━━

${job.description ? `Job Description:\n${job.description.substring(0, 300)}...\n\n` : ''}

Why This Matched:
${matchReasons.map(r => `- ${r}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━
This is an automated alert from your Job Hunter Agent.
  `;

  return { subject, html, text };
}

// Send job notification email
export async function sendJobNotification(job) {
  if (!transporter) {
    logger.warn('Email transporter not initialized. Skipping email notification.');
    return false;
  }

  try {
    const { subject, html, text } = formatJobEmail(job);

    const mailOptions = {
      from: config.gmail.address,
      to: config.gmail.address,
      subject,
      text,
      html,
    };

    await transporter.sendMail(mailOptions);
    logNotification('email', job.id, true);
    return true;
  } catch (error) {
    logNotification('email', job.id, false, error);
    logger.error('Failed to send email notification', error, { jobId: job.id });
    return false;
  }
}

// Send daily digest email
export async function sendDailyDigest(jobs) {
  if (!transporter || jobs.length === 0) {
    return false;
  }

  try {
    const subject = `📊 Daily Job Digest - ${jobs.length} Opportunities Found`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .job-row { background: white; padding: 15px; margin: 10px 0; border: 1px solid #ddd; border-radius: 6px; }
    .job-row:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .job-title { font-weight: bold; color: #667eea; font-size: 16px; }
    .job-meta { color: #666; font-size: 14px; margin: 5px 0; }
    .score { background: #ffc107; color: #333; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Daily Job Digest</h1>
      <p>${jobs.length} opportunities found in the last 24 hours</p>
    </div>
    <div style="background: #f9f9f9; padding: 20px;">
      ${jobs.map(job => `
        <div class="job-row">
          <div class="job-title">${job.title} @ ${job.company}</div>
          <div class="job-meta">
            📍 ${job.location || 'Location TBD'} |
            💰 ${job.salary || 'Salary TBD'} |
            <span class="score">Score: ${job.relevance_score}/100</span>
          </div>
          <div style="margin-top: 10px;">
            <a href="${job.apply_url || job.source_url}" style="color: #667eea; text-decoration: none;">→ View Details</a>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>
    `;

    const text = jobs.map(job =>
      `${job.title} @ ${job.company}\n` +
      `📍 ${job.location || 'TBD'} | 💰 ${job.salary || 'TBD'} | Score: ${job.relevance_score}/100\n` +
      `🔗 ${job.apply_url || job.source_url}\n`
    ).join('\n━━━━━━━━━━━━━━━━━━━━\n');

    await transporter.sendMail({
      from: config.gmail.address,
      to: config.gmail.address,
      subject,
      text,
      html,
    });

    logger.info('Daily digest email sent', { jobCount: jobs.length });
    return true;
  } catch (error) {
    logger.error('Failed to send daily digest email', error);
    return false;
  }
}

// Test email connection
export async function testEmailConnection() {
  if (!transporter) {
    return { success: false, error: 'Transporter not initialized' };
  }

  try {
    await transporter.verify();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default {
  initialize: initializeEmailTransporter,
  sendJobNotification,
  sendDailyDigest,
  testConnection: testEmailConnection,
};
