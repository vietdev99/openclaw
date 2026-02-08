import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { GatewayProvider } from "./lib/gateway-context";
import "./index.css";

// Get gateway URL from window config or default
const gatewayUrl = (() => {
  // In dev mode, UI runs on port 5174 but gateway is on 18789
  if (import.meta.env.DEV) {
    return "ws://localhost:18789";
  }
  // In production, UI is served by gateway so use same host
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${protocol}//${host}`;
})();

// Get token from env var (dev), URL params, or localStorage
const getToken = (): string | undefined => {
  // In dev mode, prefer env var token
  if (import.meta.env.DEV && import.meta.env.VITE_GATEWAY_TOKEN) {
    return import.meta.env.VITE_GATEWAY_TOKEN;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get("token");
  if (tokenFromUrl) {
    // Store in localStorage for future use
    localStorage.setItem("gateway-token", tokenFromUrl);
    return tokenFromUrl;
  }
  return localStorage.getItem("gateway-token") || undefined;
};

const token = getToken();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename="/v2">
      <GatewayProvider url={gatewayUrl} token={token}>
        <App />
      </GatewayProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
