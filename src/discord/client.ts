import { Client, Message, Channel, TextChannel, DMChannel, NewsChannel, VoiceChannel, CategoryChannel, Guild, GatewayIntentBits, NonThreadGuildBasedChannel, Collection, MessageFlags } from 'discord.js';
import { DiscordErrorHandler } from './errorHandler.js';
import { RetryManager } from '../utils/retry.js';
import { Logger } from '../utils/logger.js';
import { Config } from '../utils/config.js';
import { FileProcessor } from '../utils/fileProcessor.js';
import { GetMessagesOptions, SendMessageOptions, CreateThreadOptions, CreateChannelOptions } from '../types/discord.js';

export interface DiscordClientWrapper {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isReady(): boolean;
  getClient(): Client;

  // Message operations
  sendMessage(channelId: string, options: SendMessageOptions): Promise<Message>;
  getMessages(channelId: string, options?: GetMessagesOptions): Promise<Message[]>;

  // Reaction operations
  addReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
  removeReaction(channelId: string, messageId: string, emoji: string, userId?: string): Promise<void>;
  getMessageReactions(channelId: string, messageId: string, emoji?: string): Promise<any[]>;

  // Channel operations
  getChannel(channelId: string): Promise<Channel | null>;
  getGuildChannels(guildId: string): Promise<NonThreadGuildBasedChannel[]>;
  createChannel(guildId: string, options: CreateChannelOptions): Promise<any>;
  createThread(channelId: string, options: CreateThreadOptions): Promise<any>;

  // Guild operations
  getGuilds(): Promise<Guild[]>;
  getGuild(guildId: string): Promise<Guild | null>;
  getGuildMembers(guildId: string, options?: { limit?: number }): Promise<any[]>;
}

export class DiscordClient implements DiscordClientWrapper {
  private client: Client;
  private retryManager: RetryManager;
  private logger: Logger;
  private config: Config;
  private fileProcessor: FileProcessor;
  private isConnected: boolean = false;

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger;

    this.client = new Client({
      intents: config.discord.intents
    });

    this.retryManager = new RetryManager(config.retry, logger);
    this.fileProcessor = new FileProcessor(logger);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('ready', () => {
      this.isConnected = true;
      this.logger.info(`Discord client ready`, {
        user: this.client.user?.tag,
        guilds: this.client.guilds.cache.size
      });
    });

    this.client.on('error', (error) => {
      this.logger.error('Discord client error', error);
    });

    this.client.on('disconnect', () => {
      this.isConnected = false;
      this.logger.warn('Discord client disconnected');
    });

    this.client.on('reconnecting', () => {
      this.logger.info('Discord client reconnecting');
    });

