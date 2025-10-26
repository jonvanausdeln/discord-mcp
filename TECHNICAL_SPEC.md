# Discord MCP Server - Technical Specification

## Architecture Overview

### Core Components

#### 1. Discord Client Wrapper (`src/discord/client.ts`)
- Wraps discord.js Client with additional reliability features
- Handles authentication and connection management
- Provides consistent error handling across all Discord operations
- Manages client lifecycle (connect, disconnect, reconnect)

```typescript
interface DiscordClientWrapper {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isReady(): boolean;
  getClient(): Client;
  // Message operations ✅ IMPLEMENTED
  sendMessage(channelId: string, options: SendMessageOptions): Promise<Message>;
  getMessages(channelId: string, options?: GetMessagesOptions): Promise<Message[]>;
  // Reaction operations ✨ NEW - IMPLEMENTED (2025-10-24)
  addReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
  removeReaction(channelId: string, messageId: string, emoji: string, userId?: string): Promise<void>;
  getMessageReactions(channelId: string, messageId: string, emoji?: string): Promise<any[]>;
  // Channel operations ✅ IMPLEMENTED
  getChannel(channelId: string): Promise<Channel | null>;
  getGuildChannels(guildId: string): Promise<NonThreadGuildBasedChannel[]>;
  // Guild operations ✅ IMPLEMENTED
  getGuilds(): Promise<Guild[]>;
  getGuild(guildId: string): Promise<Guild | null>;
  getGuildMembers(guildId: string, options?: { limit?: number }): Promise<any[]>;
  // Thread operations ✅ IMPLEMENTED
  createThread(channelId: string, options: CreateThreadOptions): Promise<ThreadChannel>;
  // Channel creation ✅ IMPLEMENTED
  createChannel(guildId: string, options: CreateChannelOptions): Promise<Channel>;
}
```

#### 2. Rate Limiter (`src/discord/rateLimiter.ts`)
- Implements exponential backoff with jitter
- Respects Discord's rate limit headers
- Queue management for burst requests
- Per-route rate limiting (Discord uses different limits for different endpoints)

```typescript
interface RateLimiter {
  execute<T>(operation: () => Promise<T>, route: string): Promise<T>;
  isRateLimited(route: string): boolean;
  getRemainingRequests(route: string): number;
}
```

#### 3. Error Handler (`src/discord/errorHandler.ts`)
- Classifies Discord API errors into recoverable/non-recoverable
- Provides user-friendly error messages while preserving debug info
- Handles different error types (network, API, permission, rate limit)

```typescript
enum DiscordErrorType {
  RATE_LIMITED = 'rate_limited',
  PERMISSION_DENIED = 'permission_denied',
  NOT_FOUND = 'not_found',
  NETWORK_ERROR = 'network_error',
  UNKNOWN = 'unknown'
}

interface DiscordError {
  type: DiscordErrorType;
  message: string;
  originalError: Error;
  isRetryable: boolean;
  retryAfter?: number;
}
```

#### 4. Retry Logic (`src/utils/retry.ts`)
- Configurable retry attempts with exponential backoff
- Different strategies for different error types
- Circuit breaker pattern for persistent failures

```typescript
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  retryableErrors: DiscordErrorType[];
}
```

#### 5. Structured Logger (`src/utils/logger.ts`)
- JSON-formatted logs for easy parsing
- Request/response logging for Discord API calls
- Performance metrics tracking
- Configurable log levels

```typescript
interface Logger {
  debug(message: string, context?: object): void;
  info(message: string, context?: object): void;
  warn(message: string, context?: object): void;
  error(message: string, error?: Error, context?: object): void;
  logDiscordRequest(method: string, url: string, duration: number): void;
}
```

## MCP Tools Implementation

### Tool Base Class
All MCP tools will extend a base class for consistent error handling:

```typescript
abstract class DiscordMCPTool {
  constructor(
    protected discord: DiscordClientWrapper,
    protected logger: Logger
  ) {}

  abstract execute(params: any): Promise<any>;

  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    toolName: string
  ): Promise<T> {
    // Common retry logic for all tools
  }

  protected validateParams(params: any, schema: any): void {
    // Common parameter validation
  }
}
```

### Individual Tools (15 Working)

