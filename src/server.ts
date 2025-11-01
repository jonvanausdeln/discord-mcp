#!/usr/bin/env node

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig } from './utils/config.js';
import { createLogger } from './utils/logger.js';
import { DiscordClient } from './discord/client.js';
import { SendMessageTool, GetMessagesTool, AddReactionTool, RemoveReactionTool, GetMessageReactionsTool } from './tools/messages.js';
import { ListServersTool, ListChannelsTool, CreateThreadTool, CreateChannelTool } from './tools/servers.js';
import { GetUserInfoTool, GetGuildMemberTool, ListGuildMembersTool } from './tools/users.js';
import { SendDMTool, ListDMsTool, OpenDMTool } from './tools/dms.js';

class DiscordMCPServer {
  private server: Server;
  private discord: DiscordClient;
  private logger: any;
  private tools: Map<string, any> = new Map();

  constructor() {
    // Load configuration
    const config = loadConfig();
    this.logger = createLogger(config);

    // Initialize Discord client
    this.discord = new DiscordClient(config, this.logger);

    // Initialize MCP server
    this.server = new Server(
      {
        name: config.mcp.name,
        version: config.mcp.version,
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      }
    );

    // Register tools
    this.registerTools();
    this.setupHandlers();
  }

  private registerTools() {
    const tools = [
      new SendMessageTool(this.discord, this.logger),
      new GetMessagesTool(this.discord, this.logger),
      new AddReactionTool(this.discord, this.logger),
      new RemoveReactionTool(this.discord, this.logger),
      new GetMessageReactionsTool(this.discord, this.logger),
      new ListServersTool(this.discord, this.logger),
      new ListChannelsTool(this.discord, this.logger),
      new CreateThreadTool(this.discord, this.logger),
      new CreateChannelTool(this.discord, this.logger),
      new GetUserInfoTool(this.discord, this.logger),
      new GetGuildMemberTool(this.discord, this.logger),
      new ListGuildMembersTool(this.discord, this.logger),
      new SendDMTool(this.discord, this.logger),
      new ListDMsTool(this.discord, this.logger),
      new OpenDMTool(this.discord, this.logger)
    ];

    tools.forEach(tool => {
      this.tools.set(tool.name, tool);
      this.logger.debug(`Registered tool: ${tool.name}`);
    });
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: this.getToolInputSchema(tool.name)
      }));

      this.logger.debug('Listed tools', { count: tools.length });

      return { tools };
    });

    // List prompts (none for now)
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return { prompts: [] };
    });

    // List resources (none for now)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return { resources: [] };
    });

    // Execute tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      this.logger.info('Tool call received', {
        toolName: name,
        hasArguments: !!args
      });

      const tool = this.tools.get(name);
      if (!tool) {
        const error = `Unknown tool: ${name}`;
        this.logger.error(error);
        throw new Error(error);
      }

      try {
        const result = await tool.execute(args);

        this.logger.info('Tool call completed successfully', {
          toolName: name
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        this.logger.error('Tool call failed', error, {
          toolName: name,
          arguments: args
        });

        // Return error in MCP format
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: {
                  message: error instanceof Error ? error.message : String(error),
                  details: (error as any)?.details || null
                }
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    });

    // Handle server errors
    this.server.onerror = (error) => {
      this.logger.error('MCP Server error', error);
    };

    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  private getToolInputSchema(toolName: string): any {
    switch (toolName) {
      case 'send_message':
        return {
          type: "object",
          properties: {
            channel_id: {
              type: "string",
              description: "Discord channel ID to send the message to"
            },
            content: {
              type: "string",
              description: "Message content to send (max 2000 characters)"
            },
            reply_to: {
              type: "string",
              description: "Optional message ID to reply to"
            },
            files: {
              type: "array",
              description: "Optional array of file attachments (max 10 files)",
              maxItems: 10,
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Filename to display in Discord (max 100 characters)",
                    maxLength: 100
                  },
                  data: {
                    type: "string",
                    description: "Base64 encoded file data (for small files). Use for files under 1MB."
                  },
                  url: {
                    type: "string",
                    format: "uri",
                    description: "URL to fetch file from (HTTP/HTTPS only)"
                  },
                  path: {
                    type: "string",
                    description: "Local file system path to read from"
                  },
                  description: {
                    type: "string",
                    description: "Alt text description for accessibility (max 1024 characters)",
                    maxLength: 1024
                  },
                  spoiler: {
                    type: "boolean",
                    description: "Mark file as spoiler content (adds SPOILER_ prefix)",
                    default: false
                  }
                },
                required: ["name"],
                oneOf: [
                  { required: ["data"] },
                  { required: ["url"] },
                  { required: ["path"] }
                ]
              }
            },
            suppress_embeds: {
              type: "boolean",
              description: "Suppress automatic link previews/embeds in the message",
              default: false
            }
          },
          required: ["channel_id", "content"]
        };

      case 'get_messages':
        return {
          type: "object",
          properties: {
            channel_id: {
              type: "string",
              description: "Discord channel ID to get messages from"
            },
            limit: {
              type: "number",
              description: "Number of messages to retrieve (1-100, default 50)",
              minimum: 1,
              maximum: 100,
              default: 50
            },
            before: {
              type: "string",
              description: "Get messages before this message ID"
            },
            after: {
              type: "string",
              description: "Get messages after this message ID"
            },
            around: {
              type: "string",
              description: "Get messages around this message ID"
            }
          },
          required: ["channel_id"]
        };

      case 'add_reaction':
        return {
          type: "object",
          properties: {
            channel_id: {
              type: "string",
              description: "Discord channel ID containing the message"
            },
            message_id: {
              type: "string",
              description: "Discord message ID to add the reaction to"
            },
            emoji: {
              type: "string",
              description: "Emoji to react with (Unicode emoji like '👍' or custom emoji like '<:name:id>')"
            }
          },
          required: ["channel_id", "message_id", "emoji"]
        };

      case 'remove_reaction':
        return {
          type: "object",
          properties: {
            channel_id: {
              type: "string",
              description: "Discord channel ID containing the message"
            },
            message_id: {
              type: "string",
              description: "Discord message ID to remove the reaction from"
            },
            emoji: {
              type: "string",
              description: "Emoji to remove (Unicode emoji like '👍' or custom emoji like '<:name:id>')"
            },
            user_id: {
              type: "string",
              description: "Optional user ID to remove reaction from specific user. If not provided, removes all reactions of this emoji"
            }
          },
          required: ["channel_id", "message_id", "emoji"]
        };

      case 'get_message_reactions':
        return {
          type: "object",
          properties: {
            channel_id: {
              type: "string",
              description: "Discord channel ID containing the message"
            },
            message_id: {
              type: "string",
              description: "Discord message ID to get reactions from"
            },
            emoji: {
              type: "string",
              description: "Optional emoji to filter by. If provided, returns users who reacted with this emoji. If not provided, returns all reactions summary"
            }
          },
          required: ["channel_id", "message_id"]
        };

      case 'list_servers':
        return {
          type: "object",
          properties: {},
          required: []
        };

      case 'list_channels':
        return {
          type: "object",
          properties: {
            guild_id: {
              type: "string",
              description: "Discord server (guild) ID to list channels from"
            }
          },
          required: ["guild_id"]
        };

      case 'create_thread':
        return {
          type: "object",
          properties: {
            channel_id: {
              type: "string",
              description: "Discord channel ID to create the thread in"
            },
            name: {
              type: "string",
              description: "Name of the thread (max 100 characters)",
              maxLength: 100
            },
            auto_archive_duration: {
              type: "number",
              description: "Duration in minutes to automatically archive the thread (60, 1440, 4320, 10080)"
            },
            message_id: {
              type: "string",
              description: "Optional message ID to create thread from (creates thread from existing message)"
            },
            reason: {
              type: "string",
              description: "Reason for creating the thread (appears in audit log)"
            },
            rate_limit_per_user: {
              type: "number",
              description: "Rate limit per user in seconds (0-21600)",
              minimum: 0,
              maximum: 21600
            }
          },
          required: ["channel_id", "name"]
        };

      case 'create_channel':
        return {
          type: "object",
          properties: {
            guild_id: {
              type: "string",
              description: "Discord server (guild) ID to create the channel in"
            },
            name: {
              type: "string",
              description: "Name of the channel (max 100 characters)",
              maxLength: 100
            },
            type: {
              type: "number",
              description: "Channel type: 0=Text, 2=Voice, 4=Category, 5=News, 13=Stage Voice",
              enum: [0, 2, 4, 5, 13]
            },
            topic: {
              type: "string",
              description: "Channel topic/description (max 1024 characters, text channels only)",
              maxLength: 1024
            },
            parent_id: {
              type: "string",
              description: "ID of the parent category channel to place this channel in"
            },
            position: {
              type: "number",
              description: "Position of the channel in the channel list",
              minimum: 0
            },
            nsfw: {
              type: "boolean",
              description: "Whether the channel is NSFW (text channels only)"
            },
            bitrate: {
              type: "number",
              description: "Bitrate for voice channels (8000-384000, voice channels only)",
              minimum: 8000,
              maximum: 384000
            },
            user_limit: {
              type: "number",
              description: "User limit for voice channels (0-99, voice channels only)",
              minimum: 0,
              maximum: 99
            },
            rate_limit_per_user: {
              type: "number",
              description: "Rate limit per user in seconds (0-21600, text channels only)",
              minimum: 0,
              maximum: 21600
            },
            reason: {
              type: "string",
              description: "Reason for creating the channel (appears in audit log)"
            }
          },
          required: ["guild_id", "name"]
        };

      case 'get_user_info':
        return {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "Discord user ID to get information for"
            },
            guild_id: {
              type: "string",
              description: "Discord server (guild) ID to get server-specific information from"
            }
          },
          required: ["user_id", "guild_id"]
        };

      case 'get_guild_member':
        return {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "Discord user ID to get member information for"
            },
            guild_id: {
              type: "string",
              description: "Discord server (guild) ID to get member information from"
            }
          },
          required: ["user_id", "guild_id"]
        };

      case 'list_guild_members':
        return {
          type: "object",
          properties: {
            guild_id: {
              type: "string",
              description: "Discord server (guild) ID to list members from"
            },
            limit: {
              type: "number",
              description: "Maximum number of members to return (default: 100, max: 1000)",
              minimum: 1,
              maximum: 1000,
              default: 100
            }
          },
          required: ["guild_id"]
        };

      case 'send_dm':
        return {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "Discord user ID to send the direct message to"
            },
            content: {
              type: "string",
              description: "Message content to send (max 2000 characters)"
            },
            files: {
              type: "array",
              description: "Optional array of file attachments (max 10 files)",
              maxItems: 10,
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Filename to display in Discord (max 100 characters)",
                    maxLength: 100
                  },
                  data: {
                    type: "string",
                    description: "Base64 encoded file data (for small files). Use for files under 1MB."
                  },
                  url: {
                    type: "string",
                    format: "uri",
                    description: "URL to fetch file from (HTTP/HTTPS only)"
                  },
                  path: {
                    type: "string",
                    description: "Local file system path to read from"
                  },
                  description: {
                    type: "string",
                    description: "Alt text description for accessibility (max 1024 characters)",
                    maxLength: 1024
                  },
                  spoiler: {
                    type: "boolean",
                    description: "Mark file as spoiler content (adds SPOILER_ prefix)",
                    default: false
                  }
                },
                required: ["name"],
                oneOf: [
                  { required: ["data"] },
                  { required: ["url"] },
                  { required: ["path"] }
                ]
              }
            }
          },
          required: ["user_id", "content"]
        };

      case 'list_dms':
        return {
          type: "object",
          properties: {
            include_closed: {
              type: "boolean",
              description: "Include closed DM channels (default false)",
              default: false
            }
          },
          required: []
        };

      case 'open_dm':
        return {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "Discord user ID to open a DM channel with"
            }
          },
          required: ["user_id"]
        };

      default:
        return {
          type: "object",
          properties: {},
          required: []
        };
    }
  }

  async start() {
    try {
      this.logger.info('Starting Discord MCP Server...');

      // Connect to Discord first
      await this.discord.connect();
      this.logger.info('Discord client connected successfully');

      // Start MCP server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      // Ensure we're ready before accepting requests
      process.nextTick(() => {
        this.logger.info('MCP Server ready to accept requests');
      });

      this.logger.info('Discord MCP Server started successfully', {
        toolCount: this.tools.size,
        discordReady: this.discord.isReady()
      });

    } catch (error) {
      this.logger.error('Failed to start Discord MCP Server', error);
      await this.cleanup();
      process.exit(1);
    }
  }

  private async cleanup() {
    this.logger.info('Shutting down Discord MCP Server...');

    try {
      if (this.discord.isReady()) {
        await this.discord.disconnect();
        this.logger.info('Discord client disconnected');
      }

      await this.server.close();
      this.logger.info('MCP Server closed');

    } catch (error) {
      this.logger.error('Error during cleanup', error);
    }
  }
}

// Start the server
try {
  const server = new DiscordMCPServer();
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
} catch (error) {
  console.error('Error creating server:', error);
  process.exit(1);
}