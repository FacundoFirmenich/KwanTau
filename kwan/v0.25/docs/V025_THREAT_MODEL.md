# v0.25 threat model

## Protected assets

- mission plans and causal ordering;
- worker claims;
- human authority decisions and rationales;
- component execution leases;
- effect evidence;
- KwanMe payloads;
- Ride and principal identity.

## Threats and controls

| Threat | Control |
|---|---|
| Worker steals a queue item | Random expiring HMAC-bound claim token |
| Claim treated as effect authority | Separate capability and lease required by component |
| Browser approval mints permission | Decision explicitly records `mints_execution_authority=false` |
| Human rationale leaks at rest | AES-GCM encrypted rationale; hash only in ledger |
| Productive step closes without effect | Terminal success/uncertainty requires effect binding |
| Crash causes duplicate retry | In-flight items quarantined on rehydration |
| Stale approval reused | Expiry and one-time consumption |
| Effect evidence rebound | Exact service/effect/work-item lease binding |
| Mission fabric overclaims completeness | Mission-only closure and null scalar completeness |

## Residual risk

The host administrator, compromised Python process or compromised browser can
still undermine confidentiality and trusted display. Local authority codes are
not hardware-backed. Cross-store mission/effect transitions are coordinated but
not universally atomic. A malicious effect service could return a false public
record; independent observation remains necessary for high-risk domains.
