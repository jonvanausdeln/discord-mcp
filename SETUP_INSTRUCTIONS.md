# Discord MCP Server Setup Instructions

## Quick Start

1. **Install dependencies and build:**
   ```bash
   npm install
   npm run build
   ```

2. **Configure your Discord bot token in `.env`:**
   ```bash
   DISCORD_BOT_TOKEN=your_actual_bot_token_here
   ```

3. **Test the server locally:**
   ```bash
   npm run dev
   ```

## Claude Desktop Configuration

### Step 1: Locate Claude Desktop Config File

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### Step 2: Add MCP Server Configuration

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": [
"/absolute/path/to/discord-mcp/dist/server.js"
      ],
      "env": {
        "DISCORD_BOT_TOKEN": "your_discord_bot_token_here",
        "LOG_LEVEL": "ERROR"
      }
    }
  }
}
```

**Important Notes:**
- Use the **full absolute path** to your `dist/server.js` file
- Make sure to run `npm run build` first to create the `dist` folder
- Replace `your_discord_bot_token_here` with your actual Discord bot token
- Use forward slashes `/` or double backslashes `\\\\` in Windows paths

### Step 3: Restart Claude Desktop

Close and reopen Claude Desktop completely for the configuration to take effect.

### Step 4: Verify Connection

In Claude Desktop, you should now be able to use Discord tools:

```
Can you list the available Discord tools?
```

Claude should respond with the available tools: `send_message` and `get_messages`.

## Claude Code (CLI) Configuration

### Option 1: Global MCP Configuration

Create or edit `~/.claude/mcp_config.json`:

```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": [
"/absolute/path/to/discord-mcp/dist/server.js"
      ],
      "env": {
        "DISCORD_BOT_TOKEN": "your_discord_bot_token_here",
        "LOG_LEVEL": "ERROR"
      }
    }
  }
}
```

### Option 2: Project-Specific Configuration

In your project directory, create `.claude/mcp_config.json`:

```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": [
        "./dist/server.js"
      ],
      "env": {
        "DISCORD_BOT_TOKEN": "your_discord_bot_token_here",
        "LOG_LEVEL": "ERROR"
      }
    }
  }
}
```

### Using with Claude Code

```bash
# Start Claude Code with MCP servers
claude-code --mcp-config ~/.claude/mcp_config.json

# Or if using project-specific config
cd /path/to/your/project
claude-code
```

## ✅ TESTED & WORKING Setup

### 1. Test Server Startup
```bash
cd /path/to/discord-mcp
npm run dev
```

You should see logs like:
```json
{"level":"info","message":"Starting Discord MCP Server...","timestamp":"..."}
{"level":"info","message":"Discord client connected successfully","timestamp":"..."}
{"level":"info","message":"Discord MCP Server started successfully","timestamp":"..."}
```

**CRITICAL FIX:** Use `LOG_LEVEL=ERROR` in Claude Desktop config to prevent parsing issues.

### 2. Test in Claude Desktop/Code

Try these commands:

**List available tools:**
```
What Discord tools are available?
```

**Send a test message:**
```
Send a test message "Hello from Claude!" to Discord channel ID 123456789
```

**Get recent messages:**
```
Get the last 10 messages from Discord channel ID 123456789
```

## Troubleshooting

### Common Issues

**1. "Unknown tool: send_message"**
- MCP server not properly registered
- Check your config file path and syntax
- Make sure you restarted Claude Desktop

**2. "Discord client is not ready"**
- Invalid Discord bot token
- Bot doesn't have access to the server/channel
- Network connectivity issues

**3. "Permission denied" errors**
- Bot missing required permissions:
  - Read Message History
  - Send Messages
  - View Channels

**4. "Module not found" errors**
- Run `npm run build` to create the `dist` folder
- Check the absolute path in your config

### Enable Debug Logging

Set `LOG_LEVEL=DEBUG` in your environment or config:

```json
{
  "mcpServers": {
    "discord": {
      "command": "node",
      "args": ["..."],
      "env": {
        "DISCORD_BOT_TOKEN": "...",
        "LOG_LEVEL": "DEBUG"
      }
    }
  }
}
```

### View Logs

The MCP server logs will appear in:
- Claude Desktop: Check the application logs/console
- Claude Code: Logs appear in the terminal where you started it

## Discord Bot Permissions

Make sure your Discord bot has these permissions in the servers/channels you want to use:

### Required Permissions:
- ✅ View Channels
- ✅ Read Message History
- ✅ Send Messages
- ✅ Send Messages in Threads (for thread support)
- ✅ Read Message History (for DMs, if using DM features)

### To Add Permissions:
1. Go to Discord Developer Portal
2. Select your application/bot
3. Go to OAuth2 → URL Generator
4. Select "bot" scope and required permissions
5. Use the generated URL to re-invite your bot to servers

## Next Steps

Once everything is working, you can:
1. Add more MCP tools by extending the `src/tools/` directory
2. Configure additional Discord permissions for advanced features
3. Customize logging and error handling in `src/utils/config.ts`