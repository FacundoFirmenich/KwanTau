# RFC-0032 — Outcome Target Router and Target-Bound Measurement

**Status:** executable SHADOW alpha  
**Release:** `0.33.0-alpha.1`  
**Authority inherited:** false  
**Training eligibility:** false  
**Automatic repair or promotion:** blocked

## Problem

A questionnaire has no stable scientific meaning until the evaluated object is identified. The same words — accepted, omitted, useful, private or authorised — refer to different constructs when applied to a single response, a release artifact, a longitudinal Ride segment or the complete system.

The previous generic outcome form is therefore superseded as:

```text
UI_FUNCTIONAL
MEASUREMENT_TARGET_UNBOUND
SCIENTIFICALLY_INVALID_AS_DEPLOYED
REPAIR_REQUIRED
```

No response produced through that unbound form is admitted as outcome evidence.

## Target classes

```text
RESPONSE
DELIVERABLE
RIDE_SEGMENT
SYSTEM
```

Each class has an independent instrument. Questions are never rendered before a target descriptor has been validated.

## Binding strengths

```text
STRONG
  content SHA-256
  artifact SHA-256
  Git commit
  release tag + commit

MODERATE
  stable turn ID
  explicit time window

WEAK
  descriptor only
```

Weak targets remain operationally useful but cannot produce scientifically eligible closure.

## Local identity generation

The standalone and Kwan Browser surfaces can calculate SHA-256 locally for exact response text or deliverable bytes. Source text and files are not included in the target, export or receipt.

## Explicit outcomes

Answers support explicit value, `UNRESOLVED`, `NOT_APPLICABLE` where allowed, conflict across responses and freeform evidence. No global scalar score is computed.

## Repair boundary

A target can produce `REPAIR_REVIEW_REQUIRED`. The resulting repair plan is a zero-authority SHADOW proposal and requires a fresh `mission.repair.propose` authority before any successor mission exists.

## Constitutional boundaries

```text
target selected ≠ target bound
question answered ≠ object identified
form complete ≠ scientifically eligible
ready to close ≠ outcome closed
outcome closed ≠ causal attribution
repair plan ≠ repair execution
outcome evidence ≠ training permission
```

## Current scientific result

```text
TARGET_BOUND_EVALUATION_PROTOCOL_VALIDATED
NO_REAL_USER_OUTCOME_RECORDED
NO_CAUSAL_CLAIM
```
