const vscode = require('vscode');
const WS = require('ws');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');

const ClientEvent = {
    Identify: "client/identify",
    Ping: "client/ping",
    Pong: "client/pong",

    ConsoleError: "client/console/error",
    ConsoleWarning: "client/console/warning",
    ConsolePrint: "client/console/print",
    ConsoleInfo: "client/console/info",
    ConsoleDebug: "client/console/debug",
    ConsoleClear: "client/console/clear",

    AuthenticationError: "client/authentication/error",
    CompilerError: "client/compiler/error",
};

class WebSocketManager {
    constructor() {
        this.WebSocketServer = null;
        this.ConnectionState = "Waiting";
        this.ServerPort = 61417;
        this.StatusBarItem = null;
        this.ExecuteButton = null;
        this.ExecuteSpecificButton = null;
        this.SelectClientsButton = null;
        this.OutputChannel = null;
        this.ConnectedClients = 0;
        this.Clients = new Map();
        this.SelectedClients = new Set(); // Store selected client IDs
        this.SelectionMode = 'all'; // 'all' or 'selected'
    }

    Initialize(Context) {
        this.OutputChannel = vscode.window.createOutputChannel('Lua WebSocket Server');
        this.Context = Context;
        this.CreateStatusBar();
        this.RegisterCommands(Context);
        this.StartServer(Context);

        Context.subscriptions.push(this.StatusBarItem);
        Context.subscriptions.push(this.OutputChannel);
    }

    LogMessage(Message, Level = 'INFO') {
        const Timestamp = new Date().toLocaleTimeString();
        const FormattedMessage = `[${Timestamp}] [${Level}] ${Message}`;

        this.OutputChannel.appendLine(FormattedMessage);
        console.log(FormattedMessage);
    }

    CreateStatusBar() {
        this.StatusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );

