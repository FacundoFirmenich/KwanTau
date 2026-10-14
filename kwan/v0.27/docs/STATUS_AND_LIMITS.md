# KwanTau2DOS v0.27 — status and limits

## Material state

- KwanThread Federation is executable locally.
- Cross-device capsules are encrypted, source-signed and authority-free.
- Missing-Intent Recovery preserves source spans and admits `STILL_UNKNOWN`.
- Mission Feedback Closure links user-originated requirements and criteria to mission steps and observed effects.
- SQLite schema is v25.
- The runtime exposes 32 services and preserves all 19 mandatory components.

## Demonstrated

- USER-turn-only evidence admission;
- cross-device export/import with provenance and no authority transport;
- tamper detection;
- semantic deduplication without provenance deletion;
- explicit conflict preservation;
- maximum-two hypothetical missing-intent candidates;
- user-only intent resolution under a fresh local challenge;
- unchanged historical turns after resolution;
- mission feedback vectors with no scalar score;
- premature-closure detection and KwanBlocks evidence with authority ceiling `NONE`;
- 213 historical tests: 212 PASS and one explicit Wasmtime skip;
- source/ZIP/bundle logical equivalence.

## Not demonstrated

- semantic completeness of thread reconciliation;
- conflict-free distributed replication;
- device attestation;
- automatic recovery of forgotten intent;
- prospective reduction of user repetition, project drift or omissions;
- production secure erasure or hardware-backed custody;
- safe automatic promotion to KwanMe or Onboarding Learning;
- multihost consensus;
- ACTIVE readiness or scientific superiority.

## Constitutional boundary

```text
federated state ≠ authority
candidate intent ≠ remembered fact
user resolution ≠ retroactive mutation
mission outcome ≠ requirement satisfaction
requirement coverage ≠ permission
KwanBlocks receipt ≠ scientific truth
```
