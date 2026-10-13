# RFC-0011 — Kwan Enforced Operator Fabric v0.13.0-alpha.1

## Status

SHADOW successor of `v0.12.0-alpha.1`. This RFC does not promote any operator,
model, package or experimental result to ACTIVE.

## Purpose

The previous gate proved exact external conformance for a bounded policy/IPLD
corpus and proved one exact Wasmtime execution inside a Linux enclosure. The
next legitimate frontier is to make **operator intent itself typed** before an
executor is selected.

The v0.13 fabric therefore introduces four linked objects:

1. a signed operator registry;
2. a canonical WIT contract;
3. explicit resource, filesystem and network budgets;
4. CreaLabs experiment matrices preserving baseline, candidate, ablation and
   negative-control evidence separately.

The central invariant is:

```text
operator registered ≠ operator executable
operator executable ≠ operator authoritative
experimental success ≠ promotion
host feature observed ≠ KWAN enforcement proven
```

## Canonical WIT surface

`wit/kwan-operator.wit` defines package `kwan:operator@1.0.0` and world
`operator`. Its source SHA-256 is bound into every v0.13 operator manifest.
Changing the WIT bytes creates a different contract generation and cannot be
silently substituted beneath an existing manifest.

## Lanes

### PURE_WASM

Retains the v0.11/v0.12 no-import core-WebAssembly baseline. It cannot declare:

- filesystem grants;
- network egress;
- ambient environment keys;
- secret handles;
- clocks or randomness.

It can be registered only after the exact module is already present in the
Sweetbox no-import lane.

### WASI_COMPONENT

The manifest form exists, but execution remains `DECLARED_BLOCKED` while the
host cannot prove the complete requested enforcement profile. This preserves
future WIT/WASI semantics without pretending that presence of Wasmtime, cgroup
v2, seccomp or Landlock individually constitutes a complete sandbox.

## Resource contract

Every operator declares ceilings for:

- CPU milliseconds;
- wall-clock milliseconds;
- memory bytes;
- I/O bytes;
- stdout bytes;
- file count;
- process count.

These declarations are commitments. In this alpha, only the pre-existing
PURE_WASM limits are materially enforced. WASI budgets remain fail-closed until
native adapters can prove them.

## Filesystem and network contract

Filesystem grants name **guest paths and source classes**, never raw arbitrary
host paths. Network defaults to `DENY`; an `ALLOWLIST` is a typed declaration,
not an implementation claim.

## Host Enforcement Profile

The probe records what the current host exposes: namespace visibility, cgroup
v2, current process seccomp state, Landlock userspace headers, Bubblewrap and
Wasmtime binaries, or Windows AppContainer status when relevant.

Every observation contains `enforced_for_kwan=false` unless an adapter has
materially demonstrated the rule. This prevents a recurring category error:

```text
feature present on host ≠ policy installed ≠ rule active ≠ effect contained
```

## CreaLabs experiment matrix

A matrix must contain at least one cell for each role:

```text
BASELINE
CANDIDATE
ABLATION
NEGATIVE_CONTROL
```

Each observation references an already-terminal Sweetbox run. Adjudication
returns role-separated evidence and intentionally emits:

```text
scalar_score = null
promotion_recommended = false
promotion_executed = false
```

The purpose is not to forbid later quantitative analysis. It is to prevent a
single convenience score from erasing experimental roles or becoming an
implicit promotion rule.

## Authority

Registration, matrix composition, observation and adjudication each require
separate KCH capabilities and exact resource binding. All are SHADOW-only and
non-productive in this release.

## Next gate

The next gate is not another schema. It is to turn the `WASI_COMPONENT`
contract into enforced host behaviour using a component-capable Wasmtime path,
delegated resource controls and independently testable filesystem, network,
seccomp and Landlock rules; only then can `complete_enforced_wasi_lane` become
true.
