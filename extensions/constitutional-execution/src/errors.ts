export type ConstitutionalErrorCode =
  | "CONSTITUTION_DISABLED"
  | "CONSTITUTION_INVALID"
  | "CONSTITUTION_SIGNATURE_INVALID"
  | "CONSTITUTION_IDEMPOTENCY_CONFLICT"
  | "CONSTITUTION_POLICY_MISMATCH"
  | "CONSTITUTION_EXPIRED"
  | "CONSTITUTION_EXECUTOR_UNSUPPORTED"
  | "CONSTITUTION_SCOPE_DENIED"
  | "CONSTITUTION_BUDGET_DENIED"
  | "CONSTITUTION_CANCEL_UNAVAILABLE"
  | "CONSTITUTION_UNKNOWN"
  | "CONSTITUTION_REMOTE_ERROR";

export class ConstitutionalError extends Error {
  readonly code: ConstitutionalErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ConstitutionalErrorCode,
    message: string,
    options: { retryable?: boolean; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = "ConstitutionalError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}
