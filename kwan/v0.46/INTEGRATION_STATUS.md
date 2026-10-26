# KwanTau2DOS v0.46 — Human-Certified Transactional Native Canary

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
release:        0.46.0-alpha.1
branch:         kwantau2dos/v0.46.0-alpha.1
tag:            v0.46.0-alpha.1
release commit: f8c93cec5630e1811677053350f6ed61a81cf097
feature commits:
  1bf96ddd9c04b3e76b09579ebb02fb93d5578006
  f93daae76f7ee57006b7a5b82918519d846aa70d
  ad9efea7b087905de0bfe3f479d6f18271a20fea
predecessor:    9bebeb6f6633051cdac0ccf8c7ec324267e91243
git tree:       c23cf3df6e19c4c17c98cfc03ceb82797f5d1aba
annotated tag:  e976b4b0fa2998c8fe38614c986b8701b5f68004
logical tree:   114a20e93a24d921a69c6a431bf3cbc156a218457569cec402e9b7ef834c09c8
```

## Material result

v0.46 materialises a second exact human certification over a previously passed SHADOW canary, commits the selected overlays only into an isolated content-addressed native-canary namespace, executes a read-only/no-network workload, records an exact target-bound human outcome and preserves crash recovery plus adverse rollback.

Validated material paths:

```text
fixture certification
→ CERTIFIED
→ isolated namespace COMMITTED_CANARY
→ read-only workload PASSED
→ fixture HUMAN_ACCEPTED_SHADOW

crash after namespace materialisation
→ exactly-once recovery
→ no authority reissue
→ no effect replay

overlay tamper
→ ADVERSE
→ ROLLED_BACK
→ files and evidence retained
```

The productive boundary remains closed:

```text
domain_native_shadow.promotion.commit = implemented for isolated SHADOW canary only
domain_native_shadow.production.commit = implemented false
native productive store written = false
```

## Runtime state

```text
SQLite schema:        41
runtime services:     49
mandatory components: 19
OpenAPI paths:        392
logical files:        1161
```

## Validation

The complete 318-test gate, material demo and integral validator were independently rerun on source, a clean source ZIP and a clean clone from the Git bundle.

```text
source:       318 executed / 317 PASS / 1 conditional skip
clean ZIP:    318 executed / 317 PASS / 1 conditional skip
bundle clone: 318 executed / 317 PASS / 1 conditional skip
failures:     0
errors:       0
logical tree: identical
```

The single conditional skip is the historical material Wasmtime Component Model test when the pinned engine is unavailable. It is not counted as a pass.

## Artifact hashes

```text
source ZIP:
6e8a2649a85046edb8e4da6c01fe8aec39e5d0d142bb096a421ffcb27b176517

Git bundle:
eb39fc17ed30061d1dff372e6558329c74b122424c06e2465ee884a6cf6f37e7

source capsule:
70034e429f87c573adb737779b8afdd81b66d07b11a1048467bd0ade22df9db7

Kwan Browser:
9381fd2f492d54ba9720850c12cbbb61ce9eb2f5939d62156362f5a5ad5683c4

integral delivery:
3845b9b1801c42e5e6550ae2b7cf4d2d10f2e450908bae7ef67219bc34a51ef1
```

## Scientific boundary

```text
fixture certification ≠ real user certification
canary PASS ≠ productive authority
isolated namespace commit ≠ native productive-store commit
fixture HUMAN_ACCEPTED_SHADOW ≠ real human acceptance
rollback ≠ evidence deletion
full regression ≠ causal advantage
```

This branch is a textual audit and migration surface. It grants no KCH authority, records no real human certification or outcome, performs no productive write, training or promotion and must not be merged as a substitute for the sealed KwanTau2DOS Git bundle.
