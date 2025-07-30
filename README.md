# Remote MCP server example

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fathena15%2Fflink-mcp-server)

## Setup in three easy commands

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/athena15/flink-mcp-server.git
   cd flink-mcp-server
   npm install
   ```

2. **Set your secrets (secure API keys):**
   ```bash
   wrangler secret put API_KEY
   wrangler secret put FIRECRAWL_API_KEY
   ```
   
   When prompted, enter:
   - `API_KEY`: Your custom API key for server access (create any secure string)
   - `FIRECRAWL_API_KEY`: Get yours from [firecrawl.dev](https://firecrawl.dev)

3. **Deploy:**
   ```bash
   npm run deploy
   ```

That's it! Your MCP server is live at `flink-mcp-server.<your-account>.workers.dev`

##  Available Tools
These are included for demo purposes. By all means, build upon this remote MCP server, add your own tools, and make it your own.

- **Calculator**: Basic math operations (add, subtract, multiply, divide)
- **Web Scraper**: Extract text content from any webpage
- **URL Analyzer**: Get metadata and headers from URLs
- **Price Extractor**: Extract product prices using AI (Firecrawl)
- **Product Search**: Find product URLs on major retailers (Walmart, Amazon, Best Buy, Target)

## Adding Additional Secrets

Need to add more secrets like Gmail credentials? Just run:
```bash
wrangler secret put GMAIL_USERNAME
wrangler secret put GMAIL_PASSWORD
```

## Adding Custom Tools

Add new tools in `src/index.ts` within the `init()` method:
```typescript
this.server.tool(
  "your_tool_name",
  { param: z.string() },
  async ({ param }, { env }) => {
    // Access secrets via env.YOUR_SECRET_NAME
    return { content: [{ type: "text", text: "Result" }] };
  }
);
``` 
