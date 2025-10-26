import winston from 'winston';
import { Config } from './config.js';

export interface Logger {
  debug(message: string, context?: object): void;
  info(message: string, context?: object): void;
  warn(message: string, context?: object): void;
  error(message: string, error?: Error, context?: object): void;
  logDiscordRequest(method: string, url: string, duration: number, success: boolean): void;
}

export function createLogger(config: Config): Logger {
  const winstonLogger = winston.createLogger({
    level: config.logging.level.toLowerCase(),
    format: config.logging.format === 'json'
      ? winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      : winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.simple()
        ),
    transports: [
      new winston.transports.Console({
        stderrLevels: ['error', 'warn', 'info', 'debug'],
        handleExceptions: true,
        handleRejections: true
      })
    ]
  });

  return {
    debug(message: string, context?: object): void {
      winstonLogger.debug(message, context);
    },

    info(message: string, context?: object): void {
      winstonLogger.info(message, context);
    },

    warn(message: string, context?: object): void {
      winstonLogger.warn(message, context);
    },

    error(message: string, error?: Error, context?: object): void {
      winstonLogger.error(message, {
        error: error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : undefined,
        ...context
      });
    },

    logDiscordRequest(method: string, url: string, duration: number, success: boolean): void {
      const level = success ? 'debug' : 'warn';
      winstonLogger[level]('Discord API Request', {
        method,
        url: url.replace(/\/channels\/\d+/g, '/channels/***'), // Sanitize channel IDs
        duration,
        success,
        component: 'discord-api'
      });
    }
  };
}