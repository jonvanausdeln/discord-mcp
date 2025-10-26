# Contributing to Discord MCP Server

Thank you for your interest in contributing to the Discord MCP Server! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- TypeScript knowledge
- Basic understanding of the MCP protocol
- Discord API familiarity (helpful but not required)

### Development Setup

1. **Fork and clone the repository**
```bash
git clone https://github.com/your-username/discord-mcp.git
cd discord-mcp
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment**
```bash
cp .env.example .env
# Add your Discord bot token for testing
```

4. **Build and test**
```bash
npm run build
npm run dev  # Test the server
```

## 🛠️ Development Guidelines

### Code Style
- Use TypeScript with strict type checking
- Follow existing code patterns and structure
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### Project Structure
```
src/
├── server.ts              # Main MCP server
├── discord/
│   ├── client.ts          # Discord client wrapper
│   └── errorHandler.ts    # Error classification
├── tools/                 # MCP tool implementations
│   ├── base.ts           # Base tool class
│   └── messages.ts       # Message-related tools
├── utils/                # Utility functions
└── types/                # Type definitions
```

### Adding New MCP Tools

1. **Create tool class** in `src/tools/[category].ts`:
```typescript
import { z } from 'zod';
import { DiscordMCPTool } from './base.js';

const YourToolSchema = z.object({
  // Define parameters
});

export class YourTool extends DiscordMCPTool {
  name = 'your_tool';
  description = 'Description of what your tool does';
  inputSchema = YourToolSchema;

  async execute(params: unknown) {
    return this.executeWithErrorHandling(async () => {
      const validated = this.validateParams(params, YourToolSchema);

      // Implement your logic here

      return {
        success: true,
        // Your response data
      };
    }, this.name);
  }
}
```

2. **Add JSON schema** in `src/server.ts` (`getToolInputSchema` method)

3. **Register the tool** in `src/server.ts` (`registerTools` method)

4. **Test thoroughly** with Claude Desktop or MCP test client

### Error Handling
- Always use the base class error handling (`executeWithErrorHandling`)
- Classify errors appropriately (retryable vs non-retryable)
- Provide user-friendly error messages
- Include context for debugging

### Testing
- Test new tools with actual Discord API calls
- Verify MCP protocol compliance
- Test error scenarios and edge cases
- Ensure Claude Desktop integration works

## 📋 Contribution Types

## 🔄 Pull Request Process

1. **Create a feature branch**
```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes**
- Follow coding standards
- Add/update tests if applicable
- Update documentation

3. **Test thoroughly**
```bash
npm run build
npm run type-check
# Test with Discord API
```

4. **Commit with clear messages**
```bash
git commit -m "feat: add list_servers MCP tool

- Implements server listing functionality
- Adds proper error handling and validation
- Updates documentation"
```

5. **Submit pull request**
- Use the PR template
- Link related issues
- Provide testing instructions

## 📚 Resources

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Discord.js Documentation](https://discord.js.org/)
- [Discord API Documentation](https://discord.com/developers/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 📞 Questions?

- **Technical questions**: Open a GitHub Discussion
- **Bug reports**: Create a GitHub Issue
- **Feature requests**: Create a GitHub Issue with the feature template

Thank you for contributing! 🚀