import { z } from 'zod';
import { DiscordMCPTool } from './base.js';
import { DiscordClientWrapper } from '../discord/client.js';
import { Logger } from '../utils/logger.js';
import { FileAttachment } from '../types/discord.js';

// Schema definitions
const FileAttachmentSchema = z.object({
  name: z.string().min(1, 'Filename is required').max(100, 'Filename too long'),
  data: z.string().optional(),
  url: z.string().url().optional(),
  path: z.string().optional(),
  description: z.string().max(1024, 'Description too long').optional(),
  spoiler: z.boolean().optional()
}).refine(
  (data) => !!(data.data || data.url || data.path),
  { message: 'At least one of data, url, or path must be provided' }
).refine(
  (data) => [data.data, data.url, data.path].filter(Boolean).length === 1,
  { message: 'Exactly one of data, url, or path must be provided' }
);

const SendMessageSchema = z.object({
  channel_id: z.string().min(1, 'Channel ID is required'),
  content: z.string().min(1, 'Message content is required').max(2000, 'Message content too long'),
  reply_to: z.string().optional(),
  files: z.array(FileAttachmentSchema).max(10, 'Maximum 10 files allowed').optional(),
  suppress_embeds: z.boolean().optional()
});

const GetMessagesSchema = z.object({
  channel_id: z.string().min(1, 'Channel ID is required'),
  limit: z.number().min(1).max(100).default(50),
  before: z.string().optional(),
  after: z.string().optional(),
  around: z.string().optional()
});

const AddReactionSchema = z.object({
  channel_id: z.string().min(1, 'Channel ID is required'),
  message_id: z.string().min(1, 'Message ID is required'),
  emoji: z.string().min(1, 'Emoji is required')
});

const RemoveReactionSchema = z.object({
  channel_id: z.string().min(1, 'Channel ID is required'),
  message_id: z.string().min(1, 'Message ID is required'),
  emoji: z.string().min(1, 'Emoji is required'),
  user_id: z.string().optional()
});

const GetMessageReactionsSchema = z.object({
  channel_id: z.string().min(1, 'Channel ID is required'),
  message_id: z.string().min(1, 'Message ID is required'),
  emoji: z.string().optional()
});

// Send Message Tool
export class SendMessageTool extends DiscordMCPTool {
  name = 'send_message';
  description = 'Send a message to a Discord channel, optionally as a reply to another message';
  inputSchema = SendMessageSchema;

  async execute(params: unknown) {
    return this.executeWithErrorHandling(async () => {
      const validatedParams = this.validateParams(params, SendMessageSchema);

      this.logger.info('Sending message', {
        tool: this.name,
        channelId: validatedParams.channel_id,
        isReply: !!validatedParams.reply_to,
        contentLength: validatedParams.content.length,
        hasFiles: !!(validatedParams.files && validatedParams.files.length > 0),
        fileCount: validatedParams.files ? validatedParams.files.length : 0
      });

      const message = await this.discord.sendMessage(validatedParams.channel_id, {
        content: validatedParams.content,
        reply_to: validatedParams.reply_to,
        files: validatedParams.files as FileAttachment[],
        suppress_embeds: validatedParams.suppress_embeds
      });

      return {
        success: true,
        message_id: message.id,
        channel_id: message.channelId,
        content: message.content,
        timestamp: message.createdAt.toISOString(),
        author: {
          id: message.author.id,
          username: message.author.username,
          bot: message.author.bot
        }
      };
    }, this.name);
  }
}

// Get Messages Tool
export class GetMessagesTool extends DiscordMCPTool {
  name = 'get_messages';
  description = 'Retrieve messages from a Discord channel with pagination support';
  inputSchema = GetMessagesSchema;

