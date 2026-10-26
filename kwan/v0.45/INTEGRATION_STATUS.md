# KwanTau2DOS v0.45 — Human Promotion Review and Reversible Candidate Overlay

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
release:        0.45.0-alpha.1
branch:         kwantau2dos/v0.45.0-alpha.1
tag:            v0.45.0-alpha.1
release commit: 9bebeb6f6633051cdac0ccf8c7ec324267e91243
feature commit: 55e060dc2255370ffe58ac11f092fee57f631c91
predecessor:    e36a9b4d60587fe929cae80c858cc09b0133b3eb
git tree:       336d8b36c59b9ff6d0fb5bc96323f32a20df91a2
annotated tag:  dad943398743880308817d8c1ed56db824fa0393
logical tree:   f02c94b8b20969724c91891317848574546d57eab4111543d69671afa5634f88
```

## Material result

v0.45 materialises the human review capability intentionally blocked in v0.44. Every PERSONAL, MISSION and EVIDENCE plane receives an exact local decision:

```text
APPROVE_CANARY
ABSTAIN
REJECT
```

Approved planes must form a dependency-closed set. They are projected into reversible content-addressed SQLite overlays and evaluated through a preregistered SHADOW canary.

Validated paths:

```text
full approval            → canary PASSED
MISSION abstention       → PERSONAL + EVIDENCE canary PASSED
PERSONAL abstention      → MISSION subset BLOCKED_DEPENDENCY
explicit MISSION reject  → BLOCKED_REJECTED
overlay tamper           → ADVERSE → ROLLED_BACK
```

The altered overlay and its adverse finding remain retained after rollback. Productive promotion remains fail-closed:

```text
domain_native_shadow.promotion.commit
implemented = false
```

## Runtime state

```text
SQLite schema:        40
runtime services:     48
mandatory components: 19
logical files:        1131
```

## Validation

The complete historical gate, material demo and integral validator were independently rerun on source, a clean source ZIP and a clean Git-bundle clone.

```text
source:       311 collected / 310 PASS / 1 conditional skip
clean ZIP:    311 collected / 310 PASS / 1 conditional skip
bundle clone: 311 collected / 310 PASS / 1 conditional skip
failures:     0
errors:       0
logical tree: identical
```

The single skip is the historical material Wasmtime Component Model test when the pinned engine is unavailable. It is not counted as a pass.

## Canonical artifact hashes

```text
source ZIP:
1dded3634b607296cf8c850f46ec8414f72be4adfbd4a591f561979645856c01

Git bundle:
1e64d4cf7c548653e2ad1d77940d2e3a9a9ea95dc3fc45dd67d56add3f85fbcf

source capsule:
981a51fef5dc85bab76a12dabb53a0e5b65858d42fb0619f6abb62e7b64ae516

Kwan Browser:
515e3f84c9d7c80af15f5e2ce79993e38aa3d32622fd7651134476d24aa48d59

integral delivery:
d120a2ef9af22596b89959742c2f1cd5153890f2fbdeef6ef013b4f8c35779e0
```

## Scientific boundary

```text
human review ≠ promotion
APPROVE_CANARY ≠ productive authority
ABSTAIN ≠ failure
REJECT ≠ evidence deletion
canary PASS ≠ semantic truth or human utility
rollback ≠ history deletion
next capability ≠ implemented capability
```

This branch is a textual audit and migration surface. It grants no KCH authority, records no real user promotion decision, performs no native ACTIVE-store write, training or promotion and must not be merged as a substitute for the sealed KwanTau2DOS Git bundle.
