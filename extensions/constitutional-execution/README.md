# CFL–KCH Constitutional Execution

Experimental first-party Gateway extension for intent-bound constitutional execution.

## Safety posture

- Disabled by default.
- Shadow mode is the default when enabled.
- Every method requires `operator.admin`.
- `constitutional.execute` verifies the canonical envelope hash, Ed25519 authority proof, payload commitment, active policy and contract, host, exact session binding, executor/capability allowlists, budget ceilings, epoch, revocation and lease time bounds.
- Enforce mode delegates to the existing `agent` RPC using the same idempotency key, preserving the Gateway's ordinary admission, dedupe, session and runtime-authority checks.
- Cancellation is intentionally fail-closed until the exact Gateway abort mapping is audited.

This extension does not replace the Gateway admission controller and does not mint authority from Gateway scopes. Gateway authentication is necessary but not sufficient; KCH authority is verified independently.