  async execute(params: unknown) {
    return this.executeWithErrorHandling(async () => {
      const validatedParams = this.validateParams(params, GetMessagesSchema);

      this.logger.info('Fetching messages', {
        tool: this.name,
        channelId: validatedParams.channel_id,
        limit: validatedParams.limit,
        hasFilters: !!(validatedParams.before || validatedParams.after || validatedParams.around)
      });

      const messages = await this.discord.getMessages(validatedParams.channel_id, {
        limit: validatedParams.limit,
        before: validatedParams.before,
        after: validatedParams.after,
        around: validatedParams.around
      });

      return {
        success: true,
        channel_id: validatedParams.channel_id,
        message_count: messages.length,
        messages: messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          author: {
            id: msg.author.id,
            username: msg.author.username,
            global_display_name: msg.author.displayName,
            server_display_name: msg.member?.displayName || msg.author.displayName,
            server_nickname: msg.member?.nickname || null,
            bot: msg.author.bot
          },
          timestamp: msg.createdAt.toISOString(),
          edited_timestamp: msg.editedAt?.toISOString() || null,
          attachments: msg.attachments.map(att => ({
            id: att.id,
            filename: att.name,
            url: att.url,
            size: att.size
          })),
          embeds: msg.embeds.length,
          reactions: msg.reactions.cache.map(reaction => ({
            emoji: reaction.emoji.name,
            count: reaction.count
          })),
          reference: msg.reference ? {
            message_id: msg.reference.messageId,
            channel_id: msg.reference.channelId,
            guild_id: msg.reference.guildId
          } : null
        }))
      };
    }, this.name);
  }
}

// Add Reaction Tool
export class AddReactionTool extends DiscordMCPTool {
  name = 'add_reaction';
  description = 'Add a reaction emoji to a Discord message';
  inputSchema = AddReactionSchema;

  async execute(params: unknown) {
    return this.executeWithErrorHandling(async () => {
      const validatedParams = this.validateParams(params, AddReactionSchema);

      this.logger.info('Adding reaction', {
        tool: this.name,
        channelId: validatedParams.channel_id,
        messageId: validatedParams.message_id,
        emoji: validatedParams.emoji
      });

      await this.discord.addReaction(
        validatedParams.channel_id,
        validatedParams.message_id,
        validatedParams.emoji
      );

      return {
        success: true,
        channel_id: validatedParams.channel_id,
        message_id: validatedParams.message_id,
        emoji: validatedParams.emoji
      };
    }, this.name);
  }
}

// Remove Reaction Tool
export class RemoveReactionTool extends DiscordMCPTool {
  name = 'remove_reaction';
  description = 'Remove a reaction emoji from a Discord message. If user_id is provided, removes only that user\'s reaction; otherwise removes all reactions of that emoji';
  inputSchema = RemoveReactionSchema;

  async execute(params: unknown) {
    return this.executeWithErrorHandling(async () => {
      const validatedParams = this.validateParams(params, RemoveReactionSchema);

      this.logger.info('Removing reaction', {
        tool: this.name,
        channelId: validatedParams.channel_id,
        messageId: validatedParams.message_id,
        emoji: validatedParams.emoji,
        userId: validatedParams.user_id
      });

      await this.discord.removeReaction(
        validatedParams.channel_id,
        validatedParams.message_id,
        validatedParams.emoji,
        validatedParams.user_id
      );

      return {
        success: true,
        channel_id: validatedParams.channel_id,
        message_id: validatedParams.message_id,
        emoji: validatedParams.emoji,
        user_id: validatedParams.user_id
      };
    }, this.name);
  }
}

// Get Message Reactions Tool
export class GetMessageReactionsTool extends DiscordMCPTool {
  name = 'get_message_reactions';
  description = 'Get reactions on a Discord message. If emoji is provided, returns users who reacted with that emoji; otherwise returns all reactions summary';
  inputSchema = GetMessageReactionsSchema;

  async execute(params: unknown) {
    return this.executeWithErrorHandling(async () => {
      const validatedParams = this.validateParams(params, GetMessageReactionsSchema);

      this.logger.info('Fetching message reactions', {
        tool: this.name,
        channelId: validatedParams.channel_id,
        messageId: validatedParams.message_id,
        emoji: validatedParams.emoji
      });

      const reactions = await this.discord.getMessageReactions(
        validatedParams.channel_id,
        validatedParams.message_id,
        validatedParams.emoji
      );

      return {
        success: true,
        channel_id: validatedParams.channel_id,
        message_id: validatedParams.message_id,
        emoji: validatedParams.emoji,
        reactions
      };
    }, this.name);
  }
}