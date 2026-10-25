# RFC-0036 — Exact Repair Decision and Federated Recovery

**Status:** executable SHADOW alpha  
**Release:** `0.40.0-alpha.1`  
**Authority inherited:** false  
**Automatic replay, training and promotion:** blocked

## Purpose

Separate a general conversational authorisation to continue development from an explicit approve/reject decision about one exact repair lifecycle, and permit host-to-host recovery without transporting KCH leases or private KwanMe payloads.

## Exact decision protocol

```text
lifecycle awaiting decision
→ target-binding SHA-256
→ expiring decision request
→ exact USER-turn SHA-256
→ explicit target confirmation
→ local one-time challenge
→ KCH decision.apply lease
→ separate underlying repair.approve lease
→ APPROVED or REJECTED
```

`DEVELOPMENT_AUTHORIZATION` can continue engineering work but is ineligible to approve or reject a repair lifecycle.

## Cancellation and expiry

Open or deferred requests can be cancelled or expired through separate capabilities. An applied decision cannot be retroactively cancelled or expired.

## Recovery capsule

The signed capsule contains descriptors, hashes and genealogy only:

```text
lifecycle identity
Ride identity
source host and principal
source public key
lifecycle state
artifact and packet hashes
signature
```

It contains no KCH lease, authority code, KwanMe plaintext, session token or private payload. Import may be `PINNED_SOURCE_KEY` or `SELF_ASSERTED`; acquiring a recovery fence requires pinned trust.

## Federated fencing

```text
host A exports signed capsule
→ host B verifies pinned source key
→ host B acquires a higher fence epoch
→ host A fence becomes stale
→ host B issues a fresh local KCH lease
→ host B observes local state
→ RECOVERED or AWAITING_LOCAL_STATE
```

The capsule is not a state replication protocol. When the receiving host lacks corresponding local lifecycle state, recovery must not fabricate state or replay an effect.

## Boundaries

```text
development authorisation ≠ lifecycle approval
capsule signature ≠ authority
fence token ≠ KCH lease
cross-host descriptor ≠ replicated private state
recovery ≠ replay
absence of local state ≠ proof of no effect
fixture approval ≠ real user approval
```

## Current result

```text
EXACT_DECISION_PROTOCOL_VALIDATED
DEVELOPMENT_SIGNAL_NON_APPROVAL_VALIDATED
TWO_HOST_FENCED_HANDOFF_VALIDATED
KCH_LEASE_NON_PORTABILITY_VALIDATED
REAL_USER_REPAIR_APPROVAL_UNRESOLVED
NO_CAUSAL_CLAIM
```