#### ✅ 1. send_message (ENHANCED WITH FILE ATTACHMENTS)
```typescript
interface SendMessageParams {
  channel_id: string;
  content: string;
  reply_to?: string; // message ID to reply to
  files?: FileAttachment[]; // ✨ NEW - File attachments (max 10)
}

// File attachment structure:
interface FileAttachment {
  name: string;              // Required - filename to display
  data?: string;             // Base64 encoded data (for small files)
  url?: string;              // URL to fetch from (HTTP/HTTPS)
  path?: string;             // Local file system path
  description?: string;      // Alt text for accessibility
  spoiler?: boolean;         // Mark as spoiler (adds SPOILER_ prefix)
}
```

#### ✅ 2. get_messages (ENHANCED WITH SERVER ALIASES)
```typescript
interface GetMessagesParams {
  channel_id: string;
  limit?: number; // default 50, max 100
  before?: string; // message ID
  after?: string; // message ID
  around?: string; // message ID
}

// Enhanced Response Format with Server Aliases:
interface MessageResponse {
  author: {
    id: string;
    username: string;
    global_display_name: string;          // ✨ NEW
    server_display_name: string;          // ✨ NEW - Server-specific display name
    server_nickname: string | null;       // ✨ NEW - Server nickname (if set)
    bot: boolean;
  };
  // ... other message properties
}
```

#### ✅ 3. list_servers (IMPLEMENTED)
```typescript
interface ListServersParams {
  // No parameters needed - lists all servers bot has access to
}
```

#### ✅ 4. list_channels (IMPLEMENTED)
```typescript
interface ListChannelsParams {
  guild_id: string; // Required - server ID to list channels from
}
```

#### ✅ 5. create_thread (IMPLEMENTED)
```typescript
interface CreateThreadParams {
  channel_id: string; // Required - channel to create thread in
  name: string; // Required - thread name (max 100 chars)
  auto_archive_duration?: number; // Optional - minutes to auto-archive
  message_id?: string; // Optional - create thread from existing message
  reason?: string; // Optional - audit log reason
  rate_limit_per_user?: number; // Optional - slowmode (0-21600 seconds)
}
```

#### ✅ 6. create_channel (IMPLEMENTED)
```typescript
interface CreateChannelParams {
  guild_id: string; // Required - server to create channel in
  name: string; // Required - channel name (max 100 chars)
  type?: number; // Optional - channel type (0=Text, 2=Voice, 4=Category, 5=News, 13=Stage)
  topic?: string; // Optional - channel topic (max 1024 chars, text channels only)
  parent_id?: string; // Optional - parent category ID
  position?: number; // Optional - position in channel list
  nsfw?: boolean; // Optional - NSFW flag (text channels only)
  bitrate?: number; // Optional - voice bitrate (8000-384000, voice channels only)
  user_limit?: number; // Optional - voice user limit (0-99, voice channels only)
  rate_limit_per_user?: number; // Optional - slowmode (0-21600 seconds, text channels only)
  reason?: string; // Optional - audit log reason
}
```

#### ✅ 7. get_user_info (NEW - USER ALIASES)
```typescript
interface GetUserInfoParams {
  user_id: string; // Required - Discord user ID
  guild_id: string; // Required - Server to get server-specific info from
}

// Returns comprehensive user information including server-specific data:
interface UserInfoResponse {
  user: {
    id: string;
    username: string;
    global_display_name: string;
    avatar_url: string;
    created_at: string;
    guild_info: {
      server_display_name: string;        // ✨ Server-specific display name
      server_nickname: string | null;     // ✨ Server-specific nickname
      joined_at: string;
      roles: Role[];
      permissions: string[];
      is_owner: boolean;
    } | null; // null if user not in server
  };
}
```

#### ✅ 8. get_guild_member (NEW - MEMBER DATA)
```typescript
interface GetGuildMemberParams {
  user_id: string; // Required - Discord user ID
  guild_id: string; // Required - Server to get member info from
}

// Returns detailed server-specific member information:
interface GuildMemberResponse {
  member: {
    user: {
      id: string;
      username: string;
      global_display_name: string;
      bot: boolean;
      avatar_url: string;
    };
    guild_info: {
      server_display_name: string;        // ✨ Server-specific display name
      server_nickname: string | null;     // ✨ Server-specific nickname
      joined_at: string;
      roles: DetailedRole[];              // Includes permissions per role
      permissions: string[];              // Computed permissions
      is_owner: boolean;
      is_admin: boolean;
      premium_since: string | null;       // Nitro boost date
      timeout_until: string | null;       // Timeout status
      voice_channel: VoiceChannelInfo | null; // Current voice state
    };
  };
}
```

