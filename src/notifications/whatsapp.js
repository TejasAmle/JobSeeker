import whatsappWeb from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import config from '../config.js';
import logger, { logNotification } from '../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client, LocalAuth } = whatsappWeb;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let whatsappClient = null;
let isReady = false;
let messageQueue = [];
let lastMessageTime = 0;
const MESSAGE_DELAY = 30000; // 30 seconds between messages to avoid ban

// Initialize WhatsApp client
export async function initializeWhatsApp() {
  if (!config.whatsapp.enabled) {
    logger.info('WhatsApp is disabled in configuration');
    return false;
  }

  try {
    const authPath = path.join(__dirname, '..', '..', '.wwebjs_auth');

    whatsappClient = new Client({
      authStrategy: new LocalAuth({
        clientId: 'job-hunter-agent',
        dataPath: authPath,
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      },
    });

    // QR Code event
    whatsappClient.on('qr', (qr) => {
      logger.info('WhatsApp QR Code received. Scan with your phone:');
      qrcode.generate(qr, { small: true });
      console.log('\n📱 Scan the QR code above with WhatsApp on your phone');
      console.log('Go to WhatsApp > Settings > Linked Devices > Link a Device\n');
    });

    // Ready event
    whatsappClient.on('ready', () => {
      isReady = true;
      logger.info('WhatsApp client is ready');
      console.log('✅ WhatsApp connected successfully!\n');

      // Process any queued messages
      processMessageQueue();
    });

    // Authentication success
    whatsappClient.on('authenticated', () => {
      logger.info('WhatsApp authenticated');
    });

    // Authentication failure
    whatsappClient.on('auth_failure', (msg) => {
      logger.error('WhatsApp authentication failed', new Error(msg));
      console.error('❌ WhatsApp authentication failed. Please restart and scan QR code again.');
    });

    // Disconnection handler with auto-reconnect
    whatsappClient.on('disconnected', (reason) => {
      isReady = false;
      logger.warn('WhatsApp disconnected', { reason });
      console.log('⚠️  WhatsApp disconnected. Attempting to reconnect...');

      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        logger.info('Attempting to reconnect WhatsApp...');
        whatsappClient.initialize().catch(err => {
          logger.error('WhatsApp reconnection failed', err);
        });
      }, 5000);
    });

    // Initialize the client
    await whatsappClient.initialize();
    logger.info('WhatsApp client initialized');
    return true;

  } catch (error) {
    logger.error('Failed to initialize WhatsApp client', error);
    console.error('❌ WhatsApp initialization failed:', error.message);
    return false;
  }
}

// Format job notification for WhatsApp (keep it short)
function formatWhatsAppMessage(job) {
  const lines = [
    `🎯 *${job.title}* @ *${job.company}*`,
    '',
    `📍 ${job.location || 'Location TBD'}`,
    `💰 ${job.salary || 'Salary not disclosed'}`,
    `⭐ Match Score: ${job.relevance_score}/100`,
    `🏷️ Source: ${job.source_platform}`,
    `📅 ${job.posted_date || 'Recently posted'}`,
    '',
    `🔗 ${job.apply_url || job.source_url}`,
  ];

  if (job.is_watchlist) {
    lines.splice(1, 0, `⭐ *WATCHLIST COMPANY* (${job.watchlist_priority} priority)`);
  }

  if (!job.salary) {
    lines.push('', '⚠️ _Salary not disclosed — verify manually_');
  }

  return lines.join('\n');
}

// Send message with rate limiting
async function sendMessageWithDelay(message, phoneNumber) {
  // Wait for rate limit
  const now = Date.now();
  const timeSinceLastMessage = now - lastMessageTime;

  if (timeSinceLastMessage < MESSAGE_DELAY) {
    const waitTime = MESSAGE_DELAY - timeSinceLastMessage;
    logger.info(`Rate limiting: waiting ${waitTime}ms before sending message`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  try {
    // Format phone number (remove + and spaces)
    const formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
    const chatId = `${formattedNumber}@c.us`;

    await whatsappClient.sendMessage(chatId, message);
    lastMessageTime = Date.now();
    return true;
  } catch (error) {
    logger.error('Failed to send WhatsApp message', error);
    throw error;
  }
}

// Process queued messages
async function processMessageQueue() {
  if (messageQueue.length === 0 || !isReady) {
    return;
  }

  logger.info(`Processing WhatsApp message queue (${messageQueue.length} messages)`);

  while (messageQueue.length > 0) {
    const { message, phoneNumber, jobId, resolve, reject } = messageQueue.shift();

    try {
      await sendMessageWithDelay(message, phoneNumber);
      logNotification('whatsapp', jobId, true);
      resolve(true);
    } catch (error) {
      logNotification('whatsapp', jobId, false, error);
      reject(error);
    }
  }
}

// Send job notification via WhatsApp
export async function sendJobNotification(job) {
  if (!config.whatsapp.enabled) {
    logger.debug('WhatsApp is disabled');
    return false;
  }

  if (!whatsappClient) {
    logger.warn('WhatsApp client not initialized');
    return false;
  }

  const message = formatWhatsAppMessage(job);
  const phoneNumber = config.whatsapp.number;

  return new Promise((resolve, reject) => {
    if (isReady) {
      // Send immediately if connected
      sendMessageWithDelay(message, phoneNumber)
        .then(() => {
          logNotification('whatsapp', job.id, true);
          resolve(true);
        })
        .catch((error) => {
          logNotification('whatsapp', job.id, false, error);
          reject(error);
        });
    } else {
      // Queue message if not ready yet
      logger.info('WhatsApp not ready, queueing message', { jobId: job.id });
      messageQueue.push({ message, phoneNumber, jobId: job.id, resolve, reject });

      // Set a timeout to prevent hanging forever
      setTimeout(() => {
        if (messageQueue.some(m => m.jobId === job.id)) {
          logger.warn('WhatsApp message timeout', { jobId: job.id });
          resolve(false); // Resolve as failed but don't reject to allow other notifications to proceed
        }
      }, 60000); // 60 second timeout
    }
  });
}

// Send test message
export async function sendTestMessage() {
  if (!isReady) {
    return { success: false, error: 'WhatsApp client not ready' };
  }

  try {
    const testMessage = '✅ Job Hunter Agent WhatsApp test message\n\nYour notifications are configured correctly!';
    await sendMessageWithDelay(testMessage, config.whatsapp.number);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Check if WhatsApp is ready
export function isWhatsAppReady() {
  return isReady;
}

// Get WhatsApp status
export function getWhatsAppStatus() {
  return {
    enabled: config.whatsapp.enabled,
    clientInitialized: whatsappClient !== null,
    isReady: isReady,
    queuedMessages: messageQueue.length,
  };
}

// Gracefully shutdown WhatsApp client
export async function shutdownWhatsApp() {
  if (whatsappClient) {
    logger.info('Shutting down WhatsApp client');
    try {
      await whatsappClient.destroy();
      logger.info('WhatsApp client shut down successfully');
    } catch (error) {
      logger.error('Error shutting down WhatsApp client', error);
    }
  }
}

export default {
  initialize: initializeWhatsApp,
  sendJobNotification,
  sendTestMessage,
  isReady: isWhatsAppReady,
  getStatus: getWhatsAppStatus,
  shutdown: shutdownWhatsApp,
};
