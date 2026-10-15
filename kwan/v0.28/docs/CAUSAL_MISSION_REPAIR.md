# Causal Mission Repair

A closed mission is historical evidence. It is never reopened or edited to make its result appear more complete.

## Protocol

```text
parent mission terminal
→ feedback assessment
→ uncovered user-originated items
→ repair proposal
→ explicit approval
→ separately sealed SHADOW successor
→ execution and new feedback links
→ before/after evaluation
```

## Invariants

```text
parent snapshot immutable
repair authority inherited = false
repair promotion = BLOCKED
repair plan coverage = all mandatory components
fresh seal authorities required
successor evidence distinct from parent evidence
```

A repair can resolve omissions prospectively. It cannot transform the original mission into one that had always satisfied them.
