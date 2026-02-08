// Gateway protocol types

export interface GatewayEventFrame {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: { presence: number; health: number };
}

export interface GatewayResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
}

export interface GatewayHelloOk {
  type: "hello-ok";
  protocol: number;
  features?: { methods?: string[]; events?: string[] };
  snapshot?: unknown;
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
    issuedAtMs?: number;
  };
  policy?: { tickIntervalMs?: number };
}

export interface ModelCatalogEntry {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: ("text" | "image")[];
}

export interface ModelsListResponse {
  models: ModelCatalogEntry[];
}
