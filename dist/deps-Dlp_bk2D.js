import { Ar as sendMessageSlack, F as sendMessageDiscord, Tr as sendMessageWhatsApp, r as sendMessageIMessage } from "./loader-Doy_xM2I.js";
import { a as sendMessageTelegram } from "./send-CPLcHSO9.js";
import { m as sendMessageSignal } from "./deliver-qlrODl2n.js";

//#region src/cli/deps.ts
function createDefaultDeps() {
	return {
		sendMessageWhatsApp,
		sendMessageTelegram,
		sendMessageDiscord,
		sendMessageSlack,
		sendMessageSignal,
		sendMessageIMessage
	};
}
function createOutboundSendDeps(deps) {
	return {
		sendWhatsApp: deps.sendMessageWhatsApp,
		sendTelegram: deps.sendMessageTelegram,
		sendDiscord: deps.sendMessageDiscord,
		sendSlack: deps.sendMessageSlack,
		sendSignal: deps.sendMessageSignal,
		sendIMessage: deps.sendMessageIMessage
	};
}

//#endregion
export { createOutboundSendDeps as n, createDefaultDeps as t };