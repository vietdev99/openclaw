import "./loader-A3Gvf2No.js";
import { C as setVerbose, O as isRich, k as theme, n as isTruthyEnvValue, p as defaultRuntime } from "./entry.js";
import "./auth-profiles-DADwpRzY.js";
import { n as replaceCliName, r as resolveCliName } from "./command-format-ayFsmwwz.js";
import "./utils-DX85MiPR.js";
import "./exec-B8JKbXKW.js";
import "./agent-scope-xzSh3IZK.js";
import "./github-copilot-token-o92Svq3q.js";
import "./pi-model-discovery-BY19Axd1.js";
import { j as VERSION } from "./config-lDytXURd.js";
import "./manifest-registry-C69Z-I4v.js";
import "./server-context-jZtjtSoj.js";
import "./chrome-DAzJtJFq.js";
import "./control-service-Cv_fd7Zx.js";
import "./tailscale-iX1Q6arn.js";
import "./auth-CtW7U26l.js";
import "./client-hN0uZClN.js";
import "./call-D0A17Na5.js";
import "./message-channel-PD-Bt0ux.js";
import { t as formatDocsLink } from "./links-ht4RDGt6.js";
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
import { n as resolveCliChannelOptions } from "./channel-options-BZcaOoRG.js";
import { a as getCommandPath, d as hasHelpOrVersion, l as getVerboseFlag } from "./register.subclis-clXxr8kI.js";
import "./completion-cli-DP1frBNn.js";
import "./gateway-rpc-BJUvqjlF.js";
import "./deps-BKhViD8a.js";
import "./daemon-runtime-kbHzTKou.js";
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
import { t as forceFreePort } from "./ports-CFUlqIuG.js";
import "./auth-health-l5aSgUyD.js";
import { i as hasEmittedCliBanner, n as emitCliBanner, o as registerProgramCommands, r as formatCliBannerLine, t as ensureConfigReady } from "./config-guard-ChnEbczb.js";
import "./help-format-B6V9MyR5.js";
import "./configure-Dbh6cH0K.js";
import "./systemd-linger-DlKqKaRl.js";
import "./doctor-B6OoszOc.js";
import { Command } from "commander";

//#region src/cli/program/context.ts
function createProgramContext() {
	const channelOptions = resolveCliChannelOptions();
	return {
		programVersion: VERSION,
		channelOptions,
		messageChannelOptions: channelOptions.join("|"),
		agentChannelOptions: ["last", ...channelOptions].join("|")
	};
}

//#endregion
//#region src/cli/program/help.ts
const CLI_NAME = resolveCliName();
const EXAMPLES = [
	["openclaw channels login --verbose", "Link personal WhatsApp Web and show QR + connection logs."],
	["openclaw message send --target +15555550123 --message \"Hi\" --json", "Send via your web session and print JSON result."],
	["openclaw gateway --port 18789", "Run the WebSocket Gateway locally."],
	["openclaw --dev gateway", "Run a dev Gateway (isolated state/config) on ws://127.0.0.1:19001."],
	["openclaw gateway --force", "Kill anything bound to the default gateway port, then start it."],
	["openclaw gateway ...", "Gateway control via WebSocket."],
	["openclaw agent --to +15555550123 --message \"Run summary\" --deliver", "Talk directly to the agent using the Gateway; optionally send the WhatsApp reply."],
	["openclaw message send --channel telegram --target @mychat --message \"Hi\"", "Send via your Telegram bot."]
];
function configureProgramHelp(program, ctx) {
	program.name(CLI_NAME).description("").version(ctx.programVersion).option("--dev", "Dev profile: isolate state under ~/.openclaw-dev, default gateway port 19001, and shift derived ports (browser/canvas)").option("--profile <name>", "Use a named profile (isolates OPENCLAW_STATE_DIR/OPENCLAW_CONFIG_PATH under ~/.openclaw-<name>)");
	program.option("--no-color", "Disable ANSI colors", false);
	program.configureHelp({
		sortSubcommands: true,
		sortOptions: true,
		optionTerm: (option) => theme.option(option.flags),
		subcommandTerm: (cmd) => theme.command(cmd.name())
	});
	program.configureOutput({
		writeOut: (str) => {
			const colored = str.replace(/^Usage:/gm, theme.heading("Usage:")).replace(/^Options:/gm, theme.heading("Options:")).replace(/^Commands:/gm, theme.heading("Commands:"));
			process.stdout.write(colored);
		},
		writeErr: (str) => process.stderr.write(str),
		outputError: (str, write) => write(theme.error(str))
	});
	if (process.argv.includes("-V") || process.argv.includes("--version") || process.argv.includes("-v")) {
		console.log(ctx.programVersion);
		process.exit(0);
	}
	program.addHelpText("beforeAll", () => {
		if (hasEmittedCliBanner()) return "";
		const rich = isRich();
		return `\n${formatCliBannerLine(ctx.programVersion, { richTty: rich })}\n`;
	});
	const fmtExamples = EXAMPLES.map(([cmd, desc]) => `  ${theme.command(replaceCliName(cmd, CLI_NAME))}\n    ${theme.muted(desc)}`).join("\n");
	program.addHelpText("afterAll", ({ command }) => {
		if (command !== program) return "";
		const docs = formatDocsLink("/cli", "docs.openclaw.ai/cli");
		return `\n${theme.heading("Examples:")}\n${fmtExamples}\n\n${theme.muted("Docs:")} ${docs}\n`;
	});
}

//#endregion
//#region src/cli/program/preaction.ts
function setProcessTitleForCommand(actionCommand) {
	let current = actionCommand;
	while (current.parent && current.parent.parent) current = current.parent;
	const name = current.name();
	const cliName = resolveCliName();
	if (!name || name === cliName) return;
	process.title = `${cliName}-${name}`;
}
const PLUGIN_REQUIRED_COMMANDS = new Set([
	"message",
	"channels",
	"directory"
]);
function registerPreActionHooks(program, programVersion) {
	program.hook("preAction", async (_thisCommand, actionCommand) => {
		setProcessTitleForCommand(actionCommand);
		const argv = process.argv;
		if (hasHelpOrVersion(argv)) return;
		const commandPath = getCommandPath(argv, 2);
		if (!(isTruthyEnvValue(process.env.OPENCLAW_HIDE_BANNER) || commandPath[0] === "update" || commandPath[0] === "completion" || commandPath[0] === "plugins" && commandPath[1] === "update")) emitCliBanner(programVersion);
		const verbose = getVerboseFlag(argv, { includeDebug: true });
		setVerbose(verbose);
		if (!verbose) process.env.NODE_NO_WARNINGS ??= "1";
		if (commandPath[0] === "doctor" || commandPath[0] === "completion") return;
		await ensureConfigReady({
			runtime: defaultRuntime,
			commandPath
		});
		if (PLUGIN_REQUIRED_COMMANDS.has(commandPath[0])) ensurePluginRegistryLoaded();
	});
}

//#endregion
//#region src/cli/program/build-program.ts
function buildProgram() {
	const program = new Command();
	const ctx = createProgramContext();
	const argv = process.argv;
	configureProgramHelp(program, ctx);
	registerPreActionHooks(program, ctx.programVersion);
	registerProgramCommands(program, ctx, argv);
	return program;
}

//#endregion
export { buildProgram };