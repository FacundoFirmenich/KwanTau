# RFC-0040 — Domain-Native SHADOW Adapters and Human-Governed Promotion Trial

**Status:** executable SHADOW alpha  
**Release:** `0.44.0-alpha.1`  
**Authority inherited:** false  
**Training eligibility:** false  
**Productive store writes:** forbidden  
**Automatic promotion:** unsupported

## Purpose

Evaluate reversible PERSONAL, MISSION and EVIDENCE clone bindings through read-only domain-shaped adapters before any productive hydration is considered. Preserve local adverse evidence and abstention, run cross-plane consistency checks, and emit only a zero-authority proposal that requires a separate, currently unimplemented promotion-review capability.

## Trial lifecycle

```text
active SHADOW clone binding
→ preregister exact checks
→ read and revalidate clone bytes
→ run plane-specific checks
→ run cross-plane checks
→ PASS | ABSTAIN | ADVERSE
→ zero-authority proposal
```

## Outcomes

```text
PASS     → PROPOSED_SHADOW
ABSTAIN  → BLOCKED_ABSTAINED
ADVERSE  → BLOCKED_ADVERSE
```

`PASS` means that the declared checks succeeded for the observed clone set. It is not permission, promotion, semantic truth or human utility.

`ABSTAIN` means that evidence or plane coverage is insufficient. It is a first-class result, not failure.

`ADVERSE` preserves a material violation. It is never averaged away to protect a favourable narrative.

## Adapter boundary

```text
read_only:            true
network_egress:       DENY
realm:                SHADOW
authority_inherited:  false
productive_effects:   false
promotion:            BLOCKED
```

## Promotion boundary

A passing trial may emit a `PROPOSED_SHADOW` record. The next capability is `domain_native_shadow.promotion.review`, which is intentionally unimplemented and fail-closed. No proposal can write a productive store or cross into `ACTIVE` in this release.

## Validation

The complete 305-test gate, material PASS/ABSTAIN/ADVERSE demo and integral validator were independently rerun on source, a clean source ZIP and a clean Git-bundle clone. All three produced 304 passes, one conditional historical Wasmtime skip and the same 1,104-file logical tree.

## Boundaries

```text
adapter PASS ≠ authority
adapter PASS ≠ semantic truth
ABSTAIN ≠ failure
ADVERSE ≠ evidence to discard
proposal ≠ promotion
SHADOW ≠ ACTIVE
technical conformance ≠ human utility
```

## Current result

```text
READ_ONLY_DOMAIN_ADAPTERS_VALIDATED
PASS_ABSTAIN_ADVERSE_PRESERVATION_VALIDATED
ZERO_AUTHORITY_PROPOSAL_VALIDATED
PRODUCTIVE_PROMOTION_NOT_IMPLEMENTED
REAL_USER_PROMOTION_DECISION_UNRESOLVED
NO_CAUSAL_CLAIM
```
