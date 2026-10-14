# RFC-0025 — KwanThread User-Turn Compilation and Mission Coherence

**Status:** executable alpha  
**Release:** `0.26.0-alpha.1`  
**Authority inherited:** false  
**Automatic memory, training and promotion:** blocked

## Purpose

KwanThread converts a flat user transcript into an encrypted, source-grounded and temporally reconciled live task contract. It is a first-level KWAN tool and a cross-cutting service, not a replacement for KwanMe, Onboarding Learning, KwanBlocks, CSI, KwanDocs, Observer–Jarvis, Mission Runtime or KCH.

## Source rule

Only turns whose source role is exactly `USER` may enter the user-evidence lineage. Assistant output can influence user state only when the user explicitly ratifies it in a later user turn. The later user turn is the source.

## Objects

```text
KwanThread
KwanThreadTurn
KwanThreadItem
KwanThreadRelation
KwanThreadSnapshot
KwanThreadProjection
KwanThreadAdjudication
```

Raw turns, metadata, item payloads, snapshots, projections and rationales are encrypted locally. Public state contains descriptors, hashes, source spans and lifecycle status.

## Compilation

The reference compiler extracts conservative structures such as intent, requirement, constraint, correction, decision, question, open loop, deliverable, acceptance criterion, terminology, preference, approval, rejection, next action and feedback. Every item references an exact span in the user turn.

Rule-derived items may enter active state. Model-assisted interpretations enter `CANDIDATE` and require explicit adjudication. No item is training-eligible by default.

## Live task contract

Snapshots compile requirements, constraints, deliverables, acceptance criteria, decisions, terminology, questions, open loops, next actions, preferences, corrections, approvals and rejections. Conduciveness is a vector and never a global scalar score.

Possible states:

```text
INSUFFICIENT_CONTEXT
CONFLICTED
BLOCKED_BY_OPEN_LOOP
READY_FOR_PLANNING
READY_FOR_EXECUTION_REVIEW
CLOSED
```

## Projections

Candidate-only projections may target Onboarding Learning, KwanMe, KwanBlocks, CSI, KwanDocs, Jarvis, Mission Runtime and KCH. Every projection has authority ceiling `NONE`, training eligibility `false` and promotion `false`. The receiving system must apply its own consent, evidence and authority gates.

## Limits

Span integrity demonstrates provenance, not semantic correctness. The compiler is incomplete for irony, ellipsis, code-switching, scope ambiguity and implicit intent. This release demonstrates the protocol with real user inputs but does not establish prospective utility improvement or complete dialogue understanding.
