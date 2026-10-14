export type OperatorScope =
  | "operator.read"
  | "operator.write"
  | "operator.admin"
  | "operator.approvals"
  | "operator.pairing"
  | "operator.talk"
  | "operator.talk.secrets";

export type RuntimeGatewayRequestOptions = {
  timeoutMs?: number;
  scopes?: OperatorScope[];
};

export type GatewayRequestError = {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
};

export type GatewayRespond = (
  ok: boolean,
  payload?: unknown,
  error?: GatewayRequestError,
  meta?: unknown,
) => void;

export type GatewayRequestHandler = (input: {
  params: Record<string, unknown>;
  respond: GatewayRespond;
  context?: unknown;
  client?: unknown;
  isWebchatConnect?: boolean;
}) => void | Promise<void>;

export type OpenClawPluginService = {
  id: string;
  start?: () => void | Promise<void>;
  stop?: () => void | Promise<void>;
};

export type OpenClawPluginApi = {
  pluginConfig?: Record<string, unknown>;
  runtime: {
    gateway: {
      request: <T = unknown>(
        method: string,
        params?: Record<string, unknown>,
        options?: RuntimeGatewayRequestOptions,
      ) => Promise<T>;
    };
  };
  logger: {
    info: (message: string) => void;
  };
  registerGatewayMethod: (
    method: string,
    handler: GatewayRequestHandler,
    opts?: { scope?: OperatorScope },
  ) => void;
  registerService: (service: OpenClawPluginService) => void;
};

export type DefinePluginEntryOptions = {
  id: string;
  name: string;
  description: string;
  register: (api: OpenClawPluginApi) => void;
};

export type DefinedPluginEntry = DefinePluginEntryOptions & {
  readonly configSchema?: unknown;
};

export declare function definePluginEntry(
  options: DefinePluginEntryOptions,
): DefinedPluginEntry;