#### ✅ 9. send_dm (NEW - DIRECT MESSAGES)
```typescript
interface SendDMParams {
  user_id: string; // Required - Discord user ID to send DM to
  content: string; // Required - message content (max 2000 chars)
  files?: FileAttachment[]; // Optional - file attachments (max 10)
}

// Automatically creates or opens DM channel with user
// Returns message information and DM channel ID:
interface SendDMResponse {
  success: boolean;
  message_id: string;
  channel_id: string;              // DM channel ID (can be used with send_message/get_messages)
  user: {
    id: string;
    username: string;
    global_display_name: string;
  };
  content: string;
  timestamp: string;
  attachments: AttachmentInfo[];
}
```

#### ✅ 10. list_dms (NEW - LIST DM CHANNELS)
```typescript
interface ListDMsParams {
  include_closed?: boolean; // Optional - include closed DM channels (default false)
}

// Returns list of all DM channels bot has access to:
interface ListDMsResponse {
  success: boolean;
  dm_count: number;
  dms: Array<{
    channel_id: string;
    type: number;                  // Channel type enum
    user: {
      id: string;
      username: string;
      global_display_name: string;
      bot: boolean;
    } | null;
    created_at: string | null;
  }>;
}

// Note: DM channels may not appear in cache until bot receives a message
// or explicitly opens the channel using open_dm tool
```

#### ✅ 11. open_dm (NEW - OPEN/CREATE DM CHANNEL)
```typescript
interface OpenDMParams {
  user_id: string; // Required - Discord user ID to open DM with
}

// Creates or retrieves existing DM channel with user:
interface OpenDMResponse {
  success: boolean;
  channel_id: string;              // DM channel ID for use with other tools
  user: {
    id: string;
    username: string;
    global_display_name: string;
    bot: boolean;
  };
  created_at: string | null;
  message: string;                 // Helpful message about using the channel_id
}

// This tool is useful for:
// 1. Getting a DM channel ID for use with send_message/get_messages
// 2. Ensuring a DM channel exists before attempting operations
// 3. Finding the channel ID when you only know the user ID
```

#### ✅ 12. list_guild_members (NEW - GUILD MEMBER LISTING)
```typescript
interface ListGuildMembersParams {
  guild_id: string;  // Required - Discord server (guild) ID
  limit?: number;    // Optional - Max members to return (default: 100, max: 1000)
}

// Returns comprehensive member data:
interface ListGuildMembersResponse {
  success: boolean;
  guild: {
    id: string;
    name: string;
    member_count: number;
  };
  members: Array<{
    user: {
      id: string;
      username: string;
      global_display_name: string;
      discriminator: string;
      bot: boolean;
      avatar_url: string | null;
    };
    guild_info: {
      server_display_name: string;
      server_nickname: string | null;
      joined_at: string;
      roles: Array<{
        id: string;
        name: string;
        color: string;
        position: number;
      }>;
      is_owner: boolean;
      is_admin: boolean;
      premium_since: string | null;
    };
  }>;
  returned_count: number;
}
```

#### ✅ 13. add_reaction (NEW - ADD MESSAGE REACTIONS)
```typescript
interface AddReactionParams {
  channel_id: string;   // Required - Discord channel ID containing the message
  message_id: string;   // Required - Discord message ID to add reaction to
  emoji: string;        // Required - Emoji to react with (Unicode or custom)
}

// Supports both Unicode emojis and custom Discord emojis:
// - Unicode: "👍", "❤️", "🎉", etc.
// - Custom: "<:name:id>" format

interface AddReactionResponse {
  success: boolean;
  channel_id: string;
  message_id: string;
  emoji: string;
}
```

#### ✅ 14. remove_reaction (NEW - REMOVE MESSAGE REACTIONS)
```typescript
interface RemoveReactionParams {
  channel_id: string;   // Required - Discord channel ID containing the message
  message_id: string;   // Required - Discord message ID to remove reaction from
  emoji: string;        // Required - Emoji to remove
  user_id?: string;     // Optional - Specific user's reaction to remove
}

// Behavior:
// - If user_id provided: Removes only that user's reaction
// - If no user_id: Removes all reactions of that emoji (requires Manage Messages permission)

interface RemoveReactionResponse {
  success: boolean;
  channel_id: string;
  message_id: string;
  emoji: string;
  user_id?: string;
}
```

