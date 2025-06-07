import { Client } from "../../client/index.js";
import { StreamableHTTPClientTransport } from "../../client/streamableHttp.js";
import {
  CallToolResultSchema,
  ListToolsResultSchema,
  Tool,
} from "../../types.js";

/**
 * Example client that demonstrates using the YouTube Screenshot MCP server
 */
class YouTubeScreenshotClient {
  private client: Client;
  private serverUrl: string;

  constructor(serverUrl = "http://localhost:3000/mcp") {
    this.serverUrl = serverUrl;
    this.client = new Client(
      {
        name: "youtube-screenshot-client",
        version: "1.0.0",
      },
      { capabilities: {} }
    );
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    console.log(
      `🔗 Connecting to YouTube Screenshot server at ${this.serverUrl}...`
    );

    const transport = new StreamableHTTPClientTransport(
      new URL(this.serverUrl)
    );
    await this.client.connect(transport);

    console.log("✅ Connected successfully");
  }

  /**
   * Take a screenshot of a YouTube video
   */
  async takeScreenshot(
    url: string,
    options: {
      outputPath?: string;
      waitTime?: number;
      quality?: "highest" | "hd1080" | "hd720" | "large" | "medium";
    } = {}
  ): Promise<void> {
    console.log(`📸 Taking screenshot of: ${url}`);

    try {
      const result = await this.client.request(
        {
          method: "tools/call",
          params: {
            name: "youtube-screenshot",
            arguments: {
              url,
              ...options,
            },
          },
        },
        CallToolResultSchema
      );

      if (result.isError) {
        console.error(
          "❌ Screenshot failed:",
          result.content[0]?.text || "Unknown error"
        );
      } else {
        console.log(
          "✅ Screenshot completed:",
          result.content[0]?.text || "Success"
        );
      }
    } catch (error) {
      console.error("❌ Error taking screenshot:", error);
    }
  }

  /**
   * Get information about the current video
   */
  async getVideoInfo(): Promise<void> {
    console.log("📋 Getting video information...");

    try {
      const result = await this.client.request(
        {
          method: "tools/call",
          params: {
            name: "get-video-info",
            arguments: {},
          },
        },
        CallToolResultSchema
      );

      if (result.isError) {
        console.error(
          "❌ Failed to get video info:",
          result.content[0]?.text || "Unknown error"
        );
      } else {
        console.log("📋 Video Information:");
        console.log(result.content[0]?.text || "No information available");
      }
    } catch (error) {
      console.error("❌ Error getting video info:", error);
    }
  }

  /**
   * Clean up browser resources
   */
  async cleanup(): Promise<void> {
    console.log("🧹 Cleaning up browser resources...");

    try {
      const result = await this.client.request(
        {
          method: "tools/call",
          params: {
            name: "cleanup-browser",
            arguments: {},
          },
        },
        CallToolResultSchema
      );

      if (result.isError) {
        console.error(
          "❌ Cleanup failed:",
          result.content[0]?.text || "Unknown error"
        );
      } else {
        console.log(
          "✅ Cleanup completed:",
          result.content[0]?.text || "Success"
        );
      }
    } catch (error) {
      console.error("❌ Error during cleanup:", error);
    }
  }

  /**
   * List available tools
   */
  async listTools(): Promise<void> {
    console.log("🔧 Available tools:");

    try {
      const result = await this.client.request(
        {
          method: "tools/list",
          params: {},
        },
        ListToolsResultSchema
      );

      result.tools.forEach((tool: Tool) => {
        console.log(`  - ${tool.name}: ${tool.description}`);
      });
    } catch (error) {
      console.error("❌ Error listing tools:", error);
    }
  }

  /**
   * Close the client connection
   */
  async close(): Promise<void> {
    await this.client.close();
    console.log("🔌 Client connection closed");
  }
}

/**
 * Example usage
 */
async function main() {
  const client = new YouTubeScreenshotClient();

  try {
    // Connect to server
    await client.connect();

    // List available tools
    await client.listTools();

    // Example: Take screenshot of the provided YouTube video
    const youtubeUrl = "https://youtu.be/nM_6OzE6OJY?t=83";

    await client.takeScreenshot(youtubeUrl, {
      outputPath: "./youtube-screenshot-example.png",
      waitTime: 5000,
      quality: "hd1080",
    });

    // Get video information
    await client.getVideoInfo();

    // Clean up browser resources
    await client.cleanup();
  } catch (error) {
    console.error("❌ Client error:", error);
  } finally {
    // Close client connection
    await client.close();
  }
}

// Export the main function for external use
export { main };

export { YouTubeScreenshotClient };
