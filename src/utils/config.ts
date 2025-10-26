import { GatewayIntentBits } from 'discord.js';
import { RetryConfig, DiscordErrorType } from '../types/discord.js';

export interface Config {
  discord: {
    token: string;
    intents: GatewayIntentBits[];
    reconnectTimeout: number;
  };
  logging: {
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    format: 'json' | 'text';
  };
  rateLimiting: {
    bufferMs: number;
    maxRetries: number;
  };
  mcp: {
    name: string;
    version: string;
  };
  retry: RetryConfig;
}

export function loadConfig(): Config {
  // Load from environment variables with defaults
  const config: Config = {
    discord: {
      token: process.env.DISCORD_BOT_TOKEN || '',
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers
      ],
      reconnectTimeout: parseInt(process.env.RECONNECT_TIMEOUT_MS || '5000')
    },
    logging: {
      level: (process.env.LOG_LEVEL as any) || 'INFO',
      format: 'json'
    },
    rateLimiting: {
      bufferMs: parseInt(process.env.RATE_LIMIT_BUFFER_MS || '1000'),
      maxRetries: parseInt(process.env.MAX_RETRIES || '3')
    },
    mcp: {
      name: process.env.MCP_SERVER_NAME || 'discord-mcp-server',
      version: process.env.MCP_SERVER_VERSION || '0.1.0'
    },
    retry: {
      maxAttempts: parseInt(process.env.MAX_RETRIES || '3'),
      baseDelay: 1000,
      maxDelay: 30000,
      jitter: true,
      retryableErrors: [DiscordErrorType.RATE_LIMITED, DiscordErrorType.NETWORK_ERROR, DiscordErrorType.UNKNOWN]
    }
  };

  // Validate required config
  if (!config.discord.token) {
    throw new Error('DISCORD_BOT_TOKEN environment variable is required');
  }

  return config;
}