import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Configuration object
export const config = {
  // Agent settings
  agentEnabled: process.env.AGENT_ENABLED === 'true',
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  port: parseInt(process.env.PORT || '3000', 10),

  // Gmail settings
  gmail: {
    address: process.env.GMAIL_ADDRESS,
    appPassword: process.env.GMAIL_APP_PASSWORD,
  },

  // WhatsApp settings
  whatsapp: {
    enabled: process.env.WHATSAPP_ENABLED === 'true',
    number: process.env.WHATSAPP_NUMBER || '919910282204',
  },

  // Scraping settings
  scraping: {
    intervalMinutes: parseInt(process.env.SCRAPE_INTERVAL_MINUTES || '30', 10),
  },

  // Scoring thresholds
  scoring: {
    notifyThreshold: parseInt(process.env.NOTIFY_THRESHOLD || '60', 10),
    minSalaryLPA: parseInt(process.env.MIN_SALARY_LPA || '25', 10),
  },

  // Candidate profile
  candidate: {
    name: 'Tejas',
    experience: 4,
    email: 'tejas.amle71@gmail.com',
    whatsapp: '+91 9910282204',
    skills: [
      'Product Management',
      'B2B SaaS',
      'Platform Products',
      'Developer Tools',
      'Testing Infrastructure',
      'AI-powered features',
    ],
  },

  // Job search criteria
  jobCriteria: {
    roles: [
      'Product Manager',
      'Senior Product Manager',
      'Lead Product Manager',
      'Group Product Manager',
      'Platform PM',
      'Infrastructure PM',
    ],
    experienceRange: { min: 3, max: 8 },
    locations: ['Bangalore', 'Delhi', 'NCR', 'Mumbai', 'Remote', 'India'],
    excludeRoles: [
      'intern',
      'associate pm',
      'junior pm',
      'apm program',
      'vp product',
      'chief product',
    ],
  },

  // Paths
  paths: {
    data: path.join(__dirname, '..', 'data'),
    logs: path.join(__dirname, '..', 'logs'),
    watchlistExcel: path.join(__dirname, '..', 'PM_Companies_Comprehensive_Tejas.xlsx'),
    database: path.join(__dirname, '..', 'data', 'jobs.db'),
    careersCache: path.join(__dirname, '..', 'data', 'career-urls-cache.json'),
  },

  // Keep-alive for Render
  keepAlive: {
    enabled: process.env.KEEP_ALIVE_ENABLED === 'true',
  },
};

// Validate critical configuration
export function validateConfig() {
  const errors = [];

  if (!config.gmail.address || !config.gmail.appPassword) {
    errors.push('Gmail credentials not configured (GMAIL_ADDRESS, GMAIL_APP_PASSWORD)');
  }

  if (errors.length > 0) {
    console.warn('Configuration warnings:');
    errors.forEach(err => console.warn(`  - ${err}`));
    console.warn('Some features may not work correctly.');
  }

  return errors.length === 0;
}

export default config;
