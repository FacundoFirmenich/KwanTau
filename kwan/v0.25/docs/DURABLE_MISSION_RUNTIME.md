# Durable Mission Runtime

## State machines

### Run

```text
CREATED → RUNNING ↔ PAUSED
RUNNING → COMPLETED
RUNNING → BLOCKED
RUNNING → QUARANTINED
RUNNING/PAUSED/BLOCKED → ABORTED
```

### Work item

```text
PENDING
  → READY
  → WAITING_HUMAN
  → CLAIMED
  → RUNNING
  → SUCCEEDED | FAILED | BLOCKED | UNCERTAIN | QUARANTINED | SKIPPED
```

## Claim discipline

A claim binds:

```text
run
work item
worker
random token hash
expiry
attempt number
```

A claim can be renewed only while live. A claim for an idempotent,
nonproductive step may be returned to `READY` after expiry. Productive,
non-idempotent or in-flight work is quarantined because replay could duplicate
an effect.

## Effect binding

Supported evidence services in this release:

```text
KCH_EFFECTS
DURABLE_EFFECTS
EXTERNAL_EFFECTS
COMPONENT_BROKER
```

The runtime resolves the exact effect identifier, serialises its public record,
hashes the evidence and stores the binding. This is observability and causal
coordination, not an execution path.

## Invariants

```text
claim token cannot start component effect
mission runtime cannot mint component lease
human decision cannot replace component lease
productive success requires effect evidence
rehydration does not replay work
mission completion is mission-scoped
```
