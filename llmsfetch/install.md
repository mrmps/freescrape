# llmfetch

> A CLI tool for fetching web content optimized for LLM consumption, with built-in grep, CSS selection, and semantic filtering.

## Installation

First, check if you have Node.js 18+ installed by running `node --version`. If not installed, install Node.js using your system's package manager or download from nodejs.org.

Install llmfetch globally using npm, yarn, pnpm, or bun - whichever package manager is available in the project or system. The package name is `llmfetch`.

Verify the installation succeeded by running `llmfetch --version`, which should display the version number.

## Alternative: Binary Installation

If you prefer not to use Node.js, download the standalone binary for your platform.

Detect your operating system and CPU architecture:
- For macOS on Apple Silicon, use the darwin-arm64 binary
- For macOS on Intel, use the darwin-x64 binary
- For Linux on x86_64, use the linux-x64 binary
- For Linux on ARM64, use the linux-arm64 binary
- For Windows, use the win-x64.exe binary

Download the appropriate binary from https://github.com/example/llmfetch/releases/latest and extract it to a directory in your PATH. On Unix systems, make the binary executable.

Verify by running `llmfetch --version`.

## MCP Server Setup (Optional)

If you want to use llmfetch with Claude Code, Cursor, or other MCP-compatible AI tools, add it as an MCP server.

For Claude Code, run `claude mcp add llmfetch` to automatically configure the MCP server.

For Cursor, add the following to your MCP configuration file (typically at `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "llmfetch": {
      "command": "npx",
      "args": ["-y", "llmfetch-mcp"]
    }
  }
}
```

Restart your AI tool to load the new MCP server.

## Agent Configuration (Optional)

To make llmfetch available as a skill in Claude Code, add the following to your project's CLAUDE.md or global ~/.claude/CLAUDE.md file:

```markdown
## Web Fetching

When fetching documentation or web content for context, use llmfetch:

- Fetch a page: `llmfetch <url>`
- Filter with regex: `llmfetch <url> --grep "pattern"`
- Select elements: `llmfetch <url> --select "article"`
- Semantic query: `llmfetch <url> --query "your question"`
- Batch fetch: `llmfetch @urls.txt --parallel 10`
- Limit tokens: `llmfetch <url> --max-tokens 8000`
```

## Verification

Test the installation by fetching a page:

```
llmfetch https://example.com
```

You should see clean markdown output. Test grep functionality:

```
llmfetch https://docs.stripe.com/api --grep "authentication" --max-tokens 2000
```

This should return only sections mentioning authentication, truncated to approximately 2000 tokens.

## Configuration (Optional)

Create a configuration file at `~/.llmfetchrc.json` to set defaults:

```json
{
  "maxTokens": 8000,
  "parallel": 10,
  "format": "markdown",
  "cache": true,
  "cacheTTL": 300
}
```

## Troubleshooting

If you encounter SSL errors, ensure your system's CA certificates are up to date.

If fetching fails for JavaScript-heavy sites, install Playwright browsers by running `npx playwright install chromium`. llmfetch will automatically use headless Chrome for dynamic content.

If you hit rate limits, configure a cache directory and enable caching in your config file to avoid repeated fetches.
