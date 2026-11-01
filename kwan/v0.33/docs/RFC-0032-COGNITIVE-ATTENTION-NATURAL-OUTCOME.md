# RFC-0032 — Cognitive Attention Cases and Natural Outcome Evidence

**Status:** executable alpha  
**Release:** `0.33.0-alpha.1`  
**Realm:** `SHADOW`  
**Authority inherited:** false

## Purpose

The v0.32 router trial lacked a durable real-case outcome model. v0.33 records one post-freeze case with the three preregistered attention surfaces and separates continuation from acceptance and benefit.

```text
UNROUTED_BACKOFFICE
BOUNDED_KWAN_FRONT
FOCUS_ROUTED_KWAN_FRONT
```

Each arm is encrypted. Public records expose only blind labels, hashes, metrics and receipts.

## Natural outcome evidence

Evidence strength:

```text
IMPLICIT_CONTINUATION
EXPLICIT_NATURAL_LANGUAGE
EXPLICIT_STRUCTURED
```

Finality:

```text
PARTIAL
FINAL
```

A partial event must retain:

```text
utility_conclusion = INDETERMINATE
explicit_acceptance = null
explicit_adverse = null
```

A continuation request never silently becomes a positive outcome.

## Policy candidates

An outcome may create a routing-policy candidate, but:

```text
state = CANDIDATE
automatically_applied = false
training_eligible = false
authority_ceiling = NONE
promotion = BLOCKED
```

## Claim boundary

This release demonstrates campaign rehydration, case custody, blinding, partial natural-language evidence and candidate-only policy proposals. It does not demonstrate cognitive benefit, causal superiority, independent review, optimal thresholds or ACTIVE readiness.
