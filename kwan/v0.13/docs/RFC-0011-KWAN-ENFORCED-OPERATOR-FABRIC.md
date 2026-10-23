# RFC-0011 — Kwan Enforced Operator Fabric v0.13

**Status:** executable alpha successor of v0.12 external conformance  
**Realm:** SHADOW  
**Authority inherited:** false  
**Productive effects:** false  
**Automatic promotion:** blocked

## 1. Purpose

The Enforced Operator Fabric makes the execution envelope itself a signed,
content-addressed object. An operator is not admitted merely because bytes can
run. It must declare its lane, artifact digest, entrypoint, logical filesystem
resources, network policy, secret policy, deterministic expectations, metrics,
and quantitative resource budgets.

Registration is not execution. Conformance is not authority. An experimental
win is not promotion.

## 2. Operator contract

Each `OperatorCapabilityContract` commits to:

- operator identity and semantic version;
- exact artifact SHA-256;
- lane: PURE_WASM, WASI_COMPONENT, NATIVE, BROWSER or REMOTE;
- entrypoint and optional WIT world;
- CPU, wall-time, memory, output, file, process and network-request budgets;
- logical filesystem grants using `kwan://` identifiers rather than host paths;
- network mode and exact allowlist;
- environment and secret exposure;
- determinism and declared metrics;
- SHADOW realm, zero inherited authority, zero productive effects and blocked promotion.

The canonical contract hash yields `koc:<sha256>`. The local Ride identity signs
that canonical body. The artifact is stored under its digest and verified on read.

## 3. Host assessment

The host profile records observed enforcement primitives without converting
availability into permission. The first profile reports cgroup v2 presence and
writability, current seccomp mode, Landlock visibility, user namespaces,
`unshare`, Bubblewrap, Wasmtime and Node.

- PURE_WASM may receive SUPPORT only under its no-import contract and an available core-Wasm engine.
- WASI_COMPONENT abstains unless Wasmtime and a WIT world are present.
- NATIVE denies execution when any mandatory Linux enforcement primitive is absent.
- BROWSER and REMOTE abstain until their privileged adapters and attestation contracts exist.

`SUPPORT` is still not a lease and does not start a process.

## 4. CreaLabs experimental matrix

A matrix preregisters exactly one baseline, one candidate, optional ablations
and negative controls, seeds, a primary metric and guardrails. Observations are
accepted only for declared arms, seeds and metrics and require one-shot KCH leases.

Adjudication uses an explicit paired rule. It can return:

- `CANDIDATE_OUTPERFORMED`;
- `BASELINE_RETAINED`;
- `INCONCLUSIVE`;
- `ADVERSE_EVIDENCE`.

The verdict is stored as a KwanBlocks receipt. It never promotes the candidate,
creates scientific authority or erases adverse evidence.

## 5. WIT boundary

`wit/kwan-operator.wit` defines the intended WASI Component Model boundary.
This release publishes and validates the typed contract but does not claim a
material component execution adapter. The existing PURE_WASM lane remains the
material no-import baseline.

## 6. Remaining enforcement gates

- delegated cgroup v2 writes rather than read-only detection;
- dedicated seccomp BPF profile;
- Landlock ruleset installation and evidence;
- Wasmtime component execution against the WIT world;
- per-run CPU/RAM/I/O accounting receipts;
- explicit filesystem and network brokers;
- interruption and crash receipts for component/native lanes;
- remote attestation for REMOTE;
- Browser-process enforcement for BROWSER.
