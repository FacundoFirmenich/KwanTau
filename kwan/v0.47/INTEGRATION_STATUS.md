# KwanTau2DOS v0.47 — Human-Bound Service-Native Activation Trial

## Canon

```text
KwanTau2DOS
KwanTau DOS = KwanTau Dual Operational System
KWAN = K + W
KwanBlocks = plural
No run. No implant. Ride.
```

## Sealed identity

```text
release:        0.47.0-alpha.1
branch:         kwantau2dos/v0.47.0-alpha.1
tag:            v0.47.0-alpha.1
release commit: 8b748a11a4ade85fd18ef4f9384c4929051838f7
feature commit: 0967fe15120a8e94dad89cd7c719b96bcaeaa3fc
predecessor:    09850189b91b68108930bf2b010863ff99ae4160
git tree:       e992a837109ff29bab353336d94765b6c06df518
annotated tag:  123c5538d4624e0bf9791ba40a7bfb5f4c6dddbf
logical tree:   82b42f481ffd6ab881a460562f093dc4ed5c2fce55a5328153190d8520d87538
```

## Material result

v0.47 consumes an exact terminal `PROMOTE` recommendation from v0.46 but requires a new local decision and KCH lease before building an isolated service-shaped namespace. Traffic is deterministic, preregistered, read-only, future-only and split between baseline and candidate.

Validated trajectories:

```text
APPROVE_TRIAL → namespace → baseline/candidate traffic → fixture PROMOTE recommendation
ABSTAIN       → BLOCKED_ABSTAINED → no namespace
crash after files → exactly-once recovery without file rewrite or authority reissue
tamper        → exact lease FAILED + namespace/trial QUARANTINED
ROLLBACK      → availability withdrawn; files, receipts and genealogy retained
```

The productive capability remains deliberately unavailable:

```text
service_native.production.commit
implemented = false
```

## Runtime state

```text
SQLite schema:        42
runtime services:     50
mandatory components: 19
logical files:        1192
```

## Validation

The complete historical gate, material demo and integral validator were independently rerun on source, a clean source ZIP and a clean Git-bundle clone.

```text
source:       324 executed / 323 PASS / 1 conditional skip
clean ZIP:    324 executed / 323 PASS / 1 conditional skip
bundle clone: 324 executed / 323 PASS / 1 conditional skip
failures:     0
errors:       0
logical tree: identical
```

The single skip is the historical material Wasmtime Component Model test when the pinned engine is unavailable. It is not counted as a pass.

A concurrent attempt to execute both integral validators exceeded the orchestration timeout after both demos completed. That attempt is excluded from validation. Each validator was rerun in isolation under a hard timeout and passed.

## Canonical artifact hashes

```text
source ZIP:
b0171e5b9de832a1b4ab4bdb4147e3d5682b9ae264df84f1886c4eea8d037679

Git bundle:
ed35fc50450bbdad54cae9b8e0783e5e09de29c7dcb3ad5f1fd0bcf24bd5492f

source capsule:
10ef8bd040c125a6db6e23f3e8f9525f7a29d9a9a2e3b3508166fb29082745d5

Kwan Browser:
da36cd4f03a6ca25e418ffcae032b04ae376e432490d5fe491994d256158d76b

integral delivery:
3b5ff2616ae9abd99f561640b0f493b4586290f67f78914624ab3d040371a7f9
```

## Scientific boundary

```text
fixture approval ≠ real user decision
read-only fractional traffic ≠ productive traffic
canary PASS ≠ semantic truth or human utility
PROMOTE recommendation ≠ production commit
rollback ≠ history deletion
recovery ≠ replay
```

This branch is a textual audit and migration surface. It grants no KCH authority, records no real user outcome, performs no productive store write, training or promotion and must not be merged as a substitute for the sealed KwanTau2DOS Git bundle.
