import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Authless Calculator",
		version: "1.0.0",
	});

	async init() {
		// Simple addition tool
		this.server.tool(
			"add",
			{ a: z.number(), b: z.number() },
			async ({ a, b }) => ({
				content: [{ type: "text", text: String(a + b) }],
			})
		);

		// Calculator tool with multiple operations
		this.server.tool(
			"calculate",
			{
				operation: z.enum(["add", "subtract", "multiply", "divide"]),
				a: z.number(),
				b: z.number(),
			},
			async ({ operation, a, b }) => {
				let result: number;
				switch (operation) {
					case "add":
						result = a + b;
						break;
					case "subtract":
						result = a - b;
						break;
					case "multiply":
						result = a * b;
						break;
					case "divide":
						if (b === 0)
							return {
								content: [
									{
										type: "text",
										text: "Error: Cannot divide by zero",
									},
								],
							};
						result = a / b;
						break;
				}
				return { content: [{ type: "text", text: String(result) }] };
			}
		);

		// Web scraping tool using fetch
		this.server.tool(
			"scrape_webpage",
			{
				url: z.string().url(),
				selector: z.string().optional(),
				extract_text: z.boolean().optional().default(true),
				user_agent: z.string().optional().default("Mozilla/5.0 (compatible; MCP-Scraper/1.0)"),
			},
			async ({ url, selector, extract_text, user_agent }) => {
				try {
					const response = await fetch(url, {
						headers: {
							'User-Agent': user_agent,
						},
					});

					if (!response.ok) {
						return {
							content: [
								{
									type: "text",
									text: `HTTP Error: ${response.status} ${response.statusText}`,
								},
							],
						};
					}

					const html = await response.text();
					
					if (extract_text) {
						// Simple HTML to text conversion
						const textContent = html
							.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
							.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
							.replace(/<[^>]*>/g, ' ')
							.replace(/\s+/g, ' ')
							.trim();
						
						return {
							content: [
								{
									type: "text",
									text: `URL: ${url}\nLength: ${textContent.length} characters\n\nContent:\n${textContent}`,
								},
							],
						};
					} else {
						return {
							content: [
								{
									type: "text",
									text: `URL: ${url}\nHTML Length: ${html.length} characters\n\nHTML:\n${html}`,
								},
							],
						};
					}
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error scraping ${url}: ${error instanceof Error ? error.message : String(error)}`,
							},
						],
					};
				}
			}
		);

		// URL analysis tool
		this.server.tool(
			"analyze_url",
			{
				url: z.string().url(),
			},
			async ({ url }) => {
				try {
					const response = await fetch(url, {
						method: 'HEAD',
						headers: {
							'User-Agent': 'Mozilla/5.0 (compatible; MCP-Analyzer/1.0)',
						},
					});

					const headers = Object.fromEntries(response.headers.entries());
					
					return {
						content: [
							{
								type: "text",
								text: `URL Analysis: ${url}\nStatus: ${response.status} ${response.statusText}\nContent-Type: ${headers['content-type'] || 'unknown'}\nContent-Length: ${headers['content-length'] || 'unknown'}\nServer: ${headers['server'] || 'unknown'}\nLast-Modified: ${headers['last-modified'] || 'unknown'}`,
							},
						],
					};
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error analyzing ${url}: ${error instanceof Error ? error.message : String(error)}`,
							},
						],
					};
				}
			}
		);
	}
}

function validateApiKey(request: Request): boolean {
	const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "") ||
	             request.headers.get("X-API-Key") ||
	             request.headers.get("api-key") ||
	             new URL(request.url).searchParams.get("api_key");
	
	const validApiKey = env.API_KEY;
	return apiKey === validApiKey;
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Check API key for protected endpoints
		if (url.pathname === "/sse" || url.pathname === "/sse/message" || url.pathname === "/mcp" || url.pathname === "/") {
			if (!validateApiKey(request)) {
				return new Response("Unauthorized: Invalid or missing API key", { 
					status: 401,
					headers: {
						"WWW-Authenticate": "Bearer realm=\"MCP Server\"",
						"Content-Type": "text/plain"
					}
				});
			}
		}

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp" || url.pathname === "/") {
			return MyMCP.serve("/").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
