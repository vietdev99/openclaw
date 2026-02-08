import { WebSocket, WebSocketServer } from "ws";
import { execSync, spawn } from "node:child_process";

//#region src/terminal-host/shell-selector.ts
/**
* Shell selector for multi-platform terminal execution.
* Supports: bash (Linux/macOS), PowerShell (Windows), CMD (Windows fallback)
*/
const SHELLS = {
	bash: {
		name: "bash",
		cmd: "/bin/bash",
		args: ["-c"],
		encoding: "utf8"
	},
	powershell: {
		name: "powershell",
		cmd: "powershell.exe",
		args: [
			"-NoProfile",
			"-NonInteractive",
			"-Command"
		],
		encoding: "utf8"
	},
	cmd: {
		name: "cmd",
		cmd: "cmd.exe",
		args: ["/c"],
		encoding: "utf8"
	}
};
/**
* Check if PowerShell is available on the system
*/
function isPowerShellAvailable() {
	try {
		execSync("powershell.exe -NoProfile -Command $PSVersionTable", {
			stdio: "pipe",
			timeout: 5e3
		});
		return true;
	} catch {
		return false;
	}
}
/**
* Get Git Bash path on Windows
*/
function getGitBashPath() {
	const gitBashPaths = [
		"C:\\Program Files\\Git\\bin\\bash.exe",
		"C:\\Program Files (x86)\\Git\\bin\\bash.exe",
		process.env.PROGRAMFILES + "\\Git\\bin\\bash.exe"
	];
	for (const path of gitBashPaths) try {
		execSync(`"${path}" --version`, {
			stdio: "pipe",
			timeout: 5e3
		});
		return path;
	} catch {
		continue;
	}
	return null;
}
/**
* Get shell config by name
*/
function getShellByName(name) {
	const shell = SHELLS[name];
	if (!shell) throw new Error(`Unknown shell: ${name}. Valid options: bash, powershell, cmd`);
	if (name === "bash" && process.platform === "win32") {
		const gitBashPath = getGitBashPath();
		if (gitBashPath) return {
			...shell,
			cmd: gitBashPath
		};
		throw new Error("Bash requested on Windows but Git Bash not found");
	}
	return shell;
}
/**
* Select appropriate shell based on config and OS
*/
function selectShell(config) {
	if (config.shell !== "auto") return getShellByName(config.shell);
	switch (process.platform) {
		case "win32":
			if (isPowerShellAvailable()) return SHELLS.powershell;
			return SHELLS.cmd;
		case "darwin":
		case "linux": return SHELLS.bash;
		default: return SHELLS.bash;
	}
}

