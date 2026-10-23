# RFC-0029 — First Real Prospective Case Execution

**Status:** executable alpha  
**Release:** `0.30.0-alpha.1`  
**Realm:** `SHADOW`  
**Outcome:** pending  
**Authority inherited:** false  
**Automatic training and promotion:** blocked

## Purpose

v0.30 admits the first USER task that occurs strictly after the v0.29 campaign freeze and binds consent, four-arm blind review, the preregistered blind label, a completed integral mission and an encrypted execution artifact without inferring its own utility.

## Public case identity

```text
USER turn SHA-256:
000891d399859b995b9f20ef7413975ff7bb650e21849c1287bee61b577f957e

occurred_at:
2026-10-23T16:20:32Z

case:
ktucase:12fc92037bfc386a64aaafc233cc4e229cf52536bc561aa94f88101f7e67bb95

execution:
kpcx:4b49be8e9e42bbe9f59d8c55ccd158ec9f530a92c9ab7c75b207b1cb07b732cd

blind label:
D
```

The exact USER text remains private. The arm identity remains redacted in public evidence.

## State machine

```text
EXECUTED_AWAITING_USER_OUTCOME
→ OUTCOME_RECORDED

or, on inconsistent rehydration:
→ QUARANTINED
```

An outcome must be later, USER-originated and bound to the exact execution and blind label. The current response cannot label its own success.

## Claim boundary

```text
explicit consent ≠ execution authority
complete structural review ≠ independent review
execution ≠ user utility
mission completion ≠ acceptance
outcome ≠ training permission
one case ≠ empirical support
```

The current scientific decision is `INSUFFICIENT_REAL_CASES`: one real case, zero completed outcomes and internal structural review only.