#### ✅ 15. get_message_reactions (NEW - GET REACTION DATA)
```typescript
interface GetMessageReactionsParams {
  channel_id: string;   // Required - Discord channel ID containing the message
  message_id: string;   // Required - Discord message ID to get reactions from
  emoji?: string;       // Optional - Filter by specific emoji
}

// Returns different data based on whether emoji is provided:

// Without emoji filter (returns all reactions summary):
interface ReactionsResponse {
  success: boolean;
  channel_id: string;
  message_id: string;
  emoji: null;
  reactions: Array<{
    emoji: string;
    count: number;
    me: boolean;  // True if bot reacted with this emoji
  }>;
}

// With emoji filter (returns users who reacted):
interface ReactorsResponse {
  success: boolean;
  channel_id: string;
  message_id: string;
  emoji: string;
  reactions: Array<{
    id: string;
    username: string;
    discriminator: string;
    bot: boolean;
  }>;
}
```

### Type Definitions (Enhanced)

#### ✨ NEW: CreateThreadOptions
```typescript
export interface CreateThreadOptions {
  name: string;
  auto_archive_duration?: number;
  message_id?: string;
  reason?: string;
  rate_limit_per_user?: number;
}
```

#### ✨ NEW: CreateChannelOptions
```typescript
export interface CreateChannelOptions {
  name: string;
  type?: number;
  topic?: string;
  parent_id?: string;
  position?: number;
  nsfw?: boolean;
  bitrate?: number;
  user_limit?: number;
  rate_limit_per_user?: number;
  reason?: string;
}
```

#### Enhanced: SendMessageOptions
```typescript
export interface FileAttachment {
  name: string;                    // Filename to display in Discord
  data?: string;                   // Base64 encoded file data
  url?: string;                    // URL to fetch file from
  path?: string;                   // Local file path
  description?: string;            // Alt text for images/accessibility
  spoiler?: boolean;              // Mark as spoiler content
}

export interface SendMessageOptions {
  content: string;
  reply_to?: string;
  thread_id?: string; // For sending messages to threads
  files?: FileAttachment[];       // ✨ NEW - File attachments
}
```

## Configuration Management

### Environment Variables
```bash
# Required
DISCORD_BOT_TOKEN=your_bot_token_here

# Optional with defaults
LOG_LEVEL=INFO
MAX_RETRIES=3
RATE_LIMIT_BUFFER_MS=1000
RECONNECT_TIMEOUT_MS=5000
```

### Runtime Configuration
```typescript
interface Config {
  discord: {
    token: string;
    intents: GatewayIntentBits[];
  };
  logging: {
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    format: 'json' | 'text';
  };
  rateLimiting: {
    bufferMs: number;
    maxRetries: number;
  };
  mcp: {
    name: string;
    version: string;
  };
}
```

## Error Handling Strategy

### Error Classification
1. **Recoverable Errors** (retry with backoff):
   - Rate limiting (429)
   - Temporary network issues (5xx)
   - Gateway timeouts

2. **Non-Recoverable Errors** (fail immediately):
   - Authentication errors (401)
   - Permission errors (403)
   - Not found errors (404)
   - Invalid parameters (400)

### Error Response Format
All MCP tools return errors in a consistent format:
```typescript
interface MCPError {
  code: string;
  message: string;
  details?: {
    discordError?: DiscordError;
    retryable: boolean;
    suggestedAction?: string;
  };
}
```

## Dependencies

### Core Dependencies
```json
{
  "discord.js": "^14.x.x",
  "@modelcontextprotocol/sdk": "latest",
  "winston": "^3.x.x",
  "zod": "^3.x.x"
}

{
  "@types/node": "^18.x.x",
  "typescript": "^5.x.x",
  "tsx": "^4.x.x"
}
```

## Testing Strategy

### Unit Tests
- Mock Discord client for testing error scenarios
- Test rate limiting logic with simulated rate limits
- Validate retry mechanisms with controlled failures

### Integration Tests
- Test with real Discord API in development environment
- Validate MCP protocol compliance
- Performance testing under rate limits

## Deployment Considerations

### Process Management
- Graceful shutdown handling
- Connection cleanup on termination
- Health check endpoints

### Monitoring
- Log Discord API response times
- Track rate limit utilization
- Monitor connection stability
- Alert on persistent errors