//#endregion
//#region src/terminal-host/ipc-server.ts
/**
* IPC Server for Terminal Host
* Runs in isolated process, receives commands via WebSocket
*/
const DEFAULT_PORT = 0;
const DEFAULT_TIMEOUT = 12e4;
var TerminalHostServer = class {
	constructor(config = {}) {
		this.wss = null;
		this.activeCommands = /* @__PURE__ */ new Map();
		this.clients = /* @__PURE__ */ new Set();
		this.config = {
			mode: "isolated",
			shell: config.shell ?? "auto",
			host: {
				port: config.host?.port ?? DEFAULT_PORT,
				maxRestarts: config.host?.maxRestarts ?? 10,
				timeout: config.host?.timeout ?? DEFAULT_TIMEOUT
			}
		};
	}
	/**
	* Start the IPC server
	*/
	start() {
		return new Promise((resolve, reject) => {
			const port = this.config.host?.port ?? DEFAULT_PORT;
			try {
				this.wss = new WebSocketServer({ port });
				this.wss.on("connection", (ws) => {
					this.clients.add(ws);
					console.log(`[terminal-host] Client connected. Total: ${this.clients.size}`);
					ws.on("message", (data) => {
						this.handleMessage(ws, data.toString());
					});
					ws.on("close", () => {
						this.clients.delete(ws);
						console.log(`[terminal-host] Client disconnected. Total: ${this.clients.size}`);
					});
					ws.on("error", (err) => {
						console.error(`[terminal-host] WebSocket error:`, err.message);
					});
					this.send(ws, { type: "ready" });
				});
				this.wss.on("listening", () => {
					const address = this.wss.address();
					const actualPort = typeof address === "object" && address ? address.port : port;
					console.log(`[terminal-host] PORT=${actualPort}`);
					console.log(`[terminal-host] Server listening on port ${actualPort}`);
					resolve();
				});
				this.wss.on("error", (err) => {
					console.error(`[terminal-host] Server error:`, err.message);
					reject(err);
				});
			} catch (err) {
				reject(err);
			}
		});
	}
	/**
	* Stop the server and cleanup
	*/
	async stop() {
		for (const [id, cmd] of this.activeCommands) this.killCommand(id);
		for (const ws of this.clients) ws.close();
		if (this.wss) return new Promise((resolve) => {
			this.wss.close(() => {
				console.log("[terminal-host] Server stopped");
				resolve();
			});
		});
	}
	/**
	* Handle incoming message
	*/
	handleMessage(ws, rawData) {
		try {
			const message = JSON.parse(rawData);
			switch (message.type) {
				case "exec":
					this.handleExec(ws, message.payload);
					break;
				case "ping":
					this.send(ws, {
						type: "pong",
						id: message.id
					});
					break;
				case "shutdown":
					this.stop();
					break;
				default: console.warn(`[terminal-host] Unknown message type: ${message.type}`);
			}
		} catch (err) {
			console.error(`[terminal-host] Failed to parse message:`, err);
		}
	}
	/**
	* Execute a command
	*/
	handleExec(ws, request) {
		const { id, command, workdir, env, timeout, shell } = request;
		const effectiveTimeout = timeout ?? this.config.host?.timeout ?? DEFAULT_TIMEOUT;
		const shellConfig = shell ? getShellByName(shell) : selectShell(this.config);
		console.log(`[terminal-host] Exec [${id}]: ${command.slice(0, 100)}...`);
		const startTime = Date.now();
		const proc = spawn(shellConfig.cmd, [...shellConfig.args, command], {
			cwd: workdir ?? process.cwd(),
			env: {
				...process.env,
				...env
			},
			shell: false,
			stdio: [
				"pipe",
				"pipe",
				"pipe"
			]
		});
		const activeCmd = {
			id,
			process: proc,
			startTime,
			stdout: "",
			stderr: "",
			timeoutId: null
		};
		this.activeCommands.set(id, activeCmd);
		activeCmd.timeoutId = setTimeout(() => {
			console.warn(`[terminal-host] Command ${id} timed out after ${effectiveTimeout}ms`);
			this.killCommand(id, true);
		}, effectiveTimeout);
		proc.stdout?.on("data", (data) => {
			const text = data.toString();
			activeCmd.stdout += text;
			const streamUpdate = {
				id,
				type: "stream",
				stream: "stdout",
				data: text
			};
			this.send(ws, {
				type: "stream",
				id,
				payload: streamUpdate
			});
		});
		proc.stderr?.on("data", (data) => {
			const text = data.toString();
			activeCmd.stderr += text;
			const streamUpdate = {
				id,
				type: "stream",
				stream: "stderr",
				data: text
			};
			this.send(ws, {
				type: "stream",
				id,
				payload: streamUpdate
			});
		});
		proc.on("close", (code, signal) => {
			const duration = Date.now() - startTime;
			const timedOut = !this.activeCommands.has(id);
			if (activeCmd.timeoutId) clearTimeout(activeCmd.timeoutId);
			this.activeCommands.delete(id);
			const response = {
				id,
				type: "exec_result",
				success: code === 0,
				stdout: activeCmd.stdout,
				stderr: activeCmd.stderr,
				exitCode: code,
				signal,
				timedOut,
				duration
			};
			this.send(ws, {
				type: "exec_result",
				id,
				payload: response
			});
			console.log(`[terminal-host] Exec [${id}] completed: code=${code} duration=${duration}ms`);
		});
		proc.on("error", (err) => {
			const duration = Date.now() - startTime;
			if (activeCmd.timeoutId) clearTimeout(activeCmd.timeoutId);
			this.activeCommands.delete(id);
			const response = {
				id,
				type: "exec_result",
				success: false,
				stdout: activeCmd.stdout,
				stderr: activeCmd.stderr,
				exitCode: null,
				signal: null,
				timedOut: false,
				duration,
				error: err.message
			};
			this.send(ws, {
				type: "exec_result",
				id,
				payload: response
			});
			console.error(`[terminal-host] Exec [${id}] error:`, err.message);
		});
	}
	/**
	* Kill a running command
	*/
	killCommand(id, timedOut = false) {
		const cmd = this.activeCommands.get(id);
		if (!cmd) return;
		if (cmd.timeoutId) clearTimeout(cmd.timeoutId);
		cmd.process.kill("SIGTERM");
		setTimeout(() => {
			if (cmd.process.killed) return;
			cmd.process.kill("SIGKILL");
		}, 5e3);
		if (timedOut) this.activeCommands.delete(id);
	}
	/**
	* Send message to client
	*/
	send(ws, message) {
		if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
	}
	/**
	* Get server status
	*/
	getStatus() {
		const address = this.wss?.address();
		const actualPort = typeof address === "object" && address ? address.port : this.config.host?.port ?? 0;
		return {
			running: this.wss !== null,
			port: actualPort,
			activeCommands: this.activeCommands.size,
			clients: this.clients.size
		};
	}
};
if (process.argv[1]?.endsWith("ipc-server.js") || process.argv[1]?.endsWith("ipc-server.ts")) {
	const server = new TerminalHostServer({ host: { port: parseInt(process.env.TERMINAL_HOST_PORT ?? "0", 10) } });
	server.start().then(() => {}).catch((err) => {
		console.error(`[terminal-host] Failed to start:`, err);
		process.exit(1);
	});
	process.on("SIGTERM", async () => {
		console.log("[terminal-host] Received SIGTERM, shutting down...");
		await server.stop();
		process.exit(0);
	});
	process.on("SIGINT", async () => {
		console.log("[terminal-host] Received SIGINT, shutting down...");
		await server.stop();
		process.exit(0);
	});
}

//#endregion
export { TerminalHostServer };