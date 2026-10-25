# KwanTau2DOS v0.40 — Exact Repair Decision and Federated Recovery

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
release:        0.40.0-alpha.1
branch:         kwantau2dos/v0.40.0-alpha.1
tag:            v0.40.0-alpha.1
release commit: 1cb3dbde12c07415fd062d75313c428e7c6ec951
feature commit: f06d41e2d58e6af674e8978f2035cd2aec2bbcf4
packaging:      8eb6f858d76af830a34589a7adcd623452991a14
predecessor:    c38a834347c1990aaf3948888f475dba6b2d5099
git tree:       e02baa10c733a09006ba9525f3f543aaa9857e66
annotated tag:  937964ba7e892bde94df4fa83692b83f376803cf
logical tree:   3e31d303ee651bd5da2a2a0b11c76e154bfdcefc6e76351f7d61817007a4f069
```

## Material result

v0.40 separates conversational authorisation to continue development from approval or rejection of one exact repair lifecycle. The real USER turn is recorded only by hash as:

```text
DEVELOPMENT_AUTHORIZATION
eligible for repair decision: false
approval ID: null
```

Explicit approval or rejection requires an exact lifecycle, exact target-binding SHA-256, exact USER-turn SHA-256, a local one-time challenge and two independently bound KCH leases.

The release also materialises signed zero-authority recovery capsules and a two-host fenced handoff:

```text
host A exports signed descriptor capsule
→ host B verifies pinned source key
→ host B acquires higher fence epoch
→ host A fence becomes stale
→ host B uses fresh local KCH authority
→ local state is observed
→ RECOVERED or AWAITING_LOCAL_STATE
```

The capsule contains no KCH lease, authority code, KwanMe plaintext, session token or private payload.

## Runtime state

```text
SQLite schema:        35
runtime services:     43
mandatory components: 19
logical files:        987
```

## Validation

```text
source:       281 executed / 280 PASS / 1 conditional skip
clean ZIP:    281 executed / 280 PASS / 1 conditional skip
bundle clone: 281 executed / 280 PASS / 1 conditional skip

source / ZIP / bundle logical tree:
3e31d303ee651bd5da2a2a0b11c76e154bfdcefc6e76351f7d61817007a4f069
```

The single conditional skip is the historical material Wasmtime Component Model gate when the pinned engine is unavailable. It is not counted as a pass.

## Canonical artifact hashes

```text
source ZIP:
95698dae54b642d9e443ecafd17f00fa16aa7ce4dd48246a2b51b925e3259de3

Git bundle:
8fc6dcba0a8667859dcaa1c75b1dcfb75fb0b1c1dbaed443a3e9cc1e4c18aba0

source capsule:
25294572e6a9a4809d5bbae254d0fc62347bd3f178ec547697e50e585a810cc6

Kwan Browser:
84f568687f0c6935efa1dd1a43bf219f6c4eb3af4b719ed2e7d6a486e9f99061
```

## Scientific boundary

```text
development authorisation ≠ lifecycle approval
capsule signature ≠ authority
fence token ≠ KCH lease
cross-host descriptor ≠ replicated private state
recovery ≠ replay
absence of local state ≠ proof of no effect
fixture approval ≠ real user approval
```

This branch is a textual audit and migration surface. It grants no KCH authority, records no real repair approval, performs no training or promotion and must not be merged as a substitute for the sealed `KwanTau2DOS` Git bundle.
