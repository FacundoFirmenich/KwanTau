# RFC-0024 — KwanTau2DOS Durable Mission Runtime and Human Authority Console

**Status:** executable alpha  
**Release:** `0.25.0-alpha.1`  
**Realm:** `SHADOW` and explicitly authorised `ACTIVE` steps  
**Authority inherited:** false  
**Automatic productive retry:** blocked

## 1. Purpose

The Integral Mission Fabric made whole-Ride completeness executable, but it did
not yet provide a durable scheduler, expiring worker claims, human authority
requests, or causal binding to already materialised effects. This RFC adds those
planes without turning the mission into a universal capability.

The governing separations are:

```text
mission activation ≠ work claim
work claim ≠ execution authority
human approval ≠ productive lease
productive lease ≠ observed effect
observed effect ≠ mission closure
mission closure ≠ ecosystem completeness
```

## 2. Durable state

A mission runtime consists of:

- one content-bound run per integral mission;
- one durable work item per mission step;
- dependency-aware readiness;
- expiring worker claims;
- optional human authority requests and decisions;
- effect bindings to existing effect services;
- explicit pause, resume, abort and fail-closed rehydration.

Worker claims are HMAC-protected scheduling tokens. They let one worker own a
work item temporarily; they never satisfy the component capability declared by
the step.

## 3. Human authority

High-risk productive, irreversible, or manually confirmed steps produce a
human-readable request containing:

- exact mission, plan and step identity;
- service, action and capability;
- resource hash;
- consequences;
- jurisdiction relations;
- personal-data boundary;
- alternatives;
- rollback or compensation declaration;
- expiration.

The user decision requires a local one-time authority challenge. The rationale
is encrypted at rest; only its hash enters the event spine. An `APPROVE`
decision enables the scheduler to proceed to the next gate, but the step still
requires the exact execution lease of its owning component.

## 4. Effect evidence

A productive step cannot complete as `SUCCEEDED` or `UNCERTAIN` unless it is
bound to an effect that already exists in an allowed effect service. The binding
stores an observability-safe descriptor and hash. It does not mint, reissue or
extend the effect authority.

## 5. Recovery

On rehydration:

- `CLAIMED` and `RUNNING` work items are quarantined;
- no work is replayed;
- no authority is reissued;
- an approval is reconciled as consumed only when the underlying mission step
  had already crossed the execution boundary;
- idempotent nonproductive work may return to `READY` only after an ordinary
  claim expiration observed by the live scheduler.

## 6. Limits

The alpha does not provide distributed scheduling, cross-host consensus,
exactly-once execution, a production browser shell, or universal atomicity
between mission state and every effect service. The console records user
choices but cannot prove informed consent merely from a code entry. Production
use requires accessibility, trusted display, phishing resistance, stronger
identity and independent security review.
