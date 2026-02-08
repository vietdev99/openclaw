import { kt as installUnhandledRejectionHandler } from "./loader-A3Gvf2No.js";
import { c as enableConsoleCapture, i as normalizeEnv, n as isTruthyEnvValue, p as defaultRuntime } from "./entry.js";
import "./auth-profiles-DADwpRzY.js";
import { d as resolveConfigDir } from "./utils-DX85MiPR.js";
import "./exec-B8JKbXKW.js";
import "./agent-scope-xzSh3IZK.js";
import "./github-copilot-token-o92Svq3q.js";
import "./pi-model-discovery-BY19Axd1.js";
import { j as VERSION } from "./config-lDytXURd.js";
import "./manifest-registry-C69Z-I4v.js";
import "./server-context-jZtjtSoj.js";
import "./chrome-DAzJtJFq.js";
import { r as formatUncaughtError } from "./errors-JRo_LuMk.js";
import "./control-service-Cv_fd7Zx.js";
import { t as ensureOpenClawCliOnPath } from "./path-env-Mj23v3sw.js";
import "./tailscale-iX1Q6arn.js";
import "./auth-CtW7U26l.js";
import "./client-hN0uZClN.js";
import "./call-D0A17Na5.js";
import "./message-channel-PD-Bt0ux.js";
import "./links-ht4RDGt6.js";
import "./plugin-auto-enable-DlcUuzCx.js";
import "./plugins-DTDyuQ9p.js";
import "./logging-D-Jq2wIo.js";
import "./accounts-Cy_LVWCg.js";
import "./progress-Da1ehW-x.js";
import "./prompt-style-Dc0C5HC9.js";
import "./note-Ci08TSbV.js";
import "./clack-prompter-DuBVnTKy.js";
import "./onboard-channels-CYYFVXu9.js";
import "./archive-D0z3LZDK.js";
import "./skill-scanner-Bp1D9gra.js";
import "./installs-DsJkyWfL.js";
import "./manager-Drk8S7so.js";
import "./paths-BhxDUiio.js";
import "./sqlite-DODNHWJb.js";
import "./retry-zScPTEnp.js";
import "./ssrf--ha3tvbo.js";
import "./pi-embedded-helpers-Csu4_5gK.js";
import "./fetch-CqOdAaMv.js";
import "./send-CQXTa8sU.js";
import "./sandbox-DIgdWyWl.js";
import "./channel-summary-BiIRaS65.js";
import "./deliver-DR8sRhk6.js";
import "./wsl-D6sF5vuN.js";
import "./skills-CEWpwqV5.js";
import "./routes-C_VveL4l.js";
import "./image-BuSeH1TK.js";
import "./redact-CjQe_7H_.js";
import "./tool-display-BHZMhUQ2.js";
import "./channel-selection-BqjxMwZN.js";
import "./session-cost-usage-BA3joCTn.js";
import "./commands-Dk6MDIt0.js";
import "./pairing-store-BIXuzjuy.js";
import "./login-qr-DbOhJPX2.js";
import "./pairing-labels-CjMtb0NM.js";
import "./channels-status-issues-DJU0m2T0.js";
import { n as ensurePluginRegistryLoaded } from "./command-options-Dz1YNH1L.js";
import { a as getCommandPath, c as getPrimaryCommand, d as hasHelpOrVersion } from "./register.subclis-clXxr8kI.js";
import "./completion-cli-DP1frBNn.js";
import "./gateway-rpc-BJUvqjlF.js";
import "./deps-BKhViD8a.js";
import { h as assertSupportedRuntime } from "./daemon-runtime-kbHzTKou.js";
import "./service-CLDSmWHy.js";
import "./systemd-D6aP4JkF.js";
import "./service-audit-p8MX_GAu.js";
import "./table-CL2vQCqc.js";
import "./widearea-dns-B-tuKnbf.js";
import "./audit-BXCfVUv1.js";
import "./onboard-skills-Wyguo5Lc.js";
import "./health-format-CBx5Mfn3.js";
import "./update-runner-CzktEJw5.js";
import "./github-copilot-auth-DbKixIWU.js";
import "./logging-ORrUajqM.js";
import "./hooks-status-CwvmkO3S.js";
import "./status-X6ahGX3S.js";
import "./skills-status-DRlSasWS.js";
import "./tui-D_RgGZQl.js";
import "./agent-BRekfAhw.js";
import "./node-service-GOPPBTK5.js";
import "./auth-health-l5aSgUyD.js";
import { a as findRoutedCommand, n as emitCliBanner, t as ensureConfigReady } from "./config-guard-ChnEbczb.js";
import "./help-format-B6V9MyR5.js";
import "./configure-Dbh6cH0K.js";
import "./systemd-linger-DlKqKaRl.js";
import "./doctor-B6OoszOc.js";
import path from "node:path";
import process$1 from "node:process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

