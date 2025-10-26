import { Message } from 'discord.js';

export enum DiscordErrorType {
  RATE_LIMITED = 'rate_limited',
  PERMISSION_DENIED = 'permission_denied',
  NOT_FOUND = 'not_found',
  NETWORK_ERROR = 'network_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  INVALID_PARAMETERS = 'invalid_parameters',
  UNKNOWN = 'unknown'
}

export interface DiscordError {
  type: DiscordErrorType;
  message: string;
  originalError: Error;
  isRetryable: boolean;
  retryAfter?: number;
  code?: number;
}

export interface GetMessagesOptions {
  limit?: number;
  before?: string;
  after?: string;
  around?: string;
}

export interface FileAttachment {
  name: string;                    // Filename to display in Discord
  data?: string;                   // Base64 encoded file data
  url?: string;                    // URL to fetch file from
  path?: string;                   // Local file path
  description?: string;            // Alt text for images/accessibility
  spoiler?: boolean;              // Mark as spoiler content
}

export interface SendMessageOptions {
  content: string;
  reply_to?: string;
  thread_id?: string;
  files?: FileAttachment[];       // File attachments
}

export interface CreateThreadOptions {
  name: string;
  auto_archive_duration?: number;
  message_id?: string;
  reason?: string;
  rate_limit_per_user?: number;
}

export interface CreateChannelOptions {
  name: string;
  type?: number;
  topic?: string;
  parent_id?: string;
  position?: number;
  nsfw?: boolean;
  bitrate?: number;
  user_limit?: number;
  rate_limit_per_user?: number;
  reason?: string;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  retryableErrors: DiscordErrorType[];
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTimestamp: number;
  bucket: string;
}

export interface MCPError {
  code: string;
  message: string;
  details?: {
    discordError?: DiscordError;
    retryable: boolean;
    suggestedAction?: string;
  };
}