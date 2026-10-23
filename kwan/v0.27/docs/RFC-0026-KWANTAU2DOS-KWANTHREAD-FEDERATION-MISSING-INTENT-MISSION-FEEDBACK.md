# RFC-0026 — KwanThread Federation, Missing-Intent Recovery and Mission Feedback Closure

**Status:** executable alpha  
**Release:** `0.27.0-alpha.1`  
**Realm:** `SHADOW`  
**Authority inherited:** false  
**Automatic memory/training/promotion:** blocked

## 1. Purpose

KwanThread v0.26 compiled exact USER turns into encrypted evidence, structured items and live task contracts. v0.27 federates those threads across chat, session, task, mission, project and device boundaries; materialises private recovery of missing intent; and closes the causal loop between mission results and the requirements that originated them.

## 2. Federation

A federation contains source-preserving members, snapshots, conflicts and provenance. Cross-device transport uses a passphrase-encrypted, source-signed capsule. Import never transports KCH leases, local authority challenges, ACTIVE state or productive permission.

```text
capsule valid ≠ authority
same semantic item ≠ same provenance
conflict ≠ forced averaging
```

## 3. Missing intent

A missing-intent slot preserves the exact USER spans that surround the gap. The system may propose at most two candidates, each labelled `HYPOTHESIS`. Only a fresh user-bound local challenge can resolve the slot as one candidate, `NONE` or `STILL_UNKNOWN`. Resolution creates a successor record and never edits the original turns.

## 4. Mission feedback closure

User-originated requirements, constraints, acceptance criteria and open loops are linked to mission steps and observed effects. The assessment reports vector-valued coverage, conflicts, terminology regressions, unverified items and premature closure risk. No scalar conduciveness score is produced.

Possible results include:

```text
CONDUCIVE
BLOCKED
CONFLICTED
PREMATURE_CLOSURE_RISK
INSUFFICIENT_EVIDENCE
```

A KwanBlocks receipt records the assessment with authority ceiling `NONE`.

## 5. Projections

Federation, recovered intent and mission feedback may generate candidate projections for KwanMe, Onboarding Learning, CSI, KwanDocs, Observer–Jarvis, Mission Runtime or KCH context. Every projection remains candidate-only and training-ineligible until the destination applies its own gates.

## 6. Limits

The alpha does not demonstrate semantic completeness, conflict-free distributed replication, automatic recovery of forgotten intent, prospective user utility, hardware-backed device identity, production secure erasure or ACTIVE readiness. `STILL_UNKNOWN` is a legitimate result whenever evidence and user confirmation are insufficient.
