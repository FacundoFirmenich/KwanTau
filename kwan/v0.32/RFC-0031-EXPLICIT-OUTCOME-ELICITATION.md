# RFC-0031 — Explicit Outcome Elicitation and Successor Repair Planning

**Status:** executable SHADOW alpha  
**Release:** `0.32.0-alpha.1`  
**Authority inherited:** false  
**Training eligibility:** false  
**Automatic repair or promotion:** blocked

## Purpose

v0.31 established that conversational continuation is partial evidence only. v0.32 adds an exact six-dimension request, encrypted structured responses, conflict-preserving assessment and a zero-authority repair-successor blueprint.

## Required dimensions

```text
accepted
user_repetition_count
omissions
repair_required
privacy_satisfactory
authority_satisfactory
```

Only fields explicitly supplied by the user are resolved. Tone, silence, engagement and continuation are never used to populate the vector.

## Authority separation

```text
prospective_outcome.request.create
prospective_outcome.response.record
prospective_outcome.close
thread_utility.outcome.record
prospective_case.outcome.bind
prospective_outcome.repair.blueprint.create
mission.repair.propose
```

No capability substitutes for another. A repair blueprint is a `SHADOW` proposal with authority ceiling `NONE`; it neither creates nor executes a mission.

## Privacy and learning boundary

Structured response bodies are encrypted at rest. Public receipts contain hashes and dimension names, not omissions or freeform assessment text. Outcome material is `training_eligible=false`.

## Current result

Two real later-user signals are classified as `CONTINUATION`. There are zero explicit structured responses and zero repair blueprints.

```text
INSUFFICIENT_EXPLICIT_OUTCOME_DIMENSIONS
```

## Scientific boundary

```text
continuation ≠ acceptance
explicit acceptance ≠ complete outcome
complete outcome ≠ causal attribution
repair blueprint ≠ repair execution
outcome evidence ≠ training permission
```
