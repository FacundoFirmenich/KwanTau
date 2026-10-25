# RFC-0035 — Cross-Store Repair Lifecycle and Exact Human Outcome Closure

**Status:** executable SHADOW alpha  
**Release:** `0.39.0-alpha.1`  
**Authority inherited:** false  
**Automatic execution, training and promotion:** blocked

## Purpose

Coordinate one exact Outcome Studio repair across KCH, KwanMe, KwanBlocks, mission state, technical-trial evidence and target-bound human outcome state without claiming a global ACID transaction.

## Lifecycle

```text
PREPARED
→ MATERIALIZING_PACKET
→ AWAITING_USER_DECISION
→ APPROVED | REJECTED
→ MISSION_SEALED
→ TRIAL_OPENED
→ TRIAL_ACTIVE
→ TECHNICAL_COMPLETE
→ OUTCOME_REENTERED
→ OUTCOME_CLOSED
```

Exceptional states are `UNCERTAIN` and `QUARANTINED`.

## Atomic human decision

A decision requires a local one-time challenge and an exact KCH lease. Challenge consumption, approval record, KwanBlocks receipt and lease finalisation share one main-store transaction. A failed transaction consumes neither the code nor a partial approval.

## Private KwanMe packet

The approval packet binds the compilation, predecessor, candidate, Ride, principal and exact packet hash. It is encrypted under a dedicated SHADOW KwanMe capability. Public descriptors expose identity and hashes, not private rationale or bytes.

## Recovery

Before crossing into KwanMe the lifecycle persists exact reservation IDs and nonces. After a crash, recovery inspects material evidence and either finalises the original operation, demonstrates a pre-effect failure or preserves `UNCERTAIN`. It never reissues authority or replays a possibly completed effect.

## Exact human outcome closure

Closure is eligible only after a strongly bound successor target contains explicit `USER_TURN` evidence. Human-review step transitions, checkpoint evaluation and optional repair-plan creation require independent leases.

Terminal closure states:

```text
CLOSED_ACCEPTED
CLOSED_REJECTED
CLOSED_REPAIR_REQUIRED
CONFLICTED
```

## Boundaries

```text
packet committed ≠ human approval
approval committed ≠ seal or execution
technical completion ≠ human acceptance
fixture response ≠ real user outcome
closure ≠ causal attribution
repair plan ≠ repair execution
outcome evidence ≠ training permission
recovery ≠ replay
```

## Current result

```text
CROSS_STORE_REPAIR_LIFECYCLE_VALIDATED
LOCAL_AUTHORITY_ATOMICITY_VALIDATED
KWANME_PACKET_RECOVERY_VALIDATED
EXACT_HUMAN_OUTCOME_CLOSURE_VALIDATED_WITH_FIXTURES
REAL_USER_APPROVAL_UNRESOLVED
REAL_HUMAN_OUTCOME_UNRESOLVED
NO_CAUSAL_CLAIM
```
