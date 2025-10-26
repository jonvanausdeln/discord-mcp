import { z } from 'zod';
import { DiscordMCPTool } from './base.js';

// Schema definitions
const ListServersSchema = z.object({
  // No parameters needed for listing servers
});

const ListChannelsSchema = z.object({
  guild_id: z.string().min(1, 'Guild ID is required')
});

const CreateThreadSchema = z.object({
  channel_id: z.string().min(1, 'Channel ID is required'),
  name: z.string().min(1, 'Thread name is required').max(100, 'Thread name too long'),
  auto_archive_duration: z.number().optional(),
  message_id: z.string().optional(),
  reason: z.string().optional(),
  rate_limit_per_user: z.number().min(0).max(21600).optional()
});

const CreateChannelSchema = z.object({
  guild_id: z.string().min(1, 'Guild ID is required'),
  name: z.string().min(1, 'Channel name is required').max(100, 'Channel name too long'),
  type: z.number().int().min(0).max(15).optional(),
  topic: z.string().max(1024, 'Topic too long').optional(),
  parent_id: z.string().optional(),
  position: z.number().int().min(0).optional(),
  nsfw: z.boolean().optional(),
  bitrate: z.number().int().min(8000).max(384000).optional(),
  user_limit: z.number().int().min(0).max(99).optional(),
  rate_limit_per_user: z.number().int().min(0).max(21600).optional(),
  reason: z.string().optional()
});

// List Servers Tool
export class ListServersTool extends DiscordMCPTool {
  name = 'list_servers';
  description = 'List all Discord servers (guilds) that the bot has access to, including basic server information';
  inputSchema = ListServersSchema;

  async execute(params: unknown) {
    return this.executeWithErrorHandling(async () => {
      const validatedParams = this.validateParams(params, ListServersSchema);

      this.logger.info('Listing servers', {
        tool: this.name
      });

      const guilds = await this.discord.getGuilds();

      return {
        success: true,
        server_count: guilds.length,
        servers: guilds.map(guild => ({
          id: guild.id,
          name: guild.name,
          description: guild.description,
          icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
          member_count: guild.memberCount,
          owner_id: guild.ownerId,
          features: guild.features,
          created_at: guild.createdAt.toISOString(),
          verification_level: guild.verificationLevel,
          default_message_notifications: guild.defaultMessageNotifications,
          explicit_content_filter: guild.explicitContentFilter,
          premium_tier: guild.premiumTier,
          premium_subscription_count: guild.premiumSubscriptionCount || 0,
          preferred_locale: guild.preferredLocale,
          channels: {
            system_channel_id: guild.systemChannelId,
            rules_channel_id: guild.rulesChannelId,
            public_updates_channel_id: guild.publicUpdatesChannelId
          }
        }))
      };
    }, this.name);
  }
}

// List Channels Tool
export class ListChannelsTool extends DiscordMCPTool {
  name = 'list_channels';
  description = 'List all channels in a Discord server (guild), including channel types, permissions, and metadata';
  inputSchema = ListChannelsSchema;

  async execute(params: unknown) {
    return this.executeWithErrorHandling(async () => {
      const validatedParams = this.validateParams(params, ListChannelsSchema);

      this.logger.info('Listing channels', {
        tool: this.name,
        guildId: validatedParams.guild_id
      });

      const channels = await this.discord.getGuildChannels(validatedParams.guild_id);

      return {
        success: true,
        guild_id: validatedParams.guild_id,
        channel_count: channels.length,
        channels: channels.map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          position: channel.position,
          parent_id: channel.parentId,
          topic: 'topic' in channel ? channel.topic : null,
          nsfw: 'nsfw' in channel ? channel.nsfw : false,
          bitrate: 'bitrate' in channel ? channel.bitrate : null,
          user_limit: 'userLimit' in channel ? channel.userLimit : null,
          rate_limit_per_user: 'rateLimitPerUser' in channel ? channel.rateLimitPerUser : null,
          created_at: channel.createdAt.toISOString(),
          permissions: {
            viewable: channel.viewable,
            manageable: channel.manageable,
            deletable: channel.deletable
          }
        }))
      };
    }, this.name);
  }
}

// Create Thread Tool
export class CreateThreadTool extends DiscordMCPTool {
  name = 'create_thread';
  description = 'Create a new thread in a Discord channel, either as a standalone thread or from an existing message';
  inputSchema = CreateThreadSchema;

  async execute(params: unknown) {
    return this.executeWithErrorHandling(async () => {
      const validatedParams = this.validateParams(params, CreateThreadSchema);

      this.logger.info('Creating thread', {
        tool: this.name,
        channelId: validatedParams.channel_id,
        threadName: validatedParams.name,
        fromMessage: !!validatedParams.message_id
      });

      const thread = await this.discord.createThread(validatedParams.channel_id, {
        name: validatedParams.name,
        auto_archive_duration: validatedParams.auto_archive_duration,
        message_id: validatedParams.message_id,
        reason: validatedParams.reason,
        rate_limit_per_user: validatedParams.rate_limit_per_user
      });

      return {
        success: true,
        thread: {
          id: thread.id,
          name: thread.name,
          type: thread.type,
          guild_id: thread.guildId,
          parent_id: thread.parentId,
          owner_id: thread.ownerId,
          archived: thread.archived,
          auto_archive_duration: thread.autoArchiveDuration,
          archive_timestamp: thread.archiveTimestamp?.toISOString() || null,
          locked: thread.locked,
          invitable: thread.invitable,
          created_at: thread.createdAt?.toISOString() || null,
          member_count: thread.memberCount || 0,
          message_count: thread.messageCount || 0,
          rate_limit_per_user: thread.rateLimitPerUser || 0
        }
      };
    }, this.name);
  }
}

// Create Channel Tool
export class CreateChannelTool extends DiscordMCPTool {
  name = 'create_channel';
  description = 'Create a new channel in a Discord server (guild) with configurable options like type, permissions, and settings';
  inputSchema = CreateChannelSchema;

  async execute(params: unknown) {
    return this.executeWithErrorHandling(async () => {
      const validatedParams = this.validateParams(params, CreateChannelSchema);

      this.logger.info('Creating channel', {
        tool: this.name,
        guildId: validatedParams.guild_id,
        channelName: validatedParams.name,
        channelType: validatedParams.type || 0
      });

      const channel = await this.discord.createChannel(validatedParams.guild_id, {
        name: validatedParams.name,
        type: validatedParams.type,
        topic: validatedParams.topic,
        parent_id: validatedParams.parent_id,
        position: validatedParams.position,
        nsfw: validatedParams.nsfw,
        bitrate: validatedParams.bitrate,
        user_limit: validatedParams.user_limit,
        rate_limit_per_user: validatedParams.rate_limit_per_user,
        reason: validatedParams.reason
      });

      return {
        success: true,
        channel: {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          guild_id: channel.guildId,
          parent_id: channel.parentId,
          position: channel.position,
          topic: 'topic' in channel ? channel.topic : null,
          nsfw: 'nsfw' in channel ? channel.nsfw : false,
          bitrate: 'bitrate' in channel ? channel.bitrate : null,
          user_limit: 'userLimit' in channel ? channel.userLimit : null,
          rate_limit_per_user: 'rateLimitPerUser' in channel ? channel.rateLimitPerUser : null,
          created_at: channel.createdAt.toISOString(),
          permissions: {
            viewable: channel.viewable,
            manageable: channel.manageable,
            deletable: channel.deletable
          }
        }
      };
    }, this.name);
  }
}