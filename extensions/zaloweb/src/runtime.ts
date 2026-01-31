import { zalowebPlugin } from "./channel.js";

export function getZalowebRuntime() {
  return {
    channel: {
      zaloweb: zalowebPlugin,
    },
  };
}
