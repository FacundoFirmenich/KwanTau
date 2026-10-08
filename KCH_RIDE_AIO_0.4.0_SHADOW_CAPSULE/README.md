# KwanTau DOS Ride AIO 0.4.0 — SHADOW capsule

> **No run. No implant. Ride.**

This capsule records the first integrated reference release in which **Ride** is the transversal primitive of KwanTau DOS: a durable, detachable, locally sovereign, user-steered and user-trainable trajectory across hosts and surfaces.

## Status

- Realm: `SHADOW`
- Promotion to `main`: `NONE`
- Base commit: `5bcbbcf6fdd90ff1cc9c84f4cac325e0a12292c0`
- Release ZIP SHA-256: `9cc6c576f6e96f05f2e6d3658a5b7013d655f34714a9a69b5428a036a1afb1fc`
- Wheel SHA-256: `efdb1e088e3b401dbb50b5002777396d0c5b1535589077e74d4fe9dcb18a8b24`
- Manifest SHA-256: `6d618641b2ada39e823dd3e07df9d0b59401c8f95e971c72705c0f354b66adab`
- Validation: `PASS` — 13 checks, 34 unit tests

## Materialized in the reference release

- Ride lifecycle: `PROVISIONED → MOUNTED → RIDING ⇄ PAUSED → DETACHED`, plus `QUARANTINED`; no `RUNNING` state.
- KCH default-deny, bounded Ed25519 leases, atomic lease consumption, receipts and hash-linked event spine over SQLite WAL.
- Explicit future-only personal learning; passive signals do not train; parametric training is `NOT_CONFIGURED_FAIL_CLOSED`.
- First-inflation checkpointing in `SHADOW`, prospective evaluation, explicit promotion and rebuild after revocation.
- HOQ mission scheduler, dependency resolution, fenced claims and a worker path that still traverses KCH before effects.
- Observer–Jarvis proposals with `authority_granted=false`.
- Sweetbox forks with zero inherited productive authority.
- Truqueplace verification and quarantine without silent activation.
- Country World as a system service; the reference derives only conservative ccTLD hints.
- Encrypted and signed `.ktride` portability; imports are `DETACHED`, have zero active leases and rotate the local daemon token.
- Loopback daemon, OpenAPI contract, CLI, and Chromium MV3 side panel without content scripts.

## Constitutional separations

```text
capability ≠ support ≠ permission ≠ authority ≠ execution ≠ training
claim ≠ authority
continuity ≠ inherited authority
learning ≠ permission escalation
```

## Claim ceiling

This is a **software reference validation**, not evidence of production security, general intelligence or empirically demonstrated improvement for a real user.

Not yet claimed or materialized:

- compiled Chromium fork;
- native E2/E3 operating-system isolation;
- LLM weight training;
- live multi-device synchronization;
- operational Telegram integration;
- universal exactly-once external effects;
- empirical real-user intelligence improvement;
- production security certification.

## Capsule scope

This GitHub branch deliberately contains a compact SHADOW evidence capsule rather than silently replacing the existing repository. The complete source release, wheel, browser surface, schemas, tests, scripts, SBOM, validation evidence and documentation are sealed in the corresponding release artifact whose SHA-256 is recorded above.