import express from "express";
import { z } from "zod";
import { McpServer } from "../../server/mcp.js";
import { StreamableHTTPServerTransport } from "../../server/streamableHttp.js";
import { CallToolResult, isInitializeRequest } from "../../types.js";
import { chromium, Browser, Page } from "playwright";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "node:crypto";

// Create an MCP server for YouTube screenshot functionality
const getServer = () => {
  const server = new McpServer(
    {
      name: "youtube-screenshot-server",
      version: "1.0.0",
    },
    { capabilities: { logging: {} } }
  );

  let browser: Browser | null = null;
  let page: Page | null = null;

  // Initialize browser
  const initBrowser = async () => {
    if (!browser) {
      browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
        ],
      });
    }
    if (!page) {
      page = await browser.newPage();
      // Set a reasonable viewport size
      await page.setViewportSize({ width: 1920, height: 1080 });
    }
  };

  // Clean up browser resources
  const cleanup = async () => {
    if (page) {
      await page.close();
      page = null;
    }
    if (browser) {
      await browser.close();
      browser = null;
    }
  };

  // Register tool to load YouTube video and take screenshot
  server.tool(
    "youtube-screenshot",
    "Load a YouTube video at a specific timestamp and take a screenshot",
    {
      url: z
        .string()
        .describe(
          "YouTube video URL (can include timestamp parameter like ?t=83)"
        ),
      outputPath: z
        .string()
        .optional()
        .describe(
          "Output path for the screenshot (defaults to ./youtube-screenshot-{timestamp}.png)"
        ),
      waitTime: z
        .number()
        .optional()
        .default(3000)
        .describe(
          "Time to wait after loading before taking screenshot (milliseconds)"
        ),
      quality: z
        .enum(["highest", "hd1080", "hd720", "large", "medium"])
        .optional()
        .default("highest")
        .describe("Video quality preference"),
    },
    async (
      { url, outputPath, waitTime, quality },
      { sendNotification }
    ): Promise<CallToolResult> => {
      try {
        await sendNotification({
          method: "notifications/message",
          params: { level: "info", data: "Initializing browser..." },
        });

        await initBrowser();

        if (!page) {
          throw new Error("Failed to initialize browser page");
        }

        await sendNotification({
          method: "notifications/message",
          params: { level: "info", data: `Loading YouTube video: ${url}` },
        });

        // Navigate to YouTube URL
        await page.goto(url, { waitUntil: "networkidle" });

        // Wait for video player to load
        await page.waitForSelector("video", { timeout: 10000 });

        await sendNotification({
          method: "notifications/message",
          params: {
            level: "info",
            data: "Video player loaded, setting quality...",
          },
        });

        // Try to set video quality
        try {
          // Click on settings gear icon
          await page.click('button[aria-label="Settings"]', { timeout: 5000 });
          await page.waitForTimeout(1000);

          // Click on Quality option
          await page.click('div[role="menuitem"]:has-text("Quality")', {
            timeout: 5000,
          });
          await page.waitForTimeout(1000);

          // Select the desired quality
          const qualityMap = {
            highest: "2160p",
            hd1080: "1080p",
            hd720: "720p",
            large: "480p",
            medium: "360p",
          };

          const targetQuality = qualityMap[quality];

          // Try to click the specific quality, fallback to Auto if not available
          try {
            await page.click(
              `div[role="menuitemradio"]:has-text("${targetQuality}")`,
              { timeout: 3000 }
            );
          } catch {
            // Fallback to Auto quality
            await page.click('div[role="menuitemradio"]:has-text("Auto")', {
              timeout: 3000,
            });
          }

          // Close settings menu by clicking elsewhere
          await page.click("video");
        } catch (error) {
          await sendNotification({
            method: "notifications/message",
            params: {
              level: "warning",
              data: `Could not set video quality: ${error}`,
            },
          });
        }

        await sendNotification({
          method: "notifications/message",
          params: {
            level: "info",
            data: `Waiting ${waitTime}ms for video to stabilize...`,
          },
        });

        // Wait for the specified time to let video load and stabilize
        await page.waitForTimeout(waitTime);

        // Generate output filename if not provided
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = outputPath || `youtube-screenshot-${timestamp}.png`;
        const fullPath = path.resolve(filename);

        await sendNotification({
          method: "notifications/message",
          params: {
            level: "info",
            data: `Taking screenshot and saving to: ${fullPath}`,
          },
        });

        // Take screenshot of the video player area
        const videoElement = await page.$("video");
        if (videoElement) {
          await videoElement.screenshot({
            path: fullPath,
            type: "png",
          });
        } else {
          // Fallback to full page screenshot
          await page.screenshot({
            path: fullPath,
            type: "png",
            fullPage: false,
          });
        }

        // Verify file was created
        try {
          const stats = await fs.stat(fullPath);
          const fileSizeKB = Math.round(stats.size / 1024);

          return {
            content: [
              {
                type: "text",
                text: `Screenshot successfully saved to: ${fullPath}\nFile size: ${fileSizeKB} KB\nVideo URL: ${url}\nQuality setting: ${quality}`,
              },
            ],
          };
        } catch (error) {
          throw new Error(`Screenshot file was not created: ${error}`);
        }
      } catch (error) {
        await sendNotification({
          method: "notifications/message",
          params: { level: "error", data: `Error: ${error}` },
        });

        return {
          content: [
            {
              type: "text",
              text: `Failed to take YouTube screenshot: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register tool to close browser and clean up resources
  server.tool(
    "cleanup-browser",
    "Close the browser and clean up resources",
    {},
    async (_, { sendNotification }): Promise<CallToolResult> => {
      try {
        await sendNotification({
          method: "notifications/message",
          params: { level: "info", data: "Cleaning up browser resources..." },
        });

        await cleanup();

        return {
          content: [
            {
              type: "text",
              text: "Browser resources cleaned up successfully",
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to cleanup browser: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register tool to get current video information
  server.tool(
    "get-video-info",
    "Get information about the currently loaded YouTube video",
    {},
    async (_, { sendNotification }): Promise<CallToolResult> => {
      try {
        if (!page) {
          throw new Error(
            "No browser page available. Please load a video first."
          );
        }

        await sendNotification({
          method: "notifications/message",
          params: { level: "info", data: "Extracting video information..." },
        });

        // Extract video information
        const videoInfo = await page.evaluate(() => {
          const video = document.querySelector("video") as HTMLVideoElement;
          const titleElement = document.querySelector(
            "h1.ytd-video-primary-info-renderer yt-formatted-string"
          );
          const channelElement = document.querySelector("#channel-name a");

          return {
            title: titleElement?.textContent?.trim() || "Unknown",
            channel: channelElement?.textContent?.trim() || "Unknown",
            duration: video ? video.duration : 0,
            currentTime: video ? video.currentTime : 0,
            videoWidth: video ? video.videoWidth : 0,
            videoHeight: video ? video.videoHeight : 0,
            paused: video ? video.paused : true,
            url: window.location.href,
          };
        });

        return {
          content: [
            {
              type: "text",
              text: `Video Information:
Title: ${videoInfo.title}
Channel: ${videoInfo.channel}
Duration: ${Math.round(videoInfo.duration)}s
Current Time: ${Math.round(videoInfo.currentTime)}s
Resolution: ${videoInfo.videoWidth}x${videoInfo.videoHeight}
Status: ${videoInfo.paused ? "Paused" : "Playing"}
URL: ${videoInfo.url}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get video info: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Cleanup on server close
  server.server.onclose = async () => {
    await cleanup();
  };

  return server;
};

const MCP_PORT = 3000;

const app = express();
app.use(express.json());

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// MCP POST endpoint
const mcpPostHandler = async (req: express.Request, res: express.Response) => {
  console.log("Received MCP request:", req.body);
  try {
    // Check for existing session ID
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          console.log(`Session initialized with ID: ${sessionId}`);
          transports[sessionId] = transport;
        },
      });

      // Set up onclose handler to clean up transport when closed
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          console.log(
            `Transport closed for session ${sid}, removing from transports map`
          );
          delete transports[sid];
        }
      };

      // Connect the transport to the MCP server
      const server = getServer();
      await server.connect(transport);

      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      // Invalid request
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }

    // Handle the request with existing transport
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
};

