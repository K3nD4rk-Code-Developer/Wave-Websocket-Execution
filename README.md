# Lua WebSocket Client

A Visual Studio Code extension that enables real-time script execution in Roblox through WebSocket communication.

## Overview

This extension provides a seamless development workflow for Roblox scripting by allowing developers to execute Lua scripts directly from VS Code into connected Roblox clients. It features a WebSocket server that listens for connections, manages multiple clients, and handles script execution with real-time console output logging.

## Features

- **Real-time Script Execution**: Execute scripts instantly in Roblox from VS Code
- **Multi-Client Support**: Connect and manage multiple Roblox clients simultaneously
- **Live Console Output**: View player output, errors, and debugging information in real-time
- **Status Bar Integration**: Visual indicators showing server state and connection count
- **One-Click Execution**: Quick execute button for the current document
- **Detailed Logging**: Comprehensive output channel with timestamps and severity levels

## Installation

1. Clone or download this repository
2. Run `npm install` to install dependencies
3. Press `Ctrl+Shift+D` (or `Cmd+Shift+D` on macOS) and select "Run Extension" to test
4. Or package as `.vsix` and install via VS Code extensions

## Requirements

- VS Code 1.103.0 or later
- Node.js 14+ (for development)
- ws (WebSocket library) ^8.14.2

## Usage

### Starting the Server

The extension automatically starts the WebSocket server on port `61416` when activated. The status bar will show the connection state:
- **$(watch) Lua Server: Waiting** - Server is ready but no clients connected
- **$(plug) Lua Server: [N] Connected** - N clients are connected and ready

### Executing Scripts

1. Open a Lua file in VS Code
2. Click the **$(play) Execute Script** button in the status bar (appears when clients connect)
3. The script is sent to all connected clients and executed immediately

Alternatively, use the command palette:
- Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
- Search for "Execute Script"
- Select the command

### Viewing Output

All output from connected clients appears in the "Lua WebSocket Server" output channel, including:
- Console messages (print, info, debug)
- Warnings and errors
- Authentication failures
- Compilation errors
- Connection/disconnection logs

Access the output panel via: **View** → **Output** → **Lua WebSocket Server**

## Configuration

### Server Port

The default server port is `61416`. To modify:

Open `extension.js` and change:
```javascript
this.ServerPort = 61416;
```

## Architecture

### WebSocketManager

The core class handling all WebSocket operations:

- **Initialize**: Sets up the VS Code integration, creates UI elements, and starts the server
- **StartServer**: Creates WebSocket server and handles client connections
- **HandleClientMessage**: Processes incoming client packets and routes to appropriate handlers
- **SendScript**: Broadcasts script content to all connected clients
- **OnConnect/OnUpdate/OnOutput**: Lifecycle and event handlers for client interactions

### Client Communication Protocol

#### Client Identify Event
Clients send identification data on connection:
```json
{
  "op": "client/identify",
  "data": {
    "player": { "id": "...", "name": "..." },
    "game": { "name": "..." }
  }
}
```

#### Script Execution Event
Server sends scripts to execute:
```json
{
  "op": "client/onDidTextDocumentExecute",
  "data": {
    "textDocument": {
      "text": "-- Lua script content here"
    }
  }
}
```

#### Output Events
Clients report console/error output:
```json
{
  "op": "client/console/print|error|warning|info|debug",
  "data": {
    "message": "Output message"
  }
}
```

## Project Structure

```
.
├── extension.js          # Main extension file
├── package.json          # Dependencies and configuration
├── package-lock.json     # Locked dependency versions
└── README.md            # This file
```

## Dependencies

- **ws** ^8.14.2 - WebSocket implementation
- **vscode** - VS Code API (dev dependency)
- **typescript** ^5.9.2 - TypeScript support (dev)

See `package.json` for complete dependency list.

## Development

### Building

No build step required for basic development. The extension uses plain JavaScript.

### Testing

To test the extension:
1. Press `F5` or go to **Run** → **Start Debugging**
2. A new VS Code window opens with the extension loaded
3. Create or open Lua files and test execution

### Debugging

Use the VS Code debugger while the extension runs. Output appears in the Debug Console.

## Client-Side Implementation

To use this extension, clients (Roblox scripts) must:

1. Connect to the WebSocket server at `ws://localhost:61416`
2. Send an identify packet on connection
3. Listen for `client/onDidTextDocumentExecute` events
4. Execute received script content
5. Send console output back using appropriate event types

## Troubleshooting

### "No Roblox clients connected"
- Ensure your Roblox client has established a WebSocket connection
- Check that the server is running (green status bar indicator)
- Verify the port matches (default: 61416)

### Server won't start
- Check if port 61416 is already in use
- Try changing the port in `extension.js`
- Check the Output panel for error messages

### Scripts not executing
- Verify clients are connected (check status bar)
- Ensure the Lua file is not empty
- Check the Output panel for error details
- Verify script syntax is valid Lua

### Missing clients in output
- Clients may have disconnected; check status bar
- Check network connectivity between client and server
- Verify firewall settings allow WebSocket communication on port 61416

## License

This project is released under the MIT License.

## Support & Contributions

For issues, feature requests, or contributions, please refer to the project repository on GitHub.

## Changelog

### Version 1.0.0
- Initial release
- WebSocket server for client connections
- Script execution to multiple clients
- Real-time console output logging
- VS Code UI integration with status bar