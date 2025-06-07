# YouTube Screenshot MCP Server

This MCP server provides tools to load YouTube videos at specific timestamps and take screenshots using browser automation with Playwright.

## Features

- **Load YouTube videos**: Navigate to any YouTube URL with optional timestamp parameters
- **High-quality screenshots**: Capture screenshots of the video player at the highest available quality
- **Quality control**: Choose from different video quality settings (highest, hd1080, hd720, large, medium)
- **Video information**: Extract metadata about the currently loaded video
- **Browser management**: Automatic browser lifecycle management with cleanup

## Prerequisites

Before running the server, you need to install Playwright browsers:

```bash
# Install Playwright browsers
npx playwright install chromium
```

## Installation

1. Install dependencies (including Playwright):

```bash
npm install
```

2. Install Playwright browsers:

```bash
npx playwright install chromium
```

## Usage

### Starting the Server

```bash
# From the project root
npx tsx src/examples/server/youtubeScreenshotServer.ts
```

The server will start on port 3000 by default.

### Available Tools

#### 1. `youtube-screenshot`

Takes a screenshot of a YouTube video at a specific timestamp.

**Parameters:**

- `url` (string, required): YouTube video URL (can include timestamp parameter like `?t=83`)
- `outputPath` (string, optional): Output path for the screenshot (defaults to `./youtube-screenshot-{timestamp}.png`)
- `waitTime` (number, optional): Time to wait after loading before taking screenshot in milliseconds (default: 3000)
- `quality` (enum, optional): Video quality preference - `highest`, `hd1080`, `hd720`, `large`, `medium` (default: `highest`)

**Example:**

```json
{
  "method": "tools/call",
  "params": {
    "name": "youtube-screenshot",
    "arguments": {
      "url": "https://youtu.be/nM_6OzE6OJY?t=83",
      "outputPath": "./my-screenshot.png",
      "waitTime": 5000,
      "quality": "hd1080"
    }
  }
}
```

#### 2. `get-video-info`

Gets information about the currently loaded YouTube video.

**Parameters:** None

**Returns:** Video title, channel, duration, current time, resolution, status, and URL.

#### 3. `cleanup-browser`

Closes the browser and cleans up resources.

**Parameters:** None

### Using the Client Example

```bash
# Run the example client
npx tsx src/examples/client/youtubeScreenshotClient.ts
```

Or use it programmatically:

```typescript
import { YouTubeScreenshotClient } from "./src/examples/client/youtubeScreenshotClient.js";

const client = new YouTubeScreenshotClient("http://localhost:3000");

await client.connect();

// Take a screenshot
await client.takeScreenshot("https://youtu.be/nM_6OzE6OJY?t=83", {
  outputPath: "./screenshot.png",
  quality: "hd1080",
  waitTime: 5000,
});

// Get video info
await client.getVideoInfo();

// Clean up
await client.cleanup();
await client.close();
```

## Example Workflow

1. **Start the server:**

   ```bash
   npx tsx src/examples/server/youtubeScreenshotServer.ts
   ```

2. **Take a screenshot of the example video:**

   ```bash
   curl -X POST http://localhost:3000 \
     -H "Content-Type: application/json" \
     -d '{
       "method": "tools/call",
       "params": {
         "name": "youtube-screenshot",
         "arguments": {
           "url": "https://youtu.be/nM_6OzE6OJY?t=83",
           "outputPath": "./youtube-screenshot.png",
           "quality": "hd1080"
         }
       }
     }'
   ```

3. **Check the screenshot file:**
   The screenshot will be saved to the specified path (or a timestamped filename if no path is provided).

## Configuration

### Browser Settings

The server uses Chromium with the following optimizations:

- Headless mode for better performance
- 1920x1080 viewport for high-quality screenshots
- Disabled GPU acceleration for stability
- No sandbox mode for Docker compatibility

### Quality Settings

- `highest`: Attempts to use 2160p (4K) quality
- `hd1080`: Uses 1080p quality
- `hd720`: Uses 720p quality
- `large`: Uses 480p quality
- `medium`: Uses 360p quality

If the requested quality is not available, the server will fall back to "Auto" quality.

## Error Handling

The server includes comprehensive error handling:

- Browser initialization failures
- Network connectivity issues
- YouTube loading problems
- Quality setting failures (with graceful fallbacks)
- File system errors

All errors are reported through the MCP protocol with detailed error messages.

## Cleanup

The server automatically cleans up browser resources when:

- The `cleanup-browser` tool is called
- The server is shut down (SIGINT/SIGTERM)
- The MCP server connection is closed

## Troubleshooting

### Browser Installation Issues

If you get browser-related errors, ensure Playwright browsers are installed:

```bash
npx playwright install chromium
```

### Permission Issues

On Linux systems, you might need to install additional dependencies:

```bash
# Ubuntu/Debian
sudo apt-get install -y libnss3 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2

# Or use Docker with --no-sandbox flag (already included in the server)
```

### YouTube Access Issues

- Ensure you have internet connectivity
- Some corporate networks may block YouTube access
- YouTube may occasionally block automated access - try again later

### Screenshot Quality

- Higher quality settings require more bandwidth and time
- If quality setting fails, the server will use "Auto" quality
- Increase `waitTime` if videos are not fully loaded before screenshot
