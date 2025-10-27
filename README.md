# Lua WebSocket Client

A Visual Studio Code extension that enables real-time script execution in Roblox through WebSocket communication.

## Overview

This extension provides a seamless development workflow for Roblox scripting by allowing developers to execute Lua scripts directly from VS Code into connected Roblox clients. It features a WebSocket server that listens for connections, manages multiple clients, and handles script execution with real-time console output logging.

## Features

- **Real-time Script Execution**: Execute scripts instantly in Roblox from VS Code
- **Multi-Client Support**: Connect and manage multiple Roblox clients simultaneously
- **Specific Script Execution**: Configure and execute a specific script file (e.g., loader scripts) with a single hotkey
- **Customizable Keybindings**: Assign custom keyboard shortcuts for all execution commands
- **Execution Notifications**: Optional popup notifications when scripts are sent to clients
- **Live Console Output**: View player output, errors, and debugging information in real-time
- **Status Bar Integration**: Visual indicators showing server state and connection count
- **One-Click Execution**: Quick execute buttons for current and specific scripts
- **Detailed Logging**: Comprehensive output channel with timestamps and severity levels

## Installation

1. Clone or download this repository
2. Run `npm install` to install dependencies
3. Press `Ctrl+Shift+D` (or `Cmd+Shift+D` on macOS) and select "Run Extension" to test
4. Or package as `.vsix` and install via VS Code extensions

## Requirements

- VS Code 1.103.0 or later
- Node.js 14+ (for development)
- ws (WebSocket library) ^8.18.3

## Usage

### Starting the Server

The extension automatically starts the WebSocket server on port `61417` when activated. The status bar will show the connection state:
- **$(watch) Lua Server: Waiting** - Server is ready but no clients connected
- **$(plug) Lua Server: [N] Connected** - N clients are connected and ready

### Executing Scripts

#### Execute Current Script
1. Open a Lua file in VS Code
2. Click the **$(play) Execute Script** button in the status bar (appears when clients connect)
3. Or use the keyboard shortcut: `Ctrl+Shift+E` (or `Cmd+Shift+E` on macOS)
4. The script is sent to all connected clients and executed immediately

#### Execute Specific Script
1. Configure the specific script path in settings (see Configuration below)
2. Click the **$(file-code) Execute Specific** button in the status bar
3. Or use the keyboard shortcut: `Ctrl+Shift+L` (or `Cmd+Shift+L` on macOS)
4. The configured script is executed regardless of which file is currently open

#### Command Palette
Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) and search for:
- **Lua WebSocket: Execute Current Script**
- **Lua WebSocket: Execute Specific Script**
- **Lua WebSocket: Open Settings**

### Viewing Output

All output from connected clients appears in the "Lua WebSocket Server" output channel, including:
- Console messages (print, info, debug)
- Warnings and errors
- Authentication failures
- Compilation errors
- Connection/disconnection logs
- Script execution confirmations

Access the output panel via: **View** → **Output** → **Lua WebSocket Server**

## Configuration

Open VS Code settings (`Ctrl+,` or `Cmd+,`) and search for "Lua WebSocket":

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `luaWebSocket.serverUrl` | string | `ws://localhost:61417/` | WebSocket server URL |
| `luaWebSocket.autoConnect` | boolean | `true` | Automatically connect on extension startup |
| `luaWebSocket.specificScriptPath` | string | `""` | Relative path to a specific script file (e.g., `Script-Loader.lua` or `scripts/loader.lua`) |
| `luaWebSocket.showExecutionNotifications` | boolean | `true` | Show popup notifications when scripts are sent to Roblox clients |

### Customizing Keybindings

1. Open **File** → **Preferences** → **Keyboard Shortcuts** (or `Ctrl+K Ctrl+S`)
2. Search for "Lua WebSocket"
3. Click the pencil icon next to any command to assign a new keybinding

Default keybindings:
- **Execute Current Script**: `Ctrl+Shift+E` (or `Cmd+Shift+E` on macOS)
- **Execute Specific Script**: `Ctrl+Shift+L` (or `Cmd+Shift+L` on macOS)

### Example: Setting Up a Script Loader

1. Create a `Script-Loader.lua` file in your workspace
2. Open Settings → Extensions → Lua WebSocket
3. Set **Specific Script Path** to `Script-Loader.lua`
4. Now press `Ctrl+Shift+L` anytime to execute your loader script, even when editing other files!

## Architecture

### WebSocketManager

The core class handling all WebSocket operations:

- **Initialize**: Sets up the VS Code integration, creates UI elements, and starts the server
- **StartServer**: Creates WebSocket server and handles client connections
- **HandleClientMessage**: Processes incoming client packets and routes to appropriate handlers
- **SendScript**: Broadcasts script content to all connected clients with optional notifications
- **ExecuteCurrentScript**: Executes the currently active script file
- **ExecuteSpecificScript**: Finds and executes the configured specific script from workspace
- **OnConnect/OnUpdate/OnOutput**: Lifecycle and event handlers for client interactions

### Client Communication Protocol

#### Client Identify Event
Clients send identification data on connection:
```json
{
  "op": "client/identify",
  "data": {
    "player": { "id": "...", "name": "..." },
    "process": { "id": "...", "name": "..." },
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

- **ws** ^8.18.3 - WebSocket implementation
- **@vscode/test-electron** ^2.5.2 - Testing utilities (dev)
- **@vscode/vsce** ^3.6.0 - Extension packaging tool (dev)

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

1. Connect to the WebSocket server at `ws://localhost:61417`
2. Send an identify packet on connection
3. Listen for `client/onDidTextDocumentExecute` events
4. Execute received script content
5. Send console output back using appropriate event types

## Troubleshooting

### "No Roblox clients connected"
- Ensure your Roblox client has established a WebSocket connection
- Check that the server is running (green status bar indicator)
- Verify the port matches (default: 61417)

### "Could not find or read script: [path]"
- Verify the `specificScriptPath` setting is correct
- Ensure the file exists in your workspace
- Check that the path is relative to your workspace root
- Use forward slashes (`/`) or backslashes (`\`) depending on your OS

### Server won't start
- Check if port 61417 is already in use
- Try changing the port in `extension.js` (line 16: `this.ServerPort = 61417;`)
- Check the Output panel for error messages

### Scripts not executing
- Verify clients are connected (check status bar)
- Ensure the Lua file is not empty
- Check the Output panel for error details
- Verify script syntax is valid Lua

### Missing clients in output
- Clients may have disconnected; check status bar
- Check network connectivity between client and server
- Verify firewall settings allow WebSocket communication on port 61417

### Notifications not appearing
- Check that `showExecutionNotifications` is enabled in settings
- Notifications may be blocked by VS Code notification settings
- Check **File** → **Preferences** → **Settings** → **Notifications**

## License

This project is released under the MIT License.

## Support & Contributions

For issues, feature requests, or contributions, please refer to the project repository on GitHub:
https://github.com/K3nD4rk-Code-Developer/Wave-Websocket-Execution

## Changelog

### Version 1.0.2
- Added Configurable Hotkeys for Execute Script, and Execute Loader
- Added a setting configurable "Execute Loader" button where you can make it run a specific script
- Added Notifications on event sending