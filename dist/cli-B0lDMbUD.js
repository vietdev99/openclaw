import { t as loadOpenClawPlugins } from "./loader-Doy_xM2I.js";
import { o as createSubsystemLogger } from "./entry.js";
import "./auth-profiles-YXdFjQHW.js";
import "./utils-DX85MiPR.js";
import "./exec-B8JKbXKW.js";
import { c as resolveDefaultAgentId, s as resolveAgentWorkspaceDir } from "./agent-scope-xzSh3IZK.js";
import "./github-copilot-token-BGfKAPMU.js";
import "./pi-model-discovery-QNYpzH99.js";
import { i as loadConfig } from "./config-DUG8LdaP.js";
import "./manifest-registry-C69Z-I4v.js";
import "./server-context-jZtjtSoj.js";
import "./chrome-DAzJtJFq.js";
import "./control-service-Dbzahcfz.js";
import "./client-hN0uZClN.js";
import "./call-BRxrBcm1.js";
import "./message-channel-PD-Bt0ux.js";
import "./links-ht4RDGt6.js";
import "./plugins-DTDyuQ9p.js";
import "./logging-D-Jq2wIo.js";
import "./accounts-Cy_LVWCg.js";
import "./progress-Da1ehW-x.js";
import "./prompt-style-Dc0C5HC9.js";
import "./manager-zWBWgM8x.js";
import "./paths-BhxDUiio.js";
import "./sqlite-DODNHWJb.js";
import "./retry-zScPTEnp.js";
import "./ssrf--ha3tvbo.js";
import "./pi-embedded-helpers-CTjAw9yN.js";
import "./fetch-CqOdAaMv.js";
import "./send-CPLcHSO9.js";
import "./sandbox-DmkfoXBJ.js";
import "./channel-summary-DVXSGmKv.js";
import "./deliver-qlrODl2n.js";
import "./wsl-DV_IwS0k.js";
import "./skills-DOTGORo4.js";
import "./routes-CFCf0iAl.js";
import "./image-ElhAldt9.js";
import "./redact-CjQe_7H_.js";
import "./tool-display-BHZMhUQ2.js";
import "./channel-selection-BqjxMwZN.js";
import "./session-cost-usage-BsELWoSB.js";
import "./commands-4CdROMwn.js";
import "./pairing-store-BIXuzjuy.js";
import "./login-qr-BcSMnULf.js";
import "./pairing-labels-CjMtb0NM.js";

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