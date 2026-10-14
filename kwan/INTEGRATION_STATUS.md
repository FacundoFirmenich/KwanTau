# KWAN integral integration — SHADOW staging

This branch is a governed textual audit surface for migration into the canonical repository **`FacundoFirmenich/KwanTau2DOS`**. It is not the canonical source tree and must not be merged into `main` as a substitute for the sealed Git bundle.

## Canon

- **KWAN** is always written with K + W.
- **KwanTau2DOS** is the canonical repository name.
- **KwanTau DOS** = **KwanTau Dual Operational System**.
- **No run. No implant. Ride.**
- In Spanish use **centrum** for KWAN-developed architectural centra; in English, **core** is acceptable.
- **KwanBlocks** is canonical and plural. KwanBlogs never existed.
- Capability ≠ support ≠ permission ≠ authority ≠ execution ≠ training.
- Rehydration, replay, import, installation, mission presence and CI PASS do not transport ACTIVE authority.
- KwanMe personal payloads do not become ambient model context by default.
- KwanBlocks has authority ceiling `NONE`.

## Current release

- Release: **KwanTau2DOS v0.25.0-alpha.1 — Durable Mission Runtime and Human Authority Console**
- Release commit: `b99ee39b2f11adfebf78cb604816879935023622`
- Feature commit: `823cef1a69ac17ba9a302d6c61ba3ec81ac87be2`
- Predecessor: `2be70dc224ea4fab05db1f118adc4722b2ca83b4`
- Tests: **198 executed, 197 passed, 1 explicit conditional Wasmtime skip** in source, clean ZIP and clean bundle clone
- Logical files: `619`
- Logical tree SHA-256: `5abdb778c7c2519eff80929eaf5c8238bacaf8ebce01de6f43a15983497b4320`
- Git bundle SHA-256: `572e183076053683df90dcf422eb591c39f10567dd7294083fdaf0721010841a`
- Release ZIP SHA-256: `ee683efd3c30e7071a214f57585346787bfbd0d73c7bf72f6f8833768f2ae073`
- Kwan Browser SHA-256: `99a7a53e5df54fd095bd42a7d95d1acca457f795614b305c1ba4376838362408`
- Delivery SHA-256: `d026ddb241c495a8c0388ea989f7980e917e179838534c501a4bc9c47b129fa3`

## Integral result

v0.25 converts the v0.24 mission DAG into a durable local runtime while preserving all nineteen mandatory components:

```text
sealed integral mission
→ durable run and work queue
→ dependency-aware scheduler
→ worker claim and heartbeat
→ human authority request
→ exact human decision record
→ separate component execution lease
→ observed effect binding
→ mission-scoped closure
```

The runtime exposes 28 services and SQLite schema v23. It does not own a universal execution capability. Worker claims coordinate work only; human approval records consent only; productive completion requires a separately authorised and already observed component effect.

## Material fixture

The fixture executes a real local encrypted KwanMe document effect inside a temporary isolated home:

```text
nonproductive step                         SUCCEEDED
productive step before approval            WAITING_HUMAN
human decision                             APPROVE
missing execution lease                    rejected
exact KwanMe execution lease               required
local encrypted effect                     COMPLETED
bound observed effect                      true
mission run                                SUCCEEDED
```

```text
scientific claim                           PROTOCOL_FIXTURE_ONLY
local material effect                      true
external effect                            false
authority granted by mission               false
promotion performed                        false
cleartext at rest                          absent
```

## Recovery and authority boundaries

- expired claims for safe unstarted nonproductive work may return to the queue;
- claimed or running work found after rehydration is quarantined;
- no work is replayed automatically;
- no authority is reissued;
- a human approval is not a productive KCH lease;
- a mission claim is not execution authority;
- pause, resume and abort obey explicit state transitions;
- rejected secret-like decision constraints do not consume the one-time authority challenge.

## Claim boundary

Demonstrated:

- durable local scheduling and dependency reconciliation;
- exact worker claims and heartbeat expiry;
- human authority requests with alternatives, consequences and reversibility;
- encrypted rationale and fail-closed local challenge;
- separation between human decision and component execution authority;
- local encrypted KwanMe effect and exact effect binding;
- productive completion only after observed effect evidence;
- fail-closed rehydration without replay or authority reissue;
- source/ZIP/bundle logical equivalence.

Not demonstrated:

- distributed or multihost scheduling;
- global ACID across mission and effect stores;
- production external effects;
- general exactly-once execution;
- remote human identity attestation;
- production security hardening;
- real-world user utility;
- ACTIVE readiness or scientific superiority.

## Repository state

The current `FacundoFirmenich/KwanTau` repository remains a SHADOW textual staging surface. `main` is untouched. The canonical target `FacundoFirmenich/KwanTau2DOS` is not claimed as created. The complete Git bundle and publication script are sealed for exact migration.

## Next legitimate gate

`v0.26 — Federated Mission Execution and Attested Human Authority`: coordinate mission work and effect outboxes transactionally, add multihost worker fencing, attest human-console sessions, connect exact compensation and adjudication paths, and execute the first explicitly approved non-fixture mission without allowing mission success to mint authority or scientific validity.
