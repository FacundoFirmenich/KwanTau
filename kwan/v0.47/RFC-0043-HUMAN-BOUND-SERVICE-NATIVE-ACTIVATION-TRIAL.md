# RFC-0043 — Human-Bound Service-Native Activation Trial

**Status:** executable SHADOW alpha  
**Release:** `0.47.0-alpha.1`  
**Authority inherited:** false  
**Training eligibility:** false  
**Network egress:** denied  
**Productive activation:** unsupported

## Purpose

Evaluate an exact terminal `PROMOTE` recommendation from v0.46 inside isolated service-shaped namespaces before any productive service store is touched. The recommendation is evidence, not authority. v0.47 therefore requires a new target-bound local decision and an exact KCH lease.

## Decisions

```text
APPROVE_TRIAL
ABSTAIN
REJECT
```

`APPROVE_TRIAL` permits construction of a read-only canary namespace. `ABSTAIN` and `REJECT` create no namespace.

## Traffic plan

A preregistered plan binds source outcome, source namespace, selected planes, exact logical keys and hashes, traffic fraction, future-only status, read-only status and outcome contract. Routing is deterministic from the trial and request identities. Baseline and candidate must both receive observations; zero coverage of either arm yields `INCONCLUSIVE`.

## Outcomes

```text
PROMOTE
ABSTAIN
REJECT
ROLLBACK
```

A `PROMOTE` outcome only names the future capability `service_native.production.commit`, which remains unimplemented and fail-closed.

## Crash, tamper and rollback

A crash after atomic file installation is recovered from the durable journal without file rewrite, authority reissue or effect replay. A namespace integrity failure fails the exact lease, quarantines the namespace and trial and emits a contested KwanBlocks receipt. `ROLLBACK` withdraws canary availability while retaining files, hashes, receipts and genealogy.

## Validation

The complete 324-test gate, material demo and integral validator were independently rerun on source, a clean source ZIP and a clean Git-bundle clone. Each produced 323 passes and one conditional historical Wasmtime skip, with the same 1,192-file logical tree.

A concurrent integral-validator attempt exceeded its orchestration timeout after both demos completed. That attempt is excluded; isolated reruns passed.

## Boundaries

```text
fixture approval ≠ real user decision
read-only fractional traffic ≠ productive traffic
canary PASS ≠ semantic truth or human utility
PROMOTE recommendation ≠ production commit
ROLLBACK ≠ history deletion
recovery ≠ replay
```

## Current result

```text
SERVICE_NATIVE_FRACTIONAL_CANARY_VALIDATED
DETERMINISTIC_BASELINE_CANDIDATE_ROUTING_VALIDATED
CRASH_RECOVERY_WITHOUT_REPLAY_VALIDATED
TAMPER_QUARANTINE_VALIDATED
REVERSIBLE_WITHDRAWAL_VALIDATED
PRODUCTIVE_COMMIT_UNIMPLEMENTED
REAL_USER_DECISION_UNRESOLVED
NO_CAUSAL_CLAIM
```
