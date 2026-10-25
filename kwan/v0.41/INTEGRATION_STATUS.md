# KwanTau2DOS v0.41 — Persistent Encrypted State Replication

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
release:        0.41.0-alpha.1
branch:         kwantau2dos/v0.41.0-alpha.1
tag:            v0.41.0-alpha.1
release commit: 7268449d2daa4b1b5095bdde30ec2b0a20da086f
feature commit: 493d3b7ff7d8e0b9fc0976a6b703439463af975d
predecessor:    1cb3dbde12c07415fd062d75313c428e7c6ec951
git tree:       613d8a58f95687135c11c8304b3e39207cf57dad
annotated tag:  c752f6559e40b4c17942ef201ffd27279153591a
logical tree:   3ca26501146a5652eb32d8fe5a3fa828ee25954708ea05e2c5fea40fdbeac55a
```

## Material result

v0.41 adds recipient-encrypted persistent state snapshots, explicit sibling divergence, human-bound two-parent resolution and failover into a fresh local Ride.

```text
snapshot encryption: X25519 + HKDF-SHA256 + AES-256-GCM
last-write-wins:      unsupported
two-parent successor: materialised
source-host KCH lease on recipient: rejected
crash after KwanMe packet commit: injected and recovered
terminal state:       RECOVERED_SHADOW
```

A snapshot transports encrypted state and genealogy. It never transports KCH leases, local authority codes, sessions or source-host authority. Recovery requires a pinned inbound snapshot, a current fence, a fresh local Ride, an explicit one-shot human decision, local KCH leases and locally unlocked KwanMe.

## Runtime state

```text
SQLite schema:        36
runtime services:     44
mandatory components: 19
logical files:        1016
```

## Validation

The complete gate, material demo and integral validator were reexecuted independently on source, a clean source ZIP and a clean clone from the Git bundle.

```text
source:       288 executed / 287 PASS / 1 conditional skip
clean ZIP:    288 executed / 287 PASS / 1 conditional skip
bundle clone: 288 executed / 287 PASS / 1 conditional skip
failures:     0
errors:       0
logical tree: identical
```

The single skip is the historical material Wasmtime Component Model test when the pinned engine is unavailable. It is not counted as a pass.

## Canonical artifact hashes

```text
source ZIP:
249906943b4d8a970131bee1b7192f4e6f480177c9aa35b7e9b054e689fbcd64

Git bundle:
982063922fed96b2119652620a1cb6bbce4e12c583ab598a8e250f784d2eba0e

source capsule:
75dca99f3c1676308c33e271a0b8647e7274b481e9737358dd21cccdb8fae97c

Kwan Browser:
719cf742907a6ec81c574ae756228f5f2a1ba12e5ecf59d28746ef826835e78b

integral delivery:
67624047e856262900d7b5109da6bff8a73c37f65cbeef69b149fdd5f2b93a50
```

## Scientific boundary

```text
snapshot identity ≠ authority
recipient decryption ≠ failover permission
Ride continuity ≠ lease continuity
divergence ≠ last-write-wins
recovery ≠ replay
RECOVERED_SHADOW ≠ ACTIVE
fixture approval ≠ real user approval
```

The recovered package is privately preserved in local KwanMe. v0.41 does not yet semantically hydrate all service stores, enter ACTIVE, prove consensus under arbitrary partitions or demonstrate productive failover.

This branch is a textual audit and migration surface. It grants no KCH authority, records no real user failover approval, performs no training or promotion and must not be merged as a substitute for the sealed `KwanTau2DOS` Git bundle.
