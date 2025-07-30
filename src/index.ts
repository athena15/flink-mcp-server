import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import FirecrawlApp from "@mendable/firecrawl-js";

let globalEnv: Env;

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Flink MCP Server",
		version: "1.0.0",
	});

	static setEnv(env: Env) {
		globalEnv = env;
	}

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

		// Firecrawl price extraction tool
		this.server.tool(
			"firecrawl_price_extract",
			{
				url: z.string().url(),
				product_name: z.string().optional(),
			},
			async ({ url, product_name }) => {
				try {
					if (!globalEnv?.FIRECRAWL_API_KEY) {
						return {
							content: [
								{
									type: "text",
									text: "Error: FIRECRAWL_API_KEY environment variable not configured",
								},
							],
						};
					}
					const firecrawl = new FirecrawlApp({ 
						apiKey: globalEnv.FIRECRAWL_API_KEY 
					});

					const prompt = product_name 
						? `Extract the price for "${product_name}" from this webpage. Return only the numerical price value (e.g., "29.99").`
						: "Extract the main product price from this webpage. Return only the numerical price value (e.g., \"29.99\").";

					const extractResult = await firecrawl.extract([url], {
						prompt: prompt,
						schema: {
							type: "object",
							properties: {
								price: {
									type: "string",
									description: "The numerical price value"
								}
							},
							required: ["price"]
						}
					});

					if (extractResult.success && extractResult.data?.price) {
						return {
							content: [
								{
									type: "text",
									text: extractResult.data.price,
								},
							],
						};
					} else {
						return {
							content: [
								{
									type: "text",
									text: "Price not found",
								},
							],
						};
					}
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error extracting price: ${error instanceof Error ? error.message : String(error)}`,
							},
						],
					};
				}
			}
		);

		// Firecrawl search tool to find product URLs
		this.server.tool(
			"firecrawl_find_product_url",
			{
				product_name: z.string(),
				retailer: z.enum(["walmart", "bestbuy", "target", "amazon"]),
			},
			async ({ product_name, retailer }) => {
				try {
					if (!globalEnv?.FIRECRAWL_API_KEY) {
						return {
							content: [
								{
									type: "text",
									text: "Error: FIRECRAWL_API_KEY environment variable not configured",
								},
							],
						};
					}
					const firecrawl = new FirecrawlApp({ 
						apiKey: globalEnv.FIRECRAWL_API_KEY 
					});

					// Construct search query for each retailer
					let searchQuery = "";
					switch (retailer) {
						case "walmart":
							searchQuery = `site:walmart.com ${product_name}`;
							break;
						case "bestbuy":
							searchQuery = `site:bestbuy.com ${product_name}`;
							break;
						case "target":
							searchQuery = `site:target.com ${product_name}`;
							break;
						case "amazon":
							searchQuery = `site:amazon.com ${product_name}`;
							break;
					}

					const searchResult = await firecrawl.search(searchQuery, {
						limit: 3
					});

					if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
						// Return the first result URL
						const firstResult = searchResult.data[0];
						return {
							content: [
								{
									type: "text",
									text: firstResult.url || "URL not available",
								},
							],
						};
					} else {
						return {
							content: [
								{
									type: "text",
									text: "URL not found",
								},
							],
						};
					}
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error finding URL: ${error instanceof Error ? error.message : String(error)}`,
							},
						],
					};
				}
			}
		);
	}
}

function validateApiKey(request: Request, env: Env): boolean {
	const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "") ||
	             request.headers.get("X-API-Key") ||
	             request.headers.get("api-key") ||
	             new URL(request.url).searchParams.get("api_key");
	
	if (!env.API_KEY) {
		throw new Error("API_KEY environment variable must be configured");
	}
	const validApiKey = env.API_KEY;
	return apiKey === validApiKey;
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Check API key for protected endpoints
		if (url.pathname === "/sse" || url.pathname === "/sse/message" || url.pathname === "/mcp" || url.pathname === "/") {
			if (!validateApiKey(request, env)) {
				return new Response("Unauthorized: Invalid or missing API key", { 
					status: 401,
					headers: {
						"WWW-Authenticate": "Bearer realm=\"MCP Server\"",
						"Content-Type": "text/plain"
					}
				});
			}
		}

		MyMCP.setEnv(env);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp" || url.pathname === "/") {
			return MyMCP.serve("/").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
