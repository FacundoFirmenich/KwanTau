# RFC-0034 — Explicit Outcome Console and Prospective Attention Policy Trial

**Status:** executable alpha  
**Release:** `0.35.0-alpha.1`  
**Realm:** `SHADOW`  
**Authority inherited:** false  
**Automatic policy activation, training and promotion:** blocked

## 1. Purpose

The cognitive-attention campaign accumulated several explicit requests to continue, but continuation is not a final judgement. v0.35 introduces a bounded console for exact human outcome decisions and a distinct future-only trial for the candidate routing policy.

```text
partial outcome sequence
→ explicit outcome request
→ local human decision
→ separate KCH outcome-binding lease
→ final outcome event
```

```text
sandbox adjudication
→ prospective policy trial freeze
→ future case assignment
→ final explicit case outcome
→ local vector observation
→ adjudication without activation
```

## 2. Explicit Outcome Console

The console presents a finite choice set:

```text
ACCEPTED
ACCEPTED_WITH_REPAIR
ADVERSE_OVERLOAD
ADVERSE_OMISSION
ADVERSE_AUTHORITY
MIXED
UNRESOLVED
```

The choice and rationale are recorded under a one-time local authority challenge. The rationale is encrypted at rest. The decision is not a KCH execution lease and cannot itself modify routing, memory or models.

A separate `cognitive_attention.outcome.record` lease is required to bind the human decision into a final outcome event. This preserves the distinction between judgement and constitutional permission.

## 3. Prospective Attention Policy Trial

A trial can be activated only from an already adjudicated SHADOW sandbox experiment. It freezes the candidate, source summary, source adjudication, canonical four-arm set and minimum real cases per arm.

The four arms remain:

```text
CURRENT_BOUNDED_ROUTER
CANDIDATE_BACKSTAGE_BY_DEFAULT
NEGATIVE_CONTROL_SUPPRESS_ALL
ABLATION_NO_PROJECT_CONTEXT
```

A future case must occur strictly after the freeze. Assignment is balanced separately within each evidence class. Software fixtures and historical replays can validate protocol mechanics but never count as real prospective evidence.

An observation requires a final explicit outcome bound to the same case. Adjudication can yield `PROTOCOL_ONLY`, `INSUFFICIENT_REAL_CASES`, `READY_FOR_LOCAL_ANALYSIS`, `ADVERSE` or `MIXED`. None of these states activates a policy.

## 4. Guardrails

Candidate-arm findings for hidden user-only decisions, hidden irreversible items, hidden urgent deadlines, authority findings or privacy findings are local veto evidence. They cannot be offset by fewer words or fewer project switches.

## 5. Non-equivalences

```text
human decision ≠ KCH lease
final outcome ≠ training signal
balanced assignment ≠ causal identification
local analysis readiness ≠ policy activation
policy adjudication ≠ authority
```

## 6. Current material boundary

The v0.35 material gate records three partial continuation events, one pending explicit outcome request, no human decision, one active prospective trial and zero real trial cases. The correct scientific claim is therefore `OUTCOME_REQUEST_PENDING_AND_TRIAL_ACTIVE`.

## 7. Limits

The release does not establish user acceptance, cognitive benefit, independent review, optimal budgets, real prospective policy superiority, safe production activation or ACTIVE readiness. A final user judgement may close the current outcome, but policy activation requires a later separately preregistered and authorised gate.
