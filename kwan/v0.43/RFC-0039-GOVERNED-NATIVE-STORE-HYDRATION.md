# RFC-0039 — Governed Native-Store Hydration and Cross-Plane Activation

**Status:** executable SHADOW alpha  
**Release:** `0.43.0-alpha.1`  
**Authority inherited:** false  
**Training eligibility:** false  
**Automatic native ACTIVE hydration and promotion:** blocked

## Purpose

Project typed semantic replicas into reversible, service-shaped clone stores without writing directly into productive native stores. Validate cross-plane dependencies, preserve explicit abstention and require separate local human authority and KCH leases for plane decisions, activation and rollback.

## Planes

```text
PERSONAL
MISSION
EVIDENCE
```

Each plane produces an encrypted SQLite clone with content-addressed identity, file SHA-256, source genealogy and a private locator below the configured native-store hydration directory.

## Decisions

```text
APPROVE
ABSTAIN
REJECT
```

A decision requires a local one-shot challenge and an exact KCH lease. A decision on one plane never authorises another.

## Dependency closure

The release validates activation sets before binding clones. MISSION depends on PERSONAL; full activation requires PERSONAL, MISSION and EVIDENCE. The implementation can admit partial dependency-closed sets and rejects dependency-incomplete requests.

Material examples:

```text
{PERSONAL}                          → allowed
{EVIDENCE}                          → allowed
{PERSONAL, EVIDENCE}                → allowed
{MISSION}                           → denied
{PERSONAL, MISSION, EVIDENCE}       → allowed
```

## Activation states

```text
PARTIAL_SHADOW
ACTIVE_SHADOW
ABSTAINED
ROLLED_BACK
QUARANTINED
```

`ACTIVE_SHADOW` means every clone-plane binding for the job is active inside the SHADOW hydration fabric. It does not mean the KwanTau DOS realm or any productive service store is ACTIVE.

## Rollback and recovery

Rollback removes active bindings while retaining clone files, hashes, receipts and genealogy. Startup recovery removes temporary files and quarantines a complete hydration job if any committed clone is absent or fails its recorded hash.

## Validation boundary

The source tree reran the complete historical 300-test gate: 299 PASS and one conditional Wasmtime skip. Clean ZIP and Git-bundle copies were byte-equivalent and passed the nine focused convergence tests, material demo and integral validator. A concurrent clean-copy full-gate attempt suffered resource contention, is excluded from validation and is not represented as a complete historical rerun.

## Boundaries

```text
semantic replica available ≠ native clone built
native clone built ≠ plane approved
plane approved ≠ activation applied
PARTIAL_SHADOW ≠ ACTIVE_SHADOW
ACTIVE_SHADOW ≠ system ACTIVE
rollback ≠ history deletion
fixture authority ≠ real user decision
technical hydration ≠ human utility
```

## Current result

```text
REVERSIBLE_NATIVE_STORE_CLONES_VALIDATED
DEPENDENCY_CLOSED_PARTIAL_ACTIVATION_VALIDATED
FULL_CROSS_PLANE_SHADOW_ACTIVATION_VALIDATED
ROLLBACK_WITH_GENEALOGY_RETENTION_VALIDATED
NATIVE_PRODUCTIVE_STORE_HYDRATION_NOT_PERFORMED
REAL_USER_PLANE_DECISION_UNRESOLVED
NO_CAUSAL_CLAIM
```
