# RFC-0028 — KwanTau2DOS Real Prospective Campaign and Integral Repair Trial

**Status:** executable alpha  
**Release:** `0.29.0-alpha.1`  
**Realm:** `SHADOW`  
**Authority inherited:** false  
**Automatic memory, training, promotion and execution:** blocked

## 1. Purpose

v0.28 defined a future-only four-arm comparison and a causal-repair protocol. v0.29 activates the first real campaign without converting the authorising message into its own evidence. The campaign remains empty until a later USER turn occurs after the frozen boundary and receives a fresh exact human case decision.

```text
campaign activation
≠ case consent
≠ case admission
≠ plan execution
≠ outcome observation
≠ empirical support
```

## 2. Activation boundary

Activation records the exact SHA-256 of the authorising USER turn, the federation snapshot and the campaign charter. The eligible interval begins strictly after freeze. The authorising turn and every earlier turn are structurally ineligible as prospective cases.

```text
activation turn occurred before freeze
→ campaign frozen
→ state AWAITING_FUTURE_TASK
→ real case count 0
→ NO_EMPIRICAL_CLAIM
```

## 3. Case-by-case consent

A later USER turn may become a candidate only if its occurrence is strictly later than the frozen boundary, it belongs to a USER-origin thread in the frozen federation, it has not already been detected, a fresh local authority challenge is consumed for `APPROVE_CASE`, and separate KCH leases admit and bind the case.

`REJECT_CASE` and `DEFER` never create a case or expand authority.

## 4. Integral mission binding

After the four plans and blind reviews exist, a case may bind only to the deterministic preregistered execution label and exact plan hash. The bound mission must be `INTEGRAL`; a partial mission cannot represent the trial. The binding inherits no productive authority.

## 5. Integral repair trial

Repair eligibility requires an admitted real case, a bound integral mission, an arm-specific later outcome with `repair_required=true`, a Mission Feedback assessment belonging to that mission, a substantive incomplete decision and at least one uncovered user-originated item. Eligibility is not execution; any repair remains a separately authorised SHADOW successor.

## 6. Analysis ladder

```text
0 real cases
→ NO_EMPIRICAL_CLAIM

real cases below minimum or missing an arm
→ INSUFFICIENT_REAL_CASES

minimum balanced cases with completed outcomes
→ READY_FOR_LOCAL_ANALYSIS | ADVERSE | MIXED
```

Global summaries remain accessory. No campaign result becomes memory, training data, promotion or permission automatically.

## 7. Limits

This release activates and verifies the protocol but contains zero real prospective cases. It does not demonstrate user utility, causal benefit, reviewer independence, privacy under an external model provider or safe production repair. The first legitimate case must originate in a USER turn strictly later than the frozen boundary and be separately approved.
