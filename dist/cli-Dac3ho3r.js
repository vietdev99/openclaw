import { lt as loadOpenClawPlugins } from "./reply-CB1HncR0.js";
import "./pi-embedded-helpers-2_03xTck.js";
import "./paths-BDd7_JUB.js";
import { t as createSubsystemLogger } from "./subsystem-46MXi6Ip.js";
import "./utils-Dg0Xbl6w.js";
import "./exec-CTo4hK94.js";
import { c as resolveDefaultAgentId, s as resolveAgentWorkspaceDir } from "./agent-scope-DQsZcpdg.js";
import "./model-selection-DQgw6aTr.js";
import "./github-copilot-token-Bu7snf-i.js";
import "./boolean-Wzu0-e0P.js";
import "./env-C_KMM7mv.js";
import { i as loadConfig } from "./config-CtmQr4tj.js";
import "./manifest-registry-D07OyUnS.js";
import "./plugins-BBMxV8Ev.js";
import "./sandbox-BeLcMLgY.js";
import "./image-Beoe0p4-.js";
import "./pi-model-discovery-fnq7d71o.js";
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
import "./ir-Czxompvi.js";
import "./deliver-CUOmLx9v.js";
import "./send-y-zu3-zs.js";
import "./retry-B0HBYtYT.js";
import "./dispatcher-J2bECkPO.js";
import "./manager-BjyZu1s0.js";
import "./sqlite-DYOjyE6z.js";
import "./channel-summary-DQfUtO8j.js";
import "./client-Vn85xQyX.js";
import "./call-XD8g4yJf.js";
import "./login-qr-8jX3y5Kk.js";
import "./pairing-store-CDO1roUD.js";
import "./links-BTTyq-qK.js";
import "./progress-COMKrzzh.js";
import "./pi-tools.policy-BEXuQEii.js";
import "./prompt-style-DLodgy8f.js";
import "./pairing-labels-DhEI31VF.js";
import "./session-cost-usage-Cgjv1tAn.js";
import "./control-service-DccSOCD2.js";
import "./channel-selection-DAJp0-se.js";

//#region src/plugins/cli.ts
const log = createSubsystemLogger("plugins");
function registerPluginCliCommands(program, cfg) {
	const config = cfg ?? loadConfig();
	const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
	const logger = {
		info: (msg) => log.info(msg),
		warn: (msg) => log.warn(msg),
		error: (msg) => log.error(msg),
		debug: (msg) => log.debug(msg)
	};
	const registry = loadOpenClawPlugins({
		config,
		workspaceDir,
		logger
	});
	const existingCommands = new Set(program.commands.map((cmd) => cmd.name()));
	for (const entry of registry.cliRegistrars) {
		if (entry.commands.length > 0) {
			const overlaps = entry.commands.filter((command) => existingCommands.has(command));
			if (overlaps.length > 0) {
				log.debug(`plugin CLI register skipped (${entry.pluginId}): command already registered (${overlaps.join(", ")})`);
				continue;
			}
		}
		try {
			const result = entry.register({
				program,
				config,
				workspaceDir,
				logger
			});
			if (result && typeof result.then === "function") result.catch((err) => {
				log.warn(`plugin CLI register failed (${entry.pluginId}): ${String(err)}`);
			});
			for (const command of entry.commands) existingCommands.add(command);
		} catch (err) {
			log.warn(`plugin CLI register failed (${entry.pluginId}): ${String(err)}`);
		}
	}
}

//#endregion
export { registerPluginCliCommands };