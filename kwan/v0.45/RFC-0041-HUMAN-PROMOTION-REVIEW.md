# RFC-0041 — Human Promotion Review and Reversible Candidate Overlay

**Status:** executable SHADOW alpha  
**Release:** `0.45.0-alpha.1`  
**Authority inherited:** false  
**Training eligibility:** false  
**Productive native-store writes:** forbidden  
**Automatic promotion:** unsupported

## Purpose

Materialise the human review capability deliberately blocked in v0.44 without collapsing review, candidate construction, canary evaluation and productive promotion into one action.

## Plane decisions

Every candidate plane receives exactly one explicit local decision:

```text
APPROVE_CANARY
ABSTAIN
REJECT
```

The decision is bound to the exact proposal, trial, plane and domain report through a local one-shot challenge and a KCH lease. `ABSTAIN` defers the affected plane. Approved planes can proceed only as a nonempty dependency-closed set. `REJECT` blocks the canary.

## Candidate overlays

Approved planes produce independent content-addressed SQLite overlays containing object descriptors and commitments, not private source payloads. Overlay paths are confined, fsynced, atomically installed and reverified before canary use.

## CreaLabs and Sweetbox boundary

The effective plane set produces a sealed CreaLabs candidate-overlay blueprint and a preregistered Sweetbox-style SHADOW canary. Checks cover overlay hashes, source clone hashes, object-set preservation, dependency closure, inherited authority, productive writes, network and training.

## Outcomes

```text
PASSED
ADVERSE
ROLLED_BACK
QUARANTINED
```

A passing canary only names the future capability `domain_native_shadow.promotion.commit`. That capability remains unimplemented and fail-closed.

An adverse canary preserves findings. Rollback removes current canary availability while retaining files, hashes, receipts and genealogy.

## Validation

The complete 311-test gate, material demo and integral validator were independently rerun on source, a clean source ZIP and a clean Git-bundle clone. All three produced 310 passes, one conditional historical Wasmtime skip and the same 1,131-file logical tree.

## Boundaries

```text
human review ≠ promotion
APPROVE_CANARY ≠ productive authority
ABSTAIN ≠ failure
REJECT ≠ evidence deletion
overlay ≠ native store
canary PASS ≠ semantic truth or utility
rollback ≠ history deletion
next capability ≠ implemented capability
```

## Current result

```text
HUMAN_PLANE_REVIEW_VALIDATED_WITH_FIXTURES
DEPENDENCY_CLOSED_ABSTENTION_VALIDATED
REVERSIBLE_CANDIDATE_OVERLAYS_VALIDATED
PASS_AND_ADVERSE_CANARY_PATHS_VALIDATED
PRODUCTIVE_PROMOTION_COMMIT_UNIMPLEMENTED
REAL_USER_PROMOTION_DECISION_UNRESOLVED
NO_CAUSAL_CLAIM
```
