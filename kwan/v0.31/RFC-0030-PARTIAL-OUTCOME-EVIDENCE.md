# RFC-0030 — Partial Outcome Evidence and Causal Closure

**Status:** executable SHADOW alpha  
**Release:** `0.31.0-alpha.1`  
**Authority inherited:** false  
**Automatic training or promotion:** blocked

## Purpose

The first real prospective case created in v0.30 reached `EXECUTED_AWAITING_USER_OUTCOME`. Later conversational behaviour must not be collapsed into a binary success label. v0.31 records exact USER signals while preserving unknown and conflicting dimensions.

## Signal classes

```text
CONTINUATION
EXPLICIT_ACCEPTANCE
EXPLICIT_REJECTION
REPETITION_COUNT
OMISSION_REPORT
REPAIR_REQUIRED
PRIVACY_BOUNDARY
AUTHORITY_BOUNDARY
UTILITY_RATING
FREEFORM_FEEDBACK
```

`CONTINUATION` does not resolve any outcome dimension.

## Closure vector

```text
accepted
user_repetition_count
omissions
repair_required
privacy_satisfactory
authority_satisfactory
```

Closure requires explicit, non-conflicting evidence for all six dimensions. Missing values remain unknown.

## Three-authority closure

A final closure requires distinct leases for:

```text
prospective_outcome.close
thread_utility.outcome.record
prospective_case.outcome.bind
```

No lease substitutes for another. A closure records evidence but never infers causal advantage of the assigned arm.

## Repair boundary

An explicit omission, rejection or repair signal may produce `REPAIR_REVIEW_REQUIRED`. It does not execute a repair. A repair must be a new successor mission with fresh KCH authority.

## Scientific boundary

```text
continuation ≠ acceptance
acceptance ≠ utility
no complaint ≠ no omissions
closure ≠ causal attribution
outcome evidence ≠ training permission
```

The current scientific decision is:

```text
INSUFFICIENT_EXPLICIT_OUTCOME_DIMENSIONS
```
