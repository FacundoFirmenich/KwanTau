# RFC-0033 — Longitudinal Outcome Adjudication and Counterfactual Attention Policy Sandbox

**Status:** executable alpha  
**Release:** `0.34.0-alpha.1`  
**Realm:** `SHADOW`  
**Authority inherited:** false  
**Automatic policy activation, training and promotion:** blocked

## Purpose

A continuation request is evidence that the user wants work to proceed. It is not acceptance, satisfaction or demonstrated cognitive benefit. v0.34 makes that distinction durable across a sequence of outcomes and moves the candidate KwanFront routing rule into a CreaLabs-compatible counterfactual sandbox.

## Longitudinal summary

Repeated `CONTINUE_REQUESTED` events remain `PARTIAL_SEQUENCE`; while no explicit final event exists, utility is `INDETERMINATE`, explicit acceptance remains null and policy activation is blocked.

## Counterfactual arms

```text
CURRENT_BOUNDED_ROUTER
CANDIDATE_BACKSTAGE_BY_DEFAULT
NEGATIVE_CONTROL_SUPPRESS_ALL
ABLATION_NO_PROJECT_CONTEXT
```

Historical replay and software fixtures validate protocol mechanics only. A real prospective observation requires a final explicit user outcome bound to the exact case.

## Adjudication

Possible decisions are `PROTOCOL_ONLY`, `INSUFFICIENT_REAL_CASES`, `READY_FOR_EXPLICIT_TRIAL_APPROVAL`, `ADVERSE` and `MIXED`. No decision can activate a policy; a separate preregistered trial and approval gate are required.

## Limits

The release does not demonstrate cognitive benefit, causal superiority, independent review, optimal budgets or safe production routing. The current evidence is historical replay and therefore terminates at `PROTOCOL_ONLY`.
