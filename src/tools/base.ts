import { z } from 'zod';
import { DiscordClientWrapper } from '../discord/client.js';
import { Logger } from '../utils/logger.js';
import { DiscordErrorHandler } from '../discord/errorHandler.js';
import { MCPError } from '../types/discord.js';

export abstract class DiscordMCPTool {
  constructor(
    protected discord: DiscordClientWrapper,
    protected logger: Logger
  ) {}

  abstract name: string;
  abstract description: string;
  abstract inputSchema: z.ZodSchema<any>;

  abstract execute(params: any): Promise<any>;

  protected async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    toolName: string
  ): Promise<T> {
    try {
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;

      this.logger.debug(`Tool executed successfully`, {
        tool: toolName,
        duration
      });

      return result;
    } catch (error) {
      const discordError = DiscordErrorHandler.handleError(error);

      this.logger.error(`Tool execution failed`, discordError.originalError, {
        tool: toolName,
        errorType: discordError.type,
        isRetryable: discordError.isRetryable
      });

      // Convert to MCP error format
      const mcpError: MCPError = {
        code: discordError.type,
        message: discordError.message,
        details: {
          discordError,
          retryable: discordError.isRetryable,
          suggestedAction: this.getSuggestedAction(discordError)
        }
      };

      throw mcpError;
    }
  }

  protected validateParams<T>(params: unknown, schema: z.ZodSchema<T>): T {
    try {
      return schema.parse(params);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue =>
          `${issue.path.join('.')}: ${issue.message}`
        ).join(', ');

        throw new Error(`Invalid parameters: ${issues}`);
      }
      throw error;
    }
  }

  private getSuggestedAction(discordError: any): string {
    switch (discordError.type) {
      case 'authentication_error':
        return 'Check your Discord bot token in the .env file';
      case 'permission_denied':
        return 'Ensure the bot has the required permissions for this channel/server';
      case 'not_found':
        return 'Verify the channel/message ID exists and the bot has access to it';
      case 'rate_limited':
        return 'Wait for the rate limit to reset before retrying';
      case 'network_error':
        return 'Check your internet connection and try again';
      case 'invalid_parameters':
        return 'Review the parameter format and try again';
      default:
        return 'Check the logs for more details and try again';
    }
  }
}