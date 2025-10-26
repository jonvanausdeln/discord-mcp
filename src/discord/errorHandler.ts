import { DiscordAPIError, HTTPError } from 'discord.js';
import { DiscordError, DiscordErrorType } from '../types/discord.js';

export class DiscordErrorHandler {
  static handleError(error: unknown): DiscordError {
    // Handle Discord API errors
    if (error instanceof DiscordAPIError) {
      return this.handleDiscordAPIError(error);
    }

    // Handle HTTP errors
    if (error instanceof HTTPError) {
      return this.handleHTTPError(error);
    }

    // Handle generic errors
    if (error instanceof Error) {
      return this.handleGenericError(error);
    }

    // Handle unknown error types
    return {
      type: DiscordErrorType.UNKNOWN,
      message: 'An unknown error occurred',
      originalError: new Error(String(error)),
      isRetryable: false
    };
  }

  private static handleDiscordAPIError(error: DiscordAPIError): DiscordError {
    const code = error.code;
    const status = error.status;

    // Map Discord API error codes to our error types
    switch (code) {
      case 401: // Unauthorized
        return {
          type: DiscordErrorType.AUTHENTICATION_ERROR,
          message: 'Invalid bot token or insufficient authentication',
          originalError: error,
          isRetryable: false,
          code: status
        };

      case 403: // Forbidden
        return {
          type: DiscordErrorType.PERMISSION_DENIED,
          message: `Missing permissions: ${error.message}`,
          originalError: error,
          isRetryable: false,
          code: status
        };

      case 404: // Not Found
        return {
          type: DiscordErrorType.NOT_FOUND,
          message: `Resource not found: ${error.message}`,
          originalError: error,
          isRetryable: false,
          code: status
        };

      case 429: // Rate Limited
        const retryAfter = this.extractRetryAfter(error);
        return {
          type: DiscordErrorType.RATE_LIMITED,
          message: `Rate limited. Retry after ${retryAfter}ms`,
          originalError: error,
          isRetryable: true,
          retryAfter,
          code: status
        };

      case 400: // Bad Request
        return {
          type: DiscordErrorType.INVALID_PARAMETERS,
          message: `Invalid request parameters: ${error.message}`,
          originalError: error,
          isRetryable: false,
          code: status
        };

      case 500:
      case 502:
      case 503:
      case 504: // Server errors
        return {
          type: DiscordErrorType.NETWORK_ERROR,
          message: `Discord server error (${status}): ${error.message}`,
          originalError: error,
          isRetryable: true,
          code: status
        };

      default:
        return {
          type: DiscordErrorType.UNKNOWN,
          message: `Discord API error (${code}): ${error.message}`,
          originalError: error,
          isRetryable: status >= 500,
          code: status
        };
    }
  }

  private static handleHTTPError(error: HTTPError): DiscordError {
    const status = error.status;

    if (status >= 500) {
      return {
        type: DiscordErrorType.NETWORK_ERROR,
        message: `HTTP error (${status}): ${error.message}`,
        originalError: error,
        isRetryable: true,
        code: status
      };
    }

    return {
      type: DiscordErrorType.UNKNOWN,
      message: `HTTP error (${status}): ${error.message}`,
      originalError: error,
      isRetryable: false,
      code: status
    };
  }

  private static handleGenericError(error: Error): DiscordError {
    // Check for network-related errors
    const networkErrors = ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'];
    const isNetworkError = networkErrors.some(code => error.message.includes(code));

    if (isNetworkError) {
      return {
        type: DiscordErrorType.NETWORK_ERROR,
        message: `Network error: ${error.message}`,
        originalError: error,
        isRetryable: true
      };
    }

    return {
      type: DiscordErrorType.UNKNOWN,
      message: error.message,
      originalError: error,
      isRetryable: false
    };
  }

  private static extractRetryAfter(error: DiscordAPIError): number {
    // Discord includes retry-after in seconds, convert to milliseconds
    // Check if the error has retry-after information
    const errorData = error as any;
    if (errorData.retry_after) {
      return errorData.retry_after * 1000;
    }

    // Fallback to a default retry delay
    return 1000;
  }

  static isRetryableError(error: DiscordError): boolean {
    return error.isRetryable;
  }

  static getRetryDelay(error: DiscordError, attempt: number, baseDelay: number = 1000): number {
    // Use explicit retry-after for rate limits
    if (error.type === DiscordErrorType.RATE_LIMITED && error.retryAfter) {
      return error.retryAfter;
    }

    // Exponential backoff for other retryable errors
    return Math.min(baseDelay * Math.pow(2, attempt), 30000);
  }
}