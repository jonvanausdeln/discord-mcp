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

const SendDMSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  content: z.string().min(1, 'Message content is required').max(2000, 'Message content too long'),
  files: z.array(FileAttachmentSchema).max(10, 'Maximum 10 files allowed').optional()
});

const ListDMsSchema = z.object({
  include_closed: z.boolean().optional().default(false)
});

const OpenDMSchema = z.object({
  user_id: z.string().min(1, 'User ID is required')
});

// Send DM Tool
export class SendDMTool extends DiscordMCPTool {
  name = 'send_dm';
  description = 'Send a direct message to a Discord user by their user ID. Creates a DM channel if one does not exist.';
  inputSchema = SendDMSchema;

  async execute(params: unknown) {
    return this.executeWithErrorHandling(async () => {
      const validatedParams = this.validateParams(params, SendDMSchema);

      this.logger.info('Sending DM', {
        tool: this.name,
        userId: validatedParams.user_id,
        contentLength: validatedParams.content.length,
        hasFiles: !!(validatedParams.files && validatedParams.files.length > 0),
        fileCount: validatedParams.files ? validatedParams.files.length : 0
      });

      // Get the Discord client and fetch the user
      const client = this.discord.getClient();
      const user = await client.users.fetch(validatedParams.user_id);

      if (!user) {
        throw new Error(`User with ID ${validatedParams.user_id} not found`);
      }

      // Create or get existing DM channel
      const dmChannel = await user.createDM();

      this.logger.info('DM channel created/retrieved', {
        tool: this.name,
        userId: validatedParams.user_id,
        channelId: dmChannel.id,
        username: user.username
      });

      // Use existing sendMessage method with the DM channel ID
      const message = await this.discord.sendMessage(dmChannel.id, {
        content: validatedParams.content,
        files: validatedParams.files as FileAttachment[]
      });

      return {
        success: true,
        message_id: message.id,
        channel_id: message.channelId,
        user: {
          id: user.id,
          username: user.username,
          global_display_name: user.displayName
        },
        content: message.content,
        timestamp: message.createdAt.toISOString(),
        attachments: message.attachments.map(att => ({
          id: att.id,
          filename: att.name,
          url: att.url,
          size: att.size
        }))
      };
    }, this.name);
  }
}

// List DMs Tool
export class ListDMsTool extends DiscordMCPTool {
  name = 'list_dms';
  description = 'List all active DM channels that the bot has access to';
  inputSchema = ListDMsSchema;

  async execute(params: unknown) {
    return this.executeWithErrorHandling(async () => {
      const validatedParams = this.validateParams(params, ListDMsSchema);

      this.logger.info('Listing DM channels', {
        tool: this.name,
        includeClosed: validatedParams.include_closed
      });

      const client = this.discord.getClient();

      // Get all DM channels from the cache
      const dmChannels = client.channels.cache
        .filter(channel => channel.isDMBased() && channel.isTextBased())
        .map(channel => {
          // DM channels have a recipient property
          const recipient = (channel as any).recipient;

          return {
            channel_id: channel.id,
            type: channel.type,
            user: recipient ? {
              id: recipient.id,
              username: recipient.username,
              global_display_name: recipient.displayName,
              bot: recipient.bot
            } : null,
            created_at: channel.createdAt?.toISOString() || null
          };
        });

      this.logger.info('DM channels retrieved', {
        tool: this.name,
        count: dmChannels.length
      });

      return {
        success: true,
        dm_count: dmChannels.length,
        dms: Array.from(dmChannels)
      };
    }, this.name);
  }
}

// Open DM Tool
export class OpenDMTool extends DiscordMCPTool {
  name = 'open_dm';
  description = 'Open or create a DM channel with a specific user. Returns the DM channel ID that can be used with send_message and get_messages tools.';
  inputSchema = OpenDMSchema;

  async execute(params: unknown) {
    return this.executeWithErrorHandling(async () => {
      const validatedParams = this.validateParams(params, OpenDMSchema);

      this.logger.info('Opening DM channel', {
        tool: this.name,
        userId: validatedParams.user_id
      });

      const client = this.discord.getClient();
      const user = await client.users.fetch(validatedParams.user_id);

      if (!user) {
        throw new Error(`User with ID ${validatedParams.user_id} not found`);
      }

      // Create or get existing DM channel
      const dmChannel = await user.createDM();

      this.logger.info('DM channel opened', {
        tool: this.name,
        userId: validatedParams.user_id,
        channelId: dmChannel.id,
        username: user.username
      });

      return {
        success: true,
        channel_id: dmChannel.id,
        user: {
          id: user.id,
          username: user.username,
          global_display_name: user.displayName,
          bot: user.bot
        },
        created_at: dmChannel.createdAt?.toISOString() || null,
        message: `DM channel opened with ${user.username}. You can now use this channel_id with send_message and get_messages tools.`
      };
    }, this.name);
  }
}