//#region src/infra/dotenv.ts
function loadDotEnv(opts) {
	const quiet = opts?.quiet ?? true;
	dotenv.config({ quiet });
	const globalEnvPath = path.join(resolveConfigDir(process.env), ".env");
	if (!fs.existsSync(globalEnvPath)) return;
	dotenv.config({
		quiet,
		path: globalEnvPath,
		override: false
	});
}

//#endregion
//#region src/cli/route.ts
async function prepareRoutedCommand(params) {
	emitCliBanner(VERSION, { argv: params.argv });
	await ensureConfigReady({
		runtime: defaultRuntime,
		commandPath: params.commandPath
	});
	if (params.loadPlugins) ensurePluginRegistryLoaded();
}
async function tryRouteCli(argv) {
	if (isTruthyEnvValue(process.env.OPENCLAW_DISABLE_ROUTE_FIRST)) return false;
	if (hasHelpOrVersion(argv)) return false;
	const path = getCommandPath(argv, 2);
	if (!path[0]) return false;
	const route = findRoutedCommand(path);
	if (!route) return false;
	await prepareRoutedCommand({
		argv,
		commandPath: path,
		loadPlugins: route.loadPlugins
	});
	return route.run(argv);
}

//#endregion
//#region src/cli/run-main.ts
function rewriteUpdateFlagArgv(argv) {
	const index = argv.indexOf("--update");
	if (index === -1) return argv;
	const next = [...argv];
	next.splice(index, 1, "update");
	return next;
}
async function runCli(argv = process$1.argv) {
	const normalizedArgv = stripWindowsNodeExec(argv);
	loadDotEnv({ quiet: true });
	normalizeEnv();
	ensureOpenClawCliOnPath();
	assertSupportedRuntime();
	if (await tryRouteCli(normalizedArgv)) return;
	enableConsoleCapture();
	const { buildProgram } = await import("./program-B9uPElgS.js");
	const program = buildProgram();
	installUnhandledRejectionHandler();
	process$1.on("uncaughtException", (error) => {
		console.error("[openclaw] Uncaught exception:", formatUncaughtError(error));
		process$1.exit(1);
	});
	const parseArgv = rewriteUpdateFlagArgv(normalizedArgv);
	const primary = getPrimaryCommand(parseArgv);
	if (primary) {
		const { registerSubCliByName } = await import("./register.subclis-clXxr8kI.js").then((n) => n.i);
		await registerSubCliByName(program, primary);
	}
	if (!(!primary && hasHelpOrVersion(parseArgv))) {
		const { registerPluginCliCommands } = await import("./cli-HmgdZQwb.js");
		const { loadConfig } = await import("./config-lDytXURd.js").then((n) => n.t);
		registerPluginCliCommands(program, loadConfig());
	}
	await program.parseAsync(parseArgv);
}
function stripWindowsNodeExec(argv) {
	if (process$1.platform !== "win32") return argv;
	const stripControlChars = (value) => {
		let out = "";
		for (let i = 0; i < value.length; i += 1) {
			const code = value.charCodeAt(i);
			if (code >= 32 && code !== 127) out += value[i];
		}
		return out;
	};
	const normalizeArg = (value) => stripControlChars(value).replace(/^['"]+|['"]+$/g, "").trim();
	const normalizeCandidate = (value) => normalizeArg(value).replace(/^\\\\\\?\\/, "");
	const execPath = normalizeCandidate(process$1.execPath);
	const execPathLower = execPath.toLowerCase();
	const execBase = path.basename(execPath).toLowerCase();
	const isExecPath = (value) => {
		if (!value) return false;
		const normalized = normalizeCandidate(value);
		if (!normalized) return false;
		const lower = normalized.toLowerCase();
		return lower === execPathLower || path.basename(lower) === execBase || lower.endsWith("\\node.exe") || lower.endsWith("/node.exe") || lower.includes("node.exe") || path.basename(lower) === "node.exe" && fs.existsSync(normalized);
	};
	const filtered = argv.filter((arg, index) => index === 0 || !isExecPath(arg));
	if (filtered.length < 3) return filtered;
	const cleaned = [...filtered];
	if (isExecPath(cleaned[1])) cleaned.splice(1, 1);
	if (isExecPath(cleaned[2])) cleaned.splice(2, 1);
	return cleaned;
}

//#endregion
export { runCli };