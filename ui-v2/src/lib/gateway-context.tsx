import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { GatewayHelloOk, GatewayEventFrame } from "@/types/gateway";
import { GatewayClient } from "./gateway-client";

interface GatewayContextValue {
  client: GatewayClient | null;
  connected: boolean;
  hello: GatewayHelloOk | null;
  request: <T = unknown>(method: string, params?: unknown) => Promise<T>;
}

const GatewayContext = createContext<GatewayContextValue | null>(null);

interface GatewayProviderProps {
  url: string;
  token?: string;
  children: ReactNode;
}

export function GatewayProvider({ url, token, children }: GatewayProviderProps) {
  const [client, setClient] = useState<GatewayClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [hello, setHello] = useState<GatewayHelloOk | null>(null);

  useEffect(() => {
    const gatewayClient = new GatewayClient({
      url,
      token,
      onHello: (h) => {
        setConnected(true);
        setHello(h);
      },
      onClose: () => {
        setConnected(false);
      },
      onEvent: (evt: GatewayEventFrame) => {
        // Handle events (config changes, etc.)
        console.log("[gateway] event:", evt.event, evt.payload);
      },
    });

    gatewayClient.start();
    setClient(gatewayClient);

    return () => {
      gatewayClient.stop();
    };
  }, [url, token]);

  const request = useCallback(
    <T = unknown>(method: string, params?: unknown): Promise<T> => {
      if (!client) {
        return Promise.reject(new Error("gateway client not initialized"));
      }
      return client.request<T>(method, params);
    },
    [client],
  );

  return (
    <GatewayContext.Provider value={{ client, connected, hello, request }}>
      {children}
    </GatewayContext.Provider>
  );
}

export function useGateway() {
  const context = useContext(GatewayContext);
  if (!context) {
    throw new Error("useGateway must be used within a GatewayProvider");
  }
  return context;
}
