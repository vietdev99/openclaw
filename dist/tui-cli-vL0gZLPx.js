import "./pi-embedded-helpers-2_03xTck.js";
import "./paths-BDd7_JUB.js";
import { R as theme, c as defaultRuntime } from "./subsystem-46MXi6Ip.js";
import "./utils-Dg0Xbl6w.js";
import "./exec-CTo4hK94.js";
import "./agent-scope-DQsZcpdg.js";
import "./model-selection-DQgw6aTr.js";
import "./github-copilot-token-Bu7snf-i.js";
import "./boolean-Wzu0-e0P.js";
import "./env-C_KMM7mv.js";
import "./config-CtmQr4tj.js";
import "./manifest-registry-D07OyUnS.js";
import "./plugins-BBMxV8Ev.js";
import "./sandbox-BeLcMLgY.js";
import "./chrome-C-btz7RP.js";
import "./skills-DvalK49l.js";
import "./routes-BZ6CZRJO.js";
import "./server-context-uxEGnm0T.js";
import "./image-ops-CKkV6sly.js";
import "./message-channel-TsTjyj62.js";
import "./logging-kuFzZMsG.js";
import "./accounts-DvQTd8-g.js";
import "./paths-QIdkbvwm.js";
import "./redact-CVRUv382.js";
import "./tool-display-DwgK2aOK.js";
import "./channel-summary-DQfUtO8j.js";
import "./client-Vn85xQyX.js";
import "./call-XD8g4yJf.js";
import { t as formatDocsLink } from "./links-BTTyq-qK.js";
import { t as parseTimeoutMs } from "./parse-timeout-DFSPLxpY.js";
import { t as runTui } from "./tui-Dbd1saQd.js";

//#region src/cli/tui-cli.ts
function registerTuiCli(program) {
	program.command("tui").description("Open a terminal UI connected to the Gateway").option("--url <url>", "Gateway WebSocket URL (defaults to gateway.remote.url when configured)").option("--token <token>", "Gateway token (if required)").option("--password <password>", "Gateway password (if required)").option("--session <key>", "Session key (default: \"main\", or \"global\" when scope is global)").option("--deliver", "Deliver assistant replies", false).option("--thinking <level>", "Thinking level override").option("--message <text>", "Send an initial message after connecting").option("--timeout-ms <ms>", "Agent timeout in ms (defaults to agents.defaults.timeoutSeconds)").option("--history-limit <n>", "History entries to load", "200").addHelpText("after", () => `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/tui", "docs.openclaw.ai/cli/tui")}\n`).action(async (opts) => {
		try {
			const timeoutMs = parseTimeoutMs(opts.timeoutMs);
			if (opts.timeoutMs !== void 0 && timeoutMs === void 0) defaultRuntime.error(`warning: invalid --timeout-ms "${String(opts.timeoutMs)}"; ignoring`);
			const historyLimit = Number.parseInt(String(opts.historyLimit ?? "200"), 10);
			await runTui({
				url: opts.url,
				token: opts.token,
				password: opts.password,
				session: opts.session,
				deliver: Boolean(opts.deliver),
				thinking: opts.thinking,
				message: opts.message,
				timeoutMs,
				historyLimit: Number.isNaN(historyLimit) ? void 0 : historyLimit
			});
		} catch (err) {
			defaultRuntime.error(String(err));
			defaultRuntime.exit(1);
		}
	});
}

//#endregion
export { registerTuiCli };