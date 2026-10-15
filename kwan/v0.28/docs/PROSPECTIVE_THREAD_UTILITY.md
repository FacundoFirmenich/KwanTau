# Prospective Thread Utility

## Research question

Does KwanThread context reduce omissions, repetition, unsupported planning, terminology regression and premature closure on future tasks without increasing privacy leakage or unsafe authority expansion?

## Canonical arms

```text
RAW_TASK
LOCAL_THREAD
FEDERATED_THREAD
INTEGRAL_CONTEXT
```

The comparison is ordered but not interpreted as a Shapley decomposition. Interactions among context, task and model may remain unidentified. Execution uses a deterministic blind-label assignment revealed only after reviews complete, so the later outcome is tied to a preregistered arm rather than selected retrospectively.

## Primary outcomes

- coverage of explicit requirements and acceptance criteria;
- omitted requirements;
- repeated user references;
- unsupported steps;
- terminology regressions;
- raw user-turn leakage;
- unsafe authority expansion;
- missing mandatory components;
- later acceptance and repair requirement.

## Claim ladder

```text
software fixture only
→ STRUCTURAL_AUDIT_ONLY

real cases below minimum
→ INSUFFICIENT_REAL_CASES

minimum future cases + complete review/outcome
→ LOCAL_PROSPECTIVE_EVIDENCE or ADVERSE/MIXED
```

No global mean can override an adverse local authority or privacy finding.

## Privacy

Task text is encrypted. Plans use opaque source-item IDs and cannot contain the exact raw user turn. Reviews and outcomes remain ineligible for training by default.
