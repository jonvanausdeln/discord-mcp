import { DiscordError, RetryConfig } from '../types/discord.js';
import { DiscordErrorHandler } from '../discord/errorHandler.js';
import { Logger } from './logger.js';

export class RetryManager {
  constructor(
    private config: RetryConfig,
    private logger: Logger
  ) {}

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: DiscordError | null = null;

    for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      try {
        const result = await operation();

        // Log successful retry if this wasn't the first attempt
        if (attempt > 0) {
          this.logger.info(`Operation succeeded after retry`, {
            operation: operationName,
            attempt: attempt + 1,
            totalAttempts: this.config.maxAttempts
          });
        }

        return result;
      } catch (error) {
        const discordError = DiscordErrorHandler.handleError(error);
        lastError = discordError;

        // Log the error
        this.logger.warn(`Operation failed`, {
          operation: operationName,
          attempt: attempt + 1,
          totalAttempts: this.config.maxAttempts,
          errorType: discordError.type,
          errorMessage: discordError.message,
          isRetryable: discordError.isRetryable
        });

        // Don't retry if error is not retryable
        if (!discordError.isRetryable) {
          this.logger.error(`Operation failed with non-retryable error`, discordError.originalError, {
            operation: operationName,
            errorType: discordError.type
          });
          throw discordError;
        }

        // Don't retry if this was the last attempt
        if (attempt === this.config.maxAttempts - 1) {
          this.logger.error(`Operation failed after all retry attempts`, discordError.originalError, {
            operation: operationName,
            totalAttempts: this.config.maxAttempts,
            errorType: discordError.type
          });
          break;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(discordError, attempt);

        this.logger.info(`Retrying operation after delay`, {
          operation: operationName,
          attempt: attempt + 1,
          nextAttemptIn: delay,
          errorType: discordError.type
        });

        await this.sleep(delay);
      }
    }

    // If we get here, all retries failed
    throw lastError;
  }

  private calculateDelay(error: DiscordError, attempt: number): number {
    // Use explicit retry-after for rate limits
    if (error.retryAfter) {
      return error.retryAfter;
    }

    // Exponential backoff with jitter
    let delay = Math.min(
      this.config.baseDelay * Math.pow(2, attempt),
      this.config.maxDelay
    );

    // Add jitter to prevent thundering herd
    if (this.config.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }

    return Math.max(delay, 100); // Minimum 100ms delay
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isRetryableError(error: DiscordError): boolean {
    return error.isRetryable && this.config.retryableErrors.includes(error.type);
  }
}