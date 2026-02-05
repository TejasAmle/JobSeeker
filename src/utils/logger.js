import winston from 'winston';
import path from 'path';
import config from '../config.js';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  if (stack) {
    msg += `\n${stack}`;
  }

  return msg;
});

// Create logger instance
const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(
        colorize(),
        logFormat
      ),
    }),
    // File transport for errors
    new winston.transports.File({
      filename: path.join(config.paths.logs, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(config.paths.logs, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Helper methods for structured logging
export const logScrape = (platform, data) => {
  logger.info('Scrape completed', {
    platform,
    ...data,
  });
};

export const logError = (context, error, metadata = {}) => {
  logger.error(`Error in ${context}`, {
    error: error.message,
    stack: error.stack,
    ...metadata,
  });
};

export const logNotification = (channel, jobId, success, error = null) => {
  if (success) {
    logger.info('Notification sent', {
      channel,
      jobId,
    });
  } else {
    logger.error('Notification failed', {
      channel,
      jobId,
      error: error?.message,
    });
  }
};

export default logger;
