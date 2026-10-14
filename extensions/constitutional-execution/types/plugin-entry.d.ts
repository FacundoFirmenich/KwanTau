declare module "openclaw/plugin-sdk/plugin-entry" {
  export type ConstitutionalGatewayError = {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
    retryAfterMs?: number;
  };

  export type ConstitutionalRespond = (
    ok: boolean,
    payload?: unknown,
    error?: ConstitutionalGatewayError,
    meta?: unknown,
  ) => void;

  export type ConstitutionalGatewayHandler = (input: {
    params: Record<string, unknown>;
    respond: ConstitutionalRespond;
  }) => void | Promise<void>;

  export type ConstitutionalPluginApi = {
    pluginConfig?: Record<string, unknown>;
    runtime: {
      gateway: {
        request: <T = unknown>(
          method: string,
          params?: Record<string, unknown>,
          options?: { timeoutMs?: number; scopes?: string[] },
        ) => Promise<T>;
      };
    };
    registerGatewayMethod: (
      method: string,
      handler: ConstitutionalGatewayHandler,
      options?: { scope?: string },
    ) => void;
    logger: {
      info: (message: string) => void;
    };
  };

  export type ConstitutionalPluginEntry = {
    id: string;
    name: string;
    description?: string;
    register: (api: ConstitutionalPluginApi) => void;
  };

  /**
   * Focused typecheck snapshot of the native plugin-entry contract.
   * Source audited against KwanTau commit 5bcbbcf6fdd90ff1cc9c84f4cac325e0a12292c0.
   * Full repository CI remains the independent compatibility check.
   */
  export function definePluginEntry<T extends ConstitutionalPluginEntry>(entry: T): T;
}
