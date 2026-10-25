# RFC-0038 — Semantic Replica Rehydration and Multi-Host Conflict Adjudication

**Status:** executable SHADOW alpha  
**Release:** `0.42.0-alpha.1`  
**Authority inherited:** false  
**Training eligibility:** false  
**Automatic merge, ACTIVE hydration and promotion:** blocked

## Purpose

Transform a recovered encrypted state package into typed, referentially validated and reversible semantic replicas without writing directly into native ACTIVE service stores. Preserve concurrent multi-host branches and require explicit human-bound authority for every plane and every conflict successor.

## Rehydration planes

```text
PERSONAL
MISSION
EVIDENCE
```

Each plane has an independent state machine:

```text
STAGED
→ APPROVED
→ MATERIALISED_SHADOW
```

and can be rolled back without deleting its genealogy.

## Semantic object domains

The current adapters materialise typed replicas for private KwanMe packets, lifecycle/mission state and evidence/artifact descriptors. They validate object identity, hashes, references, Ride and source genealogy before committing any replica object.

## Authority separation

Planning, plane approval, plane materialisation, finalisation, rollback, branch export/import and conflict resolution each use a distinct capability and lease. Every plane approval additionally consumes a local one-shot challenge.

No imported authority, source-host lease, authority code or session is accepted.

## Multi-host conflict

Concurrent recipient hosts may produce signed recipient-encrypted semantic branches. Import preserves every branch. Equal-fence concurrent revisions or different values for the same semantic key produce explicit conflicts.

```text
last-write-wins = unsupported
```

Conflict resolution requires:

```text
all selected parent revisions
new fence epoch > every parent epoch
local one-shot authority challenge
KCH lease bound to the exact conflict and parent set
human rationale hash
```

The result is a new N-parent successor; parent revisions remain preserved and are marked superseded, never deleted.

## Material validation

The release demo hydrated all three planes on three recipient hosts, produced three concurrent revisions, detected `VALUE_DIVERGENCE` and `CONCURRENT_FENCE`, and created a three-parent successor at fence epoch 3.

The complete 294-test historical gate, material demo and integral validator were independently rerun on source, a clean source ZIP and a clean Git-bundle clone.

## Boundaries

```text
encrypted package recovered ≠ semantic stores hydrated
SHADOW replica object ≠ ACTIVE object
branch imported ≠ branch selected
conflict detected ≠ conflict resolved
N-parent successor ≠ universal semantic merge correctness
fixture authority ≠ real user approval
state continuity ≠ authority continuity
```

## Current result

```text
SEMANTIC_SHADOW_REHYDRATION_VALIDATED
THREE_HOST_EXPLICIT_CONFLICT_VALIDATED
N_PARENT_SUCCESSOR_VALIDATED_WITH_FIXTURE_AUTHORITY
ACTIVE_REHYDRATION_NOT_IMPLEMENTED
REAL_USER_CONFLICT_DECISION_UNRESOLVED
NO_CAUSAL_CLAIM
```
