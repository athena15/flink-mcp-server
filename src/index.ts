import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { chromium } from "playwright";

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

		// Playwright web automation tool
		this.server.tool(
			"playwright_navigate",
			{
				url: z.string().url(),
				selector: z.string().optional(),
				action: z.string().optional(),
				text: z.string().optional(),
				screenshot: z.boolean().optional().default(false),
			},
			async ({ url, selector, action, text, screenshot }) => {
				try {
					const browser = await chromium.launch();
					const page = await browser.newPage();
					await page.goto(url);

					let result = `Navigated to ${url}`;

					if (selector && action) {
						switch (action) {
							case "click":
								await page.click(selector);
								result += `\nClicked element: ${selector}`;
								break;
							case "type":
								if (text) {
									await page.fill(selector, text);
									result += `\nTyped "${text}" into element: ${selector}`;
								}
								break;
							case "getText":
								const textContent = await page.textContent(selector);
								result += `\nText from ${selector}: ${textContent}`;
								break;
						}
					}

					if (screenshot) {
						const screenshotBuffer = await page.screenshot();
						result += `\nScreenshot taken (${screenshotBuffer.length} bytes)`;
					}

					await browser.close();
					return { content: [{ type: "text", text: result }] };
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error: ${error instanceof Error ? error.message : String(error)}`,
							},
						],
					};
				}
			}
		);

		// Playwright page content scraping tool
		this.server.tool(
			"playwright_scrape",
			{
				url: z.string().url(),
				selector: z.string().optional(),
				waitFor: z.string().optional(),
			},
			async ({ url, selector, waitFor }) => {
				try {
					const browser = await chromium.launch();
					const page = await browser.newPage();
					await page.goto(url);

					if (waitFor) {
						await page.waitForSelector(waitFor);
					}

					let content: string;
					if (selector) {
						const element = await page.locator(selector);
						content = await element.textContent() || "";
					} else {
						content = await page.content();
					}

					await browser.close();
					return { content: [{ type: "text", text: content }] };
				} catch (error) {
					return {
						content: [
							{
								type: "text",
								text: `Error: ${error instanceof Error ? error.message : String(error)}`,
							},
						],
					};
				}
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
