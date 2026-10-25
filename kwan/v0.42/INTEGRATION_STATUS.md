# KwanTau2DOS v0.42 — Semantic Replica Rehydration and Multi-Host Conflict Adjudication

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
release:        0.42.0-alpha.1
branch:         kwantau2dos/v0.42.0-alpha.1
tag:            v0.42.0-alpha.1
release commit: 8570c90c1e138088ba969b92b6fbee01ab5efcc0
feature commit: 84720cafc6d3fb0f5ba32d3aca0d1d24c94834da
predecessor:    7268449d2daa4b1b5095bdde30ec2b0a20da086f
git tree:       bb23a5e4e6b7f283c0b9af7345a6956bf3ee7fbd
annotated tag:  13cab101bf8ad0c517eef4b5f8714c1dcbab414b
logical tree:   750187f77399cfb7875fd867ae69b0b4297e4401041a89c655f90e320055896e
```

## Material result

v0.42 decomposes an imported private replication package into three typed semantic planes:

```text
PERSONAL
MISSION
EVIDENCE
```

Each plane crosses reversible staging, referential validation, a local one-shot challenge and a separately bound KCH lease before becoming a dedicated `SHADOW` replica object. No native `ACTIVE` service store is hydrated.

Three recipient hosts materialised concurrent revisions of the same semantic object. The system preserved all branches, detected both `VALUE_DIVERGENCE` and `CONCURRENT_FENCE`, rejected last-write-wins and created an explicit successor with three parents under a higher fence epoch.

```text
recipient hosts:             3
conflicting branches:        3
conflicting revisions:       3
successor parent count:      3
successor fence epoch:       3
last-write-wins:             false
active hydration:            false
source authority inherited:  false
```

## Runtime state

```text
SQLite schema:        37
runtime services:     45
mandatory components: 19
logical files:        1046
```

## Validation

The complete 294-test gate, material demo and integral validator were independently rerun on source, a clean source ZIP and a clean clone from the Git bundle.

```text
source:       294 collected / 293 PASS / 1 conditional skip
clean ZIP:    294 collected / 293 PASS / 1 conditional skip
bundle clone: 294 collected / 293 PASS / 1 conditional skip
failures:     0
errors:       0
logical tree: identical
```

The single skip is the historical material Wasmtime Component Model test when the pinned engine is absent. It is not counted as a pass.

## Canonical artifact hashes

```text
source ZIP:
6b95328b2efcf2efdcbab4455b36c61899d58052a11eed724700375ef23ba26f

Git bundle:
ec0e8765314faaea9f7526c53c4647c21d3e2a5c91d07e9c53f23c70c79d492d

source capsule:
6569cd85a33268579fd839c09cdee711db973c5c98ffc6391d509309c2467cdf

Kwan Browser:
8cbee222d5145610969b99520110fc3dab7ea8e29ae7ae9c882d0e06ec1e2f04

integral delivery:
fb96efc13b0f0d0961405902c3e88a7f18c74286c168a3b0bfab97c60ad1166d
```

## Scientific boundary

```text
encrypted package recovered ≠ semantic stores hydrated
SHADOW object materialised ≠ ACTIVE object
branch imported ≠ branch selected
conflict detected ≠ conflict resolved
N-parent successor ≠ universal merge correctness
fixture authority ≠ real user approval
continuity of state ≠ continuity of authority
```

The release demonstrates reversible semantic rehydration and explicit three-host conflict adjudication under fixture authority. It does not demonstrate ACTIVE rehydration, consensus under arbitrary partitions, automatic semantic merge or productive failover.

This branch is a textual audit and migration surface. It grants no KCH authority, records no real user conflict decision, performs no training or promotion and must not be merged as a substitute for the sealed `KwanTau2DOS` Git bundle.