// Handle GET requests for SSE streams
const mcpGetHandler = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
};

// Handle DELETE requests for session termination
const mcpDeleteHandler = async (
  req: express.Request,
  res: express.Response
) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  console.log(`Received session termination request for session ${sessionId}`);

  try {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("Error handling session termination:", error);
    if (!res.headersSent) {
      res.status(500).send("Error processing session termination");
    }
  }
};

// Set up MCP routes
app.post("/mcp", mcpPostHandler);
app.get("/mcp", mcpGetHandler);
app.delete("/mcp", mcpDeleteHandler);

// Start the server
app.listen(MCP_PORT, () => {
  console.log(`YouTube Screenshot MCP Server running on port ${MCP_PORT}`);
  console.log(`Available tools:`);
  console.log(`- youtube-screenshot: Load YouTube video and take screenshot`);
  console.log(`- get-video-info: Get information about current video`);
  console.log(`- cleanup-browser: Clean up browser resources`);
  console.log(`\nMCP endpoint: http://localhost:${MCP_PORT}/mcp`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down server...");

  // Close all active transports to properly clean up resources
  for (const sessionId in transports) {
    try {
      console.log(`Closing transport for session ${sessionId}`);
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }

  console.log("Server shutdown complete");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down server...");

  // Close all active transports to properly clean up resources
  for (const sessionId in transports) {
    try {
      console.log(`Closing transport for session ${sessionId}`);
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }

  console.log("Server shutdown complete");
  process.exit(0);
});
