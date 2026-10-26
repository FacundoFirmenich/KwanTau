# RFC-0042 — Human-Certified Transactional Native Canary

**Status:** executable SHADOW alpha  
**Release:** `0.46.0-alpha.1`  
**Authority inherited:** false  
**Training eligibility:** false  
**Productive native-store writes:** forbidden  
**Automatic promotion:** unsupported

## Purpose

Insert a second exact human certification between a passing v0.45 canary and any material native-store experiment. Commit the selected candidate overlays only into an isolated content-addressed namespace, execute a read-only/no-network workload, preserve exact target-bound human outcome states and prove crash recovery plus adverse rollback without crossing into productive stores.

## Certification

A certification decision is one of:

```text
PROMOTE_CANARY
ABSTAIN
REJECT
```

It is bound to the exact canary, review, preregistration hash, selected planes and overlay IDs through a local one-shot challenge and a KCH lease. `PROMOTE_CANARY` authorises only an isolated SHADOW namespace commit.

## Namespace boundary

```text
domain_native_shadow.promotion.commit
```

is implemented only for a private native-canary namespace. It never writes productive service stores. The productive capability remains:

```text
domain_native_shadow.production.commit
implemented = false
```

## Workload

The workload is preregistered and enforces:

```text
filesystem: READ_ONLY
network egress: DENY
productive writes: 0
training: false
authority inherited: false
```

The source overlays must remain byte-identical before and after the workload.

## Human outcome

After a passing workload, an exact USER-turn SHA-256 can record:

```text
ACCEPT
ABSTAIN
REJECT
REPAIR_REQUIRED
```

A fixture path validates `HUMAN_ACCEPTED_SHADOW`. It is not represented as a real user outcome or causal advantage.

## Recovery and adverse path

Before materialisation, the namespace record stores the reservation ID and lease nonce. If a crash occurs after the namespace bytes are atomically installed, recovery verifies the manifest and files, finalises the original reservation and never replays the effect or reissues authority.

A modified namespace produces `ADVERSE`; rollback preserves the altered files, expected and observed hashes, findings, receipts and genealogy.

## Validation

The complete 318-test historical gate, material demo and integral validator were independently rerun on source, a clean source ZIP and a clean Git-bundle clone. All three produced 317 passes, one conditional historical Wasmtime skip and the same 1,161-file logical tree.

## Boundaries

```text
fixture certification ≠ real user certification
canary PASS ≠ productive authority
isolated namespace commit ≠ productive store commit
fixture HUMAN_ACCEPTED_SHADOW ≠ real human acceptance
rollback ≠ evidence deletion
regression conformance ≠ causal advantage
```

## Current result

```text
SECOND_HUMAN_CERTIFICATION_PROTOCOL_VALIDATED
ISOLATED_TRANSACTIONAL_NATIVE_CANARY_VALIDATED
READ_ONLY_NO_NETWORK_WORKLOAD_VALIDATED
EXACTLY_ONCE_CRASH_RECOVERY_VALIDATED
ADVERSE_ROLLBACK_WITH_EVIDENCE_RETENTION_VALIDATED
PRODUCTIVE_COMMIT_UNIMPLEMENTED
REAL_USER_CERTIFICATION_UNRESOLVED
REAL_HUMAN_OUTCOME_UNRESOLVED
NO_CAUSAL_CLAIM
```