    this.client.on('resume', () => {
      this.isConnected = true;
      this.logger.info('Discord client resumed');
    });
  }

  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to Discord...');
      await this.client.login(this.config.discord.token);

      // Wait for the client to be ready
      if (!this.client.isReady()) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Discord client failed to become ready within timeout'));
          }, this.config.discord.reconnectTimeout);

          this.client.once('ready', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }

      this.logger.info('Successfully connected to Discord');
    } catch (error) {
      const discordError = DiscordErrorHandler.handleError(error);
      this.logger.error('Failed to connect to Discord', discordError.originalError);
      throw discordError;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.logger.info('Disconnecting from Discord...');
      await this.client.destroy();
      this.isConnected = false;
      this.logger.info('Successfully disconnected from Discord');
    } catch (error) {
      const discordError = DiscordErrorHandler.handleError(error);
      this.logger.error('Error during disconnect', discordError.originalError);
      throw discordError;
    }
  }

  isReady(): boolean {
    return this.isConnected && this.client.isReady();
  }

  getClient(): Client {
    return this.client;
  }

  async sendMessage(channelId: string, options: SendMessageOptions): Promise<Message> {
    return this.retryManager.executeWithRetry(async () => {
      if (!this.isReady()) {
        throw new Error('Discord client is not ready');
      }

      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !('send' in channel)) {
        throw new Error(`Channel ${channelId} is not a text-based channel`);
      }

      const textChannel = channel as TextChannel | DMChannel | NewsChannel;

      // Process file attachments if provided
      const attachments = await this.fileProcessor.processAttachments(options.files || []);

      // Build message options
      const messageOptions: any = {
        content: options.content
      };

      // Add files if we have any
      if (attachments.length > 0) {
        messageOptions.files = attachments;
        this.logger.info('Sending message with attachments', {
          channelId,
          attachmentCount: attachments.length,
          contentLength: options.content.length
        });
      }

      // Handle suppress_embeds flag
      if (options.suppress_embeds) {
        messageOptions.flags = MessageFlags.SuppressEmbeds;
        this.logger.info('Suppressing embeds for message', { channelId });
      }

      // Handle reply
      if (options.reply_to) {
        const replyMessage = await textChannel.messages.fetch(options.reply_to);
        return await replyMessage.reply(messageOptions);
      }

      // Regular message
      return await textChannel.send(messageOptions);
    }, `sendMessage(${channelId})`);
  }

  async getMessages(channelId: string, options: GetMessagesOptions = {}): Promise<Message[]> {
    return this.retryManager.executeWithRetry(async () => {
      if (!this.isReady()) {
        throw new Error('Discord client is not ready');
      }

      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !('messages' in channel)) {
        throw new Error(`Channel ${channelId} is not a text-based channel`);
      }

      const textChannel = channel as TextChannel | DMChannel | NewsChannel;

      const fetchOptions: any = {
        limit: Math.min(options.limit || 50, 100) // Discord API limit is 100
      };

      if (options.before) fetchOptions.before = options.before;
      if (options.after) fetchOptions.after = options.after;
      if (options.around) fetchOptions.around = options.around;

      const result = await textChannel.messages.fetch(fetchOptions);

      // Handle both single message and collection results
      if (result instanceof Collection) {
        return Array.from(result.values());
      } else {
        // Single message result
        return [result];
      }
    }, `getMessages(${channelId})`);
  }

  async addReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
    return this.retryManager.executeWithRetry(async () => {
      if (!this.isReady()) {
        throw new Error('Discord client is not ready');
      }

      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !('messages' in channel)) {
        throw new Error(`Channel ${channelId} is not a text-based channel`);
      }

      const textChannel = channel as TextChannel | DMChannel | NewsChannel;
      const message = await textChannel.messages.fetch(messageId);

      await message.react(emoji);
    }, `addReaction(${channelId}, ${messageId})`);
  }

  async removeReaction(channelId: string, messageId: string, emoji: string, userId?: string): Promise<void> {
    return this.retryManager.executeWithRetry(async () => {
      if (!this.isReady()) {
        throw new Error('Discord client is not ready');
      }

      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !('messages' in channel)) {
        throw new Error(`Channel ${channelId} is not a text-based channel`);
      }

      const textChannel = channel as TextChannel | DMChannel | NewsChannel;
      const message = await textChannel.messages.fetch(messageId);

      if (userId) {
        // Remove reaction from specific user
        const reactions = message.reactions.cache.find(r => r.emoji.name === emoji || r.emoji.toString() === emoji);
        if (reactions) {
          await reactions.users.remove(userId);
        }
      } else {
        // Remove all reactions of this emoji
        const reactions = message.reactions.cache.find(r => r.emoji.name === emoji || r.emoji.toString() === emoji);
        if (reactions) {
          await reactions.remove();
        }
      }
    }, `removeReaction(${channelId}, ${messageId})`);
  }

  async getMessageReactions(channelId: string, messageId: string, emoji?: string): Promise<any[]> {
    return this.retryManager.executeWithRetry(async () => {
      if (!this.isReady()) {
        throw new Error('Discord client is not ready');
      }

      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !('messages' in channel)) {
        throw new Error(`Channel ${channelId} is not a text-based channel`);
      }

      const textChannel = channel as TextChannel | DMChannel | NewsChannel;
      const message = await textChannel.messages.fetch(messageId);

      if (emoji) {
        // Get users who reacted with specific emoji
        const reaction = message.reactions.cache.find(r => r.emoji.name === emoji || r.emoji.toString() === emoji);
        if (!reaction) {
          return [];
        }

        const users = await reaction.users.fetch();
        return Array.from(users.values()).map(user => ({
          id: user.id,
          username: user.username,
          discriminator: user.discriminator,
          bot: user.bot
        }));
      } else {
        // Get all reactions
        return Array.from(message.reactions.cache.values()).map(reaction => ({
          emoji: reaction.emoji.name || reaction.emoji.toString(),
          count: reaction.count,
          me: reaction.me
        }));
      }
    }, `getMessageReactions(${channelId}, ${messageId})`);
  }

  async getChannel(channelId: string): Promise<Channel | null> {
    return this.retryManager.executeWithRetry(async () => {
      if (!this.isReady()) {
        throw new Error('Discord client is not ready');
      }

      try {
        return await this.client.channels.fetch(channelId);
      } catch (error) {
        // Return null for not found errors instead of throwing
        const discordError = DiscordErrorHandler.handleError(error);
        if (discordError.code === 404) {
          return null;
        }
        throw error;
      }
    }, `getChannel(${channelId})`);
  }

  async getGuildChannels(guildId: string): Promise<NonThreadGuildBasedChannel[]> {
    return this.retryManager.executeWithRetry(async () => {
      if (!this.isReady()) {
        throw new Error('Discord client is not ready');
      }

      const guild = await this.client.guilds.fetch(guildId);
      const channels = await guild.channels.fetch();

      return Array.from(channels.values()).filter((channel): channel is NonThreadGuildBasedChannel => channel !== null);
    }, `getGuildChannels(${guildId})`);
  }

  async getGuilds(): Promise<Guild[]> {
    return this.retryManager.executeWithRetry(async () => {
      if (!this.isReady()) {
        throw new Error('Discord client is not ready');
      }

      // Fetch fresh guild data
      const guilds = await Promise.all(
        this.client.guilds.cache.map(guild => guild.fetch())
      );

      return guilds;
    }, 'getGuilds()');
  }

  async getGuild(guildId: string): Promise<Guild | null> {
    return this.retryManager.executeWithRetry(async () => {
      if (!this.isReady()) {
        throw new Error('Discord client is not ready');
      }

      try {
        return await this.client.guilds.fetch(guildId);
      } catch (error) {
        // Return null for not found errors instead of throwing
        const discordError = DiscordErrorHandler.handleError(error);
        if (discordError.code === 404) {
          return null;
        }
        throw error;
      }
    }, `getGuild(${guildId})`);
  }

  async createChannel(guildId: string, options: CreateChannelOptions): Promise<any> {
    return this.retryManager.executeWithRetry(async () => {
      if (!this.isReady()) {
        throw new Error('Discord client is not ready');
      }

      const guild = await this.client.guilds.fetch(guildId);

      // Build channel options
      const channelOptions: any = {
        name: options.name,
        reason: options.reason || 'Channel created via MCP server'
      };

      // Add optional parameters if provided
      if (options.type !== undefined) {
        channelOptions.type = options.type;
      }
      if (options.topic) {
        channelOptions.topic = options.topic;
      }
      if (options.parent_id) {
        channelOptions.parent = options.parent_id;
      }
      if (options.position !== undefined) {
        channelOptions.position = options.position;
      }
      if (options.nsfw !== undefined) {
        channelOptions.nsfw = options.nsfw;
      }
      if (options.bitrate !== undefined) {
        channelOptions.bitrate = options.bitrate;
      }
      if (options.user_limit !== undefined) {
        channelOptions.userLimit = options.user_limit;
      }
      if (options.rate_limit_per_user !== undefined) {
        channelOptions.rateLimitPerUser = options.rate_limit_per_user;
      }

      // Create the channel
      const channel = await guild.channels.create(channelOptions);

      return channel;
    }, `createChannel(${guildId})`);
  }

  async createThread(channelId: string, options: CreateThreadOptions): Promise<any> {
    return this.retryManager.executeWithRetry(async () => {
      if (!this.isReady()) {
        throw new Error('Discord client is not ready');
      }

      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !('threads' in channel)) {
        throw new Error(`Channel ${channelId} does not support threads`);
      }

      const textChannel = channel as TextChannel | NewsChannel;

      // Build thread options
      const threadOptions: any = {
        name: options.name,
        reason: options.reason || 'Thread created via MCP server'
      };

      // Add optional parameters if provided
      if (options.auto_archive_duration) {
        threadOptions.autoArchiveDuration = options.auto_archive_duration;
      }
      if (options.rate_limit_per_user !== undefined) {
        threadOptions.rateLimitPerUser = options.rate_limit_per_user;
      }

      // Create thread - either from a message or as a new thread
      let thread;
      if (options.message_id) {
        // Create thread from existing message
        const message = await textChannel.messages.fetch(options.message_id);
        thread = await message.startThread(threadOptions);
      } else {
        // Create new thread
        thread = await textChannel.threads.create(threadOptions);
      }

      return thread;
    }, `createThread(${channelId})`);
  }

  async getGuildMembers(guildId: string, options: { limit?: number } = {}): Promise<any[]> {
    return this.retryManager.executeWithRetry(async () => {
      if (!this.isReady()) {
        throw new Error('Discord client is not ready');
      }

      const guild = await this.client.guilds.fetch(guildId);

      // Fetch members with limit (default to 100, max 1000)
      const limit = Math.min(options.limit || 100, 1000);
      const members = await guild.members.fetch({ limit });

      return Array.from(members.values());
    }, `getGuildMembers(${guildId})`);
  }
}