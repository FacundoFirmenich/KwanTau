# RFC-0027 — KwanTau2DOS Prospective Thread Utility and Causal Mission Repair

**Status:** executable alpha  
**Release:** `0.28.0-alpha.1`  
**Realm:** `SHADOW`  
**Authority inherited:** false  
**Automatic memory, training, promotion and execution:** blocked

## 1. Purpose

KwanThread can compile and federate user turns, preserve unknown intent and detect premature mission closure. v0.28 asks the next falsifiable question: does that context improve planning on future tasks, and can detected omissions be repaired without rewriting the closed mission that produced them?

The release defines a future-only, blinded four-arm protocol:

```text
RAW_TASK
LOCAL_THREAD
FEDERATED_THREAD
INTEGRAL_CONTEXT
```

and a causal-repair protocol:

```text
closed parent mission
→ mission-feedback assessment
→ repair proposal
→ fresh explicit user approval
→ new SHADOW successor mission
→ new evidence
→ before/after evaluation
```

## 2. Four planning arms

- `RAW_TASK`: task descriptor without compiled thread context.
- `LOCAL_THREAD`: task plus the local thread contract.
- `FEDERATED_THREAD`: task plus the federated contract and cross-thread provenance.
- `INTEGRAL_CONTEXT`: federated context plus the full nineteen-component mission envelope.

All arms use the same future task identity. Raw user text is prohibited inside the plan artifact; source items are referenced by opaque IDs and hashes.

## 3. Future-only campaign

A campaign freezes before a case can be admitted. It commits to the federation snapshot, four-arm order, minimum real case count, review protocol, metrics and zero-authority boundaries. A task turn whose occurrence precedes the freeze is rejected.

Cases are classified as:

```text
REAL_PROSPECTIVE_USER_TASK
SOFTWARE_PROTOCOL_FIXTURE
```

Fixtures can verify software and structural invariants but can never create an empirical user-utility claim.

## 4. Structural metrics

Each plan reports a vector, never a scalar score:

```text
required coverage
omission count
duplicate references
unsupported steps
terminology regressions
raw-turn leakage
authority expansion
missing mandatory components
open loops
```

Global summaries remain accessory. The primary unit of interpretation is the local task, thread, mission, jurisdiction and authority context.

## 5. Blinded review, preregistered execution assignment and later outcome

Arm identities are mapped to `A/B/C/D` and hidden during review. Reviews score completeness, relevance, non-redundancy, authority safety and privacy safety. Only after all four blind labels have been reviewed can KCH reveal the deterministic blind label assigned for execution; the arm identity remains hidden. A later outcome must bind to that exact label and records user acceptance, repetition count and whether repair was required. Wrong-label outcomes are rejected. Reviews and outcomes remain training-ineligible.

## 6. Scientific claim boundary

Possible decisions include:

```text
NO_EMPIRICAL_CLAIM
STRUCTURAL_AUDIT_ONLY
INSUFFICIENT_REAL_CASES
LOCAL_PROSPECTIVE_EVIDENCE
ADVERSE
MIXED
```

The protocol forbids empirical support from software fixtures. A campaign cannot claim real prospective evidence before the preregistered minimum number of real future cases, complete blinded reviews, arm-specific assigned outcomes and representation of all four arms. Any surviving signal is explicitly descriptive; the alpha does not claim full causal identification.

## 7. Causal mission repair

A repair is derived from an existing `MissionFeedbackAssessment` whose user-originated requirements remain uncovered. The repair plan:

- references the exact parent mission and assessment;
- targets only explicit uncovered items;
- remains `SHADOW`;
- contains all nineteen mandatory components;
- requires fresh explicit user approval;
- requires a `mission.repair.seal` lease and a separate `mission.plan.seal` lease;
- cannot inherit productive authority;
- cannot modify the parent mission.

The evaluation compares before and after feedback vectors and stores a KwanBlocks receipt with authority ceiling `NONE`.

## 8. Non-equivalences

```text
more context ≠ better plan
better structural plan ≠ user utility
user utility ≠ authority safety
fixture success ≠ empirical evidence
repair successor ≠ mutation of parent
mission repair ≠ automatic promotion
```

## 9. Limits

The alpha does not demonstrate prospective real-user benefit, reviewer independence, leakage-free model behaviour, causal identification of every contextual contribution or production readiness. The first legitimate empirical claim requires future real cases explicitly approved after campaign freeze.