        this.UpdateStatusBar(false);
        this.StatusBarItem.show();
    }

    UpdateStatusBar(green) {
        const StatusIcon = green ? "$(plug)" : "$(watch)";
        const StatusColor = green ? "#4CAF50" : "#FFA726";

        this.StatusBarItem.text = `${StatusIcon} Lua Server: ${this.ConnectionState}`;
        this.StatusBarItem.color = StatusColor;
        this.StatusBarItem.tooltip = `WebSocket server is ${this.ConnectionState.toLowerCase()}`;
    }

    SetConnectionState(NewState, green) {
        if (this.ConnectionState !== NewState) {
            this.ConnectionState = NewState;
            this.UpdateStatusBar(green);
        }
    }

    StartServer(Context) {
        try {
            this.WebSocketServer = new WebSocketServer({ port: this.ServerPort });

            this.WebSocketServer.on('connection', (WebSocketClient) => {
                this.SetConnectionState(`${++this.ConnectedClients} Connected`, true);
                if (!this.ExecuteButton) this.CreateExecutionButtons();
                const id = require('crypto').randomUUID();
                WebSocketClient._id = id;
                WebSocketClient.on('message', (Data) => {
                    const Message = Data.toString();
                    this.HandleClientMessage(WebSocketClient, Message);
                });

                WebSocketClient.on('close', () => {
                    this.HandleClientDisconnection(WebSocketClient);
                });

                WebSocketClient.on('error', (Error) => {
                    this.LogMessage(`Client: ${Error.message}`, 'ERROR');
                });
            });

            this.WebSocketServer.on('error', (Error) => {
                this.LogMessage(`Server: ${Error.message}`, 'ERROR');
            });

            this.LogMessage(`Started on port ${this.ServerPort}`, "SERVER");
            this.SetConnectionState("Waiting");

        } catch (Error) {
            this.LogMessage(`Server: ${Error.message}`, 'ERROR');
        }
    }

    HandleClientMessage(Client, Message) {
        var packet;
        try {
            packet = (typeof Message === "string") ? JSON.parse(Message) : Message;
        } catch (e) {
            return;
        }
        if (!packet) throw new Error("Packet is null.");
        var Op = packet.op;
        var Data = packet.data;

        var self = this;
        function clientsContains(id) {
            return self.Clients && self.Clients.has(id);
        }

        switch (Op) {
            case ClientEvent.Identify: {
                var Identity = Data;
                if (!Identity) throw new Error("Identity is null.");

                if (clientsContains(Client)) {
                    this.Clients.set(Client, Identity);
                    this.OnUpdate(Client._id, Identity);
                    break;
                }
                this.Clients.set(Client, Identity);

                this.OnConnect(Client._id, Identity);
                break;
            }

            case ClientEvent.ConsoleError:
            case ClientEvent.ConsoleWarning:
            case ClientEvent.ConsolePrint:
            case ClientEvent.ConsoleInfo:
            case ClientEvent.ConsoleDebug:
            case ClientEvent.ConsoleClear:
            case ClientEvent.AuthenticationError:
            case ClientEvent.CompilerError: {
                if (!clientsContains(Client)) break;

                if (!Data) throw new Error("Output is null.");

                Data.type = Op;
                Data.level = (Op.split("/").slice(-1)[0]).toUpperCase();
                Data.message = Data.message || Data.error_message || "";

                this.OnOutput(Data);
                break;
            }

            default:
                break;
        }

        function shallowCopy(o) {
            var k, r = {};
            for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k];
            return r;
        }
    }

    OnConnect(uniqueId, identity) {
        var id = identity && identity.player && identity.player.name ? identity.player.id : "0";
        var player = identity && identity.player && identity.player.id ? identity.player.name : "Unknown";
        var game = identity && identity.game && identity.game.name ? identity.game.name : "Unknown";

        // Auto-select new clients by default
        this.SelectedClients.add(uniqueId);

        this.LogMessage(`Connected ${uniqueId} -> Player: ${player}(${id}) Game: ${game}`, "CLIENT");
    }

    OnUpdate(uniqueId, identity) {
        var id = identity && identity.player && identity.player.name ? identity.player.id : "Unknown";
        var player = identity && identity.player && identity.player.id ? identity.player.name : "Unknown";
        var game = identity && identity.game && identity.game.name ? identity.game.name : "Unknown";

        this.LogMessage(`Updated ${uniqueId} -> Player: ${player}(${id}) Game: ${game}`, "CLIENT");
    }

    OnOutput(output) {
        this.LogMessage(output.message, output.level);
    }

    GetClientDisplayName(ws, identity) {
        const player = identity && identity.player && identity.player.name ? identity.player.name : "Unknown";
        const id = identity && identity.player && identity.player.id ? identity.player.id : "0";
        const game = identity && identity.game && identity.game.name ? identity.game.name : "Unknown";
        return `${player} (${id}) - ${game}`;
    }


    HandleClientDisconnection(Client) {
        var identity = this.Clients.get(Client);
        var id = identity && identity.player && identity.player.name ? identity.player.id : "Unknown";
        var player = identity && identity.player && identity.player.id ? identity.player.name : "Unknown";
        var game = identity && identity.game && identity.game.name ? identity.game.name : "Unknown";

        this.LogMessage(`Disconnected ${Client._id} -> Player: ${player}(${id})`, "CLIENT");
        this.Clients.delete(Client);
        this.SelectedClients.delete(Client._id); // Remove from selected clients
        this.ConnectedClients--;
        if (this.ConnectedClients === 0) {
            this.SetConnectionState("Waiting", false);
            this.RemoveExecutionButtons();
            this.SelectedClients.clear();
            this.SelectionMode = 'all';
        }
    }

    CreateExecutionButtons() {
        const ctx = this.Context;
        if (!ctx) return;

        if (!this.SelectClientsButton) {
            this.SelectClientsButton = vscode.window.createStatusBarItem(
                vscode.StatusBarAlignment.Right,
                102
            );
            this.SelectClientsButton.text = "$(checklist) Select Clients";
            this.SelectClientsButton.tooltip = "Choose which clients to execute scripts on";
            this.SelectClientsButton.command = "luaWebSocket.selectClients";
            this.SelectClientsButton.show();
            ctx.subscriptions.push(this.SelectClientsButton);
        }

        if (!this.ExecuteButton) {
            this.ExecuteButton = vscode.window.createStatusBarItem(
                vscode.StatusBarAlignment.Right,
                101
            );
            this.ExecuteButton.text = "$(play) Execute Script";
            this.ExecuteButton.tooltip = "Execute the current script in Roblox";
            this.ExecuteButton.command = "luaWebSocket.executeScript";
            this.ExecuteButton.show();
            ctx.subscriptions.push(this.ExecuteButton);
        }

        if (!this.ExecuteSpecificButton) {
            const config = vscode.workspace.getConfiguration('luaWebSocket');
            const specificScript = config.get('specificScriptPath', '');

            if (specificScript) {
                this.ExecuteSpecificButton = vscode.window.createStatusBarItem(
                    vscode.StatusBarAlignment.Right,
                    101
                );
                this.ExecuteSpecificButton.text = "$(play) Execute Loader";
                this.ExecuteSpecificButton.tooltip = `Execute ${specificScript}`;
                this.ExecuteSpecificButton.command = "luaWebSocket.executeSpecificScript";
                this.ExecuteSpecificButton.show();
                ctx.subscriptions.push(this.ExecuteSpecificButton);
            }
        }
    }

    RemoveExecutionButtons() {
        if (this.SelectClientsButton) {
            this.SelectClientsButton.dispose();
            this.SelectClientsButton = null;
        }
        if (this.ExecuteButton) {
            this.ExecuteButton.dispose();
            this.ExecuteButton = null;
        }
        if (this.ExecuteSpecificButton) {
            this.ExecuteSpecificButton.dispose();
            this.ExecuteSpecificButton = null;
        }
    }

    SendScript(ScriptContent, ScriptName = null) {
        if (!this.ConnectedClients) {
            vscode.window.showErrorMessage("No Roblox clients connected");
            return false;
        }

        let sent = 0;
        let failed = 0;
        const toPrune = [];
        const packet = {
            op: "client/onDidTextDocumentExecute",
            data: {
                textDocument: {
                    text: ScriptContent
                }
            }
        };
        const payload = JSON.stringify(packet);

        for (const [ws, identity] of this.Clients) {
            // Skip if in 'selected' mode and this client is not selected
            if (this.SelectionMode === 'selected' && !this.SelectedClients.has(ws._id)) {
                continue;
            }

            if (!ws || ws.readyState !== WS.OPEN) {
                toPrune.push(ws);
                continue;
            }
            try {
                ws.send(payload);
                sent++;
            } catch (e) {
                failed++;
                this.LogMessage(`Script ${ws._id}: ${e.message}`, 'ERROR');
                toPrune.push(ws);
            }
        }

        for (const ws of toPrune) {
            try { this.Clients.delete(ws); } catch { }
        }

        if (sent > 0) {
            const modeText = this.SelectionMode === 'selected' ? ` (${this.SelectedClients.size} selected)` : '';
            this.LogMessage(`Script sent to ${sent} client(s)${modeText} (${ScriptContent.length} chars).`, "CLIENT");

            // Show notification if enabled in settings
            const config = vscode.workspace.getConfiguration('luaWebSocket');
            const showNotifications = config.get('showExecutionNotifications', true);

            if (showNotifications) {
                const scriptDisplayName = ScriptName || "Script";
                const clientText = sent === 1 ? "Roblox Client" : "Roblox Client(s)";
                vscode.window.showInformationMessage(`${scriptDisplayName} sent to ${sent} ${clientText}${modeText}.`);
            }

            if (failed > 0) vscode.window.showWarningMessage(`Failed to send to ${failed} client(s).`);
            return true;
        } else {
            if (this.SelectionMode === 'selected' && this.SelectedClients.size === 0) {
                vscode.window.showErrorMessage("No clients selected. Use 'Select Clients' command to choose clients.");
            } else {
                vscode.window.showErrorMessage("No active Roblox clients (all sockets closed).");
            }
            return false;
        }
    }

    RegisterCommands(Context) {
        const ExecuteScriptCommand = vscode.commands.registerCommand(
            'luaWebSocket.executeScript',
            () => this.ExecuteCurrentScript()
        );

        const ExecuteSpecificScriptCommand = vscode.commands.registerCommand(
            'luaWebSocket.executeSpecificScript',
            () => this.ExecuteSpecificScript()
        );

        const OpenSettingsCommand = vscode.commands.registerCommand(
            'luaWebSocket.openSettings',
            () => this.OpenSettings()
        );

        const SelectClientsCommand = vscode.commands.registerCommand(
            'luaWebSocket.selectClients',
            () => this.SelectClients()
        );

        const ToggleSelectionModeCommand = vscode.commands.registerCommand(
            'luaWebSocket.toggleSelectionMode',
            () => this.ToggleSelectionMode()
        );

        Context.subscriptions.push(ExecuteScriptCommand);
        Context.subscriptions.push(ExecuteSpecificScriptCommand);
        Context.subscriptions.push(OpenSettingsCommand);
        Context.subscriptions.push(SelectClientsCommand);
        Context.subscriptions.push(ToggleSelectionModeCommand);
    }

    ExecuteCurrentScript() {
        const ActiveEditor = vscode.window.activeTextEditor;

        if (!ActiveEditor) {
            vscode.window.showErrorMessage("No active editor found!");
            return;
        }

        const ScriptContent = ActiveEditor.document.getText();

        if (ScriptContent.trim().length === 0) {
            vscode.window.showErrorMessage("Current document is empty");
            return;
        }

        this.SendScript(ScriptContent, "Script");
    }

    async ExecuteSpecificScript() {
        const config = vscode.workspace.getConfiguration('luaWebSocket');
        const specificScriptPath = config.get('specificScriptPath', '');

        if (!specificScriptPath) {
            vscode.window.showErrorMessage("No specific script path configured. Please set 'luaWebSocket.specificScriptPath' in settings.");
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage("No workspace folder open");
            return;
        }

        // Try to find the file in all workspace folders
        let scriptContent = null;
        let foundPath = null;

        for (const folder of workspaceFolders) {
            const fullPath = path.join(folder.uri.fsPath, specificScriptPath);

            if (fs.existsSync(fullPath)) {
                try {
                    scriptContent = fs.readFileSync(fullPath, 'utf8');
                    foundPath = fullPath;
                    break;
                } catch (error) {
                    this.LogMessage(`Failed to read ${fullPath}: ${error.message}`, 'ERROR');
                }
            }
        }

        if (!scriptContent) {
            vscode.window.showErrorMessage(`Could not find or read script: ${specificScriptPath}`);
            return;
        }

        if (scriptContent.trim().length === 0) {
            vscode.window.showErrorMessage(`Script is empty: ${specificScriptPath}`);
            return;
        }

        this.LogMessage(`Executing specific script: ${foundPath}`, 'INFO');

        // Extract just the filename for the notification
        const fileName = path.basename(specificScriptPath, '.lua');
        this.SendScript(scriptContent, fileName);
    }

    async SelectClients() {
        if (this.ConnectedClients === 0) {
            vscode.window.showInformationMessage("No clients connected.");
            return;
        }

        // Build list of client options
        const clientOptions = [];
        for (const [ws, identity] of this.Clients) {
            const displayName = this.GetClientDisplayName(ws, identity);
            clientOptions.push({
                label: displayName,
                description: ws._id.substring(0, 8),
                picked: this.SelectedClients.has(ws._id),
                clientId: ws._id
            });
        }

        // Show multi-select quick pick
        const selected = await vscode.window.showQuickPick(clientOptions, {
            canPickMany: true,
            placeHolder: 'Select which clients to execute scripts on',
            title: 'Client Selection'
        });

        if (selected !== undefined) { // Check for undefined (cancel) vs empty array (deselect all)
            this.SelectedClients.clear();
            for (const item of selected) {
                this.SelectedClients.add(item.clientId);
            }

            // Update button text to show selection count
            if (this.SelectClientsButton) {
                if (this.SelectedClients.size === 0) {
                    this.SelectClientsButton.text = "$(checklist) Select Clients (None)";
                    this.SelectClientsButton.color = "#FFA726"; // Orange warning
                } else if (this.SelectedClients.size === this.ConnectedClients) {
                    this.SelectClientsButton.text = "$(checklist) Select Clients (All)";
                    this.SelectClientsButton.color = undefined; // Default color
                } else {
                    this.SelectClientsButton.text = `$(checklist) Select Clients (${this.SelectedClients.size}/${this.ConnectedClients})`;
                    this.SelectClientsButton.color = "#4CAF50"; // Green
                }
            }

            if (this.SelectedClients.size > 0) {
                this.SelectionMode = 'selected';
                vscode.window.showInformationMessage(`${this.SelectedClients.size} client(s) selected.`);
                this.LogMessage(`Selected ${this.SelectedClients.size} client(s) for script execution`, 'INFO');
            } else {
                this.SelectionMode = 'selected'; // Keep in selected mode but with 0 clients
                vscode.window.showWarningMessage("No clients selected. Scripts will not be sent until you select clients.");
                this.LogMessage("No clients selected - scripts will not execute", 'WARN');
            }
        }
    }

    ToggleSelectionMode() {
        if (this.ConnectedClients === 0) {
            vscode.window.showInformationMessage("No clients connected.");
            return;
        }

        if (this.SelectionMode === 'all') {
            if (this.SelectedClients.size === 0) {
                vscode.window.showInformationMessage("Please use 'Select Clients' command first to choose specific clients.");
                vscode.commands.executeCommand('luaWebSocket.selectClients');
                return;
            }
            this.SelectionMode = 'selected';
            vscode.window.showInformationMessage(`Switched to selected mode (${this.SelectedClients.size} clients).`);
        } else {
            this.SelectionMode = 'all';
            vscode.window.showInformationMessage(`Switched to all clients mode (${this.ConnectedClients} clients).`);
        }
        this.LogMessage(`Selection mode: ${this.SelectionMode}`, 'INFO');
    }

    OpenSettings() {
        vscode.commands.executeCommand('workbench.action.openSettings', 'luaWebSocket');
    }

    Dispose() {
        this.RemoveExecutionButtons();

        if (this.WebSocketServer) {
            this.WebSocketServer.close();
            this.WebSocketServer = null;
        }

        if (this.StatusBarItem) {
            this.StatusBarItem.dispose();
        }

        if (this.OutputChannel) {
            this.OutputChannel.dispose();
        }
    }
}

let WebSocketManagerInstance = null;

function activate(Context) {
    console.log('Lua WebSocket Server extension is now active');

    WebSocketManagerInstance = new WebSocketManager();
    WebSocketManagerInstance.Initialize(Context);
}

function deactivate() {
    if (WebSocketManagerInstance) {
        WebSocketManagerInstance.Dispose();
        WebSocketManagerInstance = null;
    }
}

module.exports = {
    activate,
    deactivate
};