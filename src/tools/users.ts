import { z } from 'zod';
import { DiscordMCPTool } from './base.js';

// Schema definitions
const GetUserInfoSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  guild_id: z.string().min(1, 'Guild ID is required')
});

const GetGuildMemberSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  guild_id: z.string().min(1, 'Guild ID is required')
});

const ListGuildMembersSchema = z.object({
  guild_id: z.string().min(1, 'Guild ID is required'),
  limit: z.number().min(1).max(1000).optional().describe('Maximum number of members to return (default: 100, max: 1000)')
});

// Get User Info Tool - Comprehensive user information including server-specific data
export class GetUserInfoTool extends DiscordMCPTool {
  name = 'get_user_info';
  description = 'Get comprehensive user information including server-specific display names and nicknames';
  inputSchema = GetUserInfoSchema;

  async execute(params: unknown) {
    return this.executeWithErrorHandling(async () => {
      const validatedParams = this.validateParams(params, GetUserInfoSchema);

      this.logger.info('Fetching user info', {
        tool: this.name,
        userId: validatedParams.user_id,
        guildId: validatedParams.guild_id
      });

      // Get the guild first
      const guild = await this.discord.getGuild(validatedParams.guild_id);
      if (!guild) {
        throw new Error(`Guild ${validatedParams.guild_id} not found`);
      }

      // Get the user globally
      const client = this.discord.getClient();
      const user = await client.users.fetch(validatedParams.user_id);
      if (!user) {
        throw new Error(`User ${validatedParams.user_id} not found`);
      }

      // Get guild member (server-specific info)
      let member = null;
      try {
        member = await guild.members.fetch(validatedParams.user_id);
      } catch (error) {
        // User might not be in the guild
        this.logger.info('User not found in guild', {
          userId: validatedParams.user_id,
          guildId: validatedParams.guild_id
        });
      }

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          global_display_name: user.displayName,
          discriminator: user.discriminator,
          bot: user.bot,
          avatar_url: user.displayAvatarURL(),
          banner_url: user.bannerURL(),
          accent_color: user.accentColor,
          created_at: user.createdAt.toISOString(),
          guild_info: member ? {
            server_display_name: member.displayName,
            server_nickname: member.nickname,
            joined_at: member.joinedAt?.toISOString() || null,
            roles: member.roles.cache.map(role => ({
              id: role.id,
              name: role.name,
              color: role.hexColor,
              position: role.position,
              permissions: role.permissions.toArray()
            })),
            permissions: member.permissions.toArray(),
            is_owner: guild.ownerId === member.id,
            premium_since: member.premiumSince?.toISOString() || null,
            timeout_until: member.communicationDisabledUntil?.toISOString() || null
          } : null
        }
      };
    }, this.name);
  }
}

// Get Guild Member Tool - Server-specific member information
export class GetGuildMemberTool extends DiscordMCPTool {
  name = 'get_guild_member';
  description = 'Get server-specific member information including roles, permissions, and server nickname';
  inputSchema = GetGuildMemberSchema;

  async execute(params: unknown) {
    return this.executeWithErrorHandling(async () => {
      const validatedParams = this.validateParams(params, GetGuildMemberSchema);

      this.logger.info('Fetching guild member', {
        tool: this.name,
        userId: validatedParams.user_id,
        guildId: validatedParams.guild_id
      });

      // Get the guild
      const guild = await this.discord.getGuild(validatedParams.guild_id);
      if (!guild) {
        throw new Error(`Guild ${validatedParams.guild_id} not found`);
      }

      // Get the member
      const member = await guild.members.fetch(validatedParams.user_id);
      if (!member) {
        throw new Error(`Member ${validatedParams.user_id} not found in guild ${validatedParams.guild_id}`);
      }

      return {
        success: true,
        member: {
          user: {
            id: member.user.id,
            username: member.user.username,
            global_display_name: member.user.displayName,
            bot: member.user.bot,
            avatar_url: member.user.displayAvatarURL()
          },
          guild_info: {
            server_display_name: member.displayName,
            server_nickname: member.nickname,
            joined_at: member.joinedAt?.toISOString() || null,
            roles: member.roles.cache.map(role => ({
              id: role.id,
              name: role.name,
              color: role.hexColor,
              position: role.position,
              hoisted: role.hoist,
              mentionable: role.mentionable,
              managed: role.managed,
              permissions: role.permissions.toArray()
            })),
            permissions: member.permissions.toArray(),
            is_owner: guild.ownerId === member.id,
            is_admin: member.permissions.has('Administrator'),
            premium_since: member.premiumSince?.toISOString() || null,
            timeout_until: member.communicationDisabledUntil?.toISOString() || null,
            voice_channel: member.voice.channel ? {
              id: member.voice.channel.id,
              name: member.voice.channel.name,
              muted: member.voice.mute,
              deafened: member.voice.deaf
            } : null
          }
        }
      };
    }, this.name);
  }
}

// List Guild Members Tool - List all members in a server
export class ListGuildMembersTool extends DiscordMCPTool {
  name = 'list_guild_members';
  description = 'List all members in a Discord server with their basic information, roles, and permissions';
  inputSchema = ListGuildMembersSchema;

  async execute(params: unknown) {
    return this.executeWithErrorHandling(async () => {
      const validatedParams = this.validateParams(params, ListGuildMembersSchema);

      this.logger.info('Listing guild members', {
        tool: this.name,
        guildId: validatedParams.guild_id,
        limit: validatedParams.limit || 100
      });

      // Get the guild
      const guild = await this.discord.getGuild(validatedParams.guild_id);
      if (!guild) {
        throw new Error(`Guild ${validatedParams.guild_id} not found`);
      }

      // Fetch members
      const members = await this.discord.getGuildMembers(validatedParams.guild_id, {
        limit: validatedParams.limit
      });

      // Format member data
      const formattedMembers = members.map(member => ({
        user: {
          id: member.user.id,
          username: member.user.username,
          global_display_name: member.user.displayName,
          discriminator: member.user.discriminator,
          bot: member.user.bot,
          avatar_url: member.user.displayAvatarURL()
        },
        guild_info: {
          server_display_name: member.displayName,
          server_nickname: member.nickname,
          joined_at: member.joinedAt?.toISOString() || null,
          roles: member.roles.cache
            .filter((role: any) => role.id !== guild.id) // Exclude @everyone role
            .map((role: any) => ({
              id: role.id,
              name: role.name,
              color: role.hexColor,
              position: role.position
            })),
          is_owner: guild.ownerId === member.id,
          is_admin: member.permissions.has('Administrator'),
          premium_since: member.premiumSince?.toISOString() || null
        }
      }));

      return {
        success: true,
        guild: {
          id: guild.id,
          name: guild.name,
          member_count: guild.memberCount
        },
        members: formattedMembers,
        returned_count: formattedMembers.length
      };
    }, this.name);
  }
}