# Discord MCP Server

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18+-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue.svg)
![Status](https://img.shields.io/badge/status-production-brightgreen.svg)

There is my Discord MCP Server. There are many like it, but this one is mine
It enables MCP clients to interact with Discord servers, channels, and messages.

[Features](#features) • [Installation](#installation) • [Configuration](#configuration) • [Usage](#usage) • [Documentation](#documentation)

</div>

## Overview

This MCP server provides Discord integration for AI assistants like Claude Desktop, enabling natural interaction with Discord servers through a comprehensive set of tools. Built with reliability in mind, it includes robust error handling, automatic rate limiting, and retry mechanisms.

## Features

### 15 Tools

#### 📨 Message Operations
- **send_message** - Send messages with file attachments and control link preview embeds
- **get_messages** - Retrieve message history with user display names
- **add_reaction** - Add emoji reactions (Unicode and custom emojis)
- **remove_reaction** - Remove reactions from messages
- **get_message_reactions** - View reaction data and counts

#### 💬 Direct Messages
- **send_dm** - Send direct messages to users with file support
- **list_dms** - List all accessible DM channels
- **open_dm** - Create or access DM channels

#### 🏢 Server & Channel Management
- **list_servers** - List all Discord servers
- **list_channels** - List channels with permissions
- **create_channel** - Create new channels
- **create_thread** - Create discussion threads

#### 👥 User & Member Management
- **get_user_info** - Get user profiles and display names
- **get_guild_member** - Get member data with roles
- **list_guild_members** - List server members with pagination

## Installation

### Prerequisites
- Node.js 18 or higher
- A Discord Bot Token ([create one here](https://discord.com/developers/applications))
- Claude Desktop or another MCP-compatible client

### Quick Start

1. **Clone and install**
```bash
git clone https://github.com/yourusername/discord-mcp.git
cd discord-mcp
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env and add your Discord bot token:
# DISCORD_BOT_TOKEN=your_token_here
```

3. **Build the project**
```bash
npm run build
```

## Configuration

### Discord Bot Setup

1. **Create a Discord Application**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Navigate to the "Bot" section and create a bot
   - Copy the bot token

2. **Enable Required Intents**
   In the Bot settings, enable these Privileged Gateway Intents:
   - ✅ MESSAGE CONTENT INTENT
   - ✅ SERVER MEMBERS INTENT

3. **Invite Bot to Server**
   - Go to OAuth2 → URL Generator
   - Select scopes: `bot`
   - Select permissions:
     - Read Messages/View Channels
     - Send Messages
     - Read Message History
     - Add Reactions
     - Manage Messages
     - Create Public Threads
     - Manage Channels (for channel creation)

### Claude Desktop Setup

Add to your Claude Desktop config file (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": ["/absolute/path/to/discord-mcp/dist/server.js"],
      "env": {
        "DISCORD_BOT_TOKEN": "your_bot_token_here",
        "LOG_LEVEL": "ERROR"
      }
    }
  }
}
```

Restart Claude Desktop after configuration.

## Usage

Once configured, you can interact with Discord through Claude Desktop naturally:

```
"List my Discord servers"
"Send a message to #general saying hello"
"Get the last 10 messages from the announcements channel"
"Add a 👍 reaction to message ID 123456789"
"Send a DM to user ID 987654321 with an image attachment"
"List all members in the Development server"
"Send a message with this link but don't show the preview: https://example.com"
```

## Documentation

- **[Setup Instructions](./SETUP_INSTRUCTIONS.md)** - Detailed setup and troubleshooting guide
- **[Technical Specification](./TECHNICAL_SPEC.md)** - Architecture and implementation details
- **[Contributing Guidelines](./CONTRIBUTING.md)** - How to contribute to the project

## Development

```bash
# Start in development mode with auto-reload
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check
```

## Troubleshooting

### Common Issues

**"Unknown tool" errors in Claude Desktop**
- Restart Claude Desktop completely after configuration changes
- Verify the path to `dist/server.js` is absolute and correct

**Permission errors**
- Ensure your bot has the required permissions in the Discord server
- Check that both privileged intents are enabled in the Developer Portal

**Connection issues**
- Verify your `DISCORD_BOT_TOKEN` is correct and active
- Check that your bot is invited to at least one Discord server

For more detailed troubleshooting, see [SETUP_INSTRUCTIONS.md](./SETUP_INSTRUCTIONS.md).

## Architecture

Built with TypeScript and Node.js using:
- **discord.js v14** - Discord API client
- **@modelcontextprotocol/sdk** - MCP protocol implementation
- **zod** - Runtime type validation

The server uses a modular architecture with:
- Tool-based organization (messages, servers, users, DMs)
- Base class pattern for consistent error handling
- Comprehensive logging and monitoring
- Production-ready retry and rate-limiting logic

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Acknowledgments

Built for the [Model Context Protocol](https://modelcontextprotocol.io) ecosystem by Anthropic.

---

<div align="center">

**Questions?** Open an [issue](../../issues) or start a [discussion](../../discussions)

Made with ❤️ for the MCP community

</div>
