# KWAN integral integration — SHADOW staging

This branch is a governed staging surface for migration into the canonical repository **`FacundoFirmenich/KwanTau2DOS`**.

## Canon

- **KWAN** is always K + W.
- **KwanTau2DOS** is the canonical repository name.
- **KwanTau DOS** = **KwanTau Dual Operational System**.
- **No run. No implant. Ride.**
- In Spanish use **centrum** for KWAN-developed architectural centra; in English, **core** is acceptable.
- **KwanBlocks** is canonical and plural. KwanBlogs never existed.
- Capability ≠ support ≠ permission ≠ authority ≠ execution ≠ training.
- Rehydration, replay, import, installation and CI PASS do not transport ACTIVE authority.
- KwanMe personal payloads do not become ambient model context by default.
- KwanBlocks has authority ceiling `NONE`.

## Current release

- Release: **KwanTau2DOS v0.16.0-alpha.1 — Durable Multi-Store Effect Constitution**
- Release commit: `d194794a9de022e3778241bc5be5e227873b20ec`
- Feature commit: `2efe487a2e9409f18c5fc026b41585f1ce1ab533`
- Predecessor: `24c58815e889b3c6a3912b159be6501644b8e1c5`
- Preserved merge: `41e11e04d554df023ab7a6df255efd4abd536949`
- Tests: **132 collected, 131 passed, 1 conditional skip** in source, ZIP and bundle clone
- Logical files: `332`
- Logical tree SHA-256: `f2ad41c886a79dd8b92d16fb88a08e33358a04c80c16afdd87339c69ec0442b6`
- Git bundle SHA-256: `49f2d1b30f34d259603a000695d31f79be56ebfb9e90e52671329066ccd43381`
- Release ZIP SHA-256: `6b8f06c56d8774a5f22215cd5e0338a379f4995c808edf3074956d85b9de1e1e`
- Delivery SHA-256: `9a590507b86f11014d3de150232e5fdf2332719cc326a4cc0f1762cc5eaf4777`

## Material result

v0.16 introduces a durable effect constitution across KCH, an independent adapter inbox, host state and KwanBlocks without pretending that those stores share one global ACID transaction.

```text
intent + exact lease reservation
→ durable KCH outbox
→ independently fenced adapter inbox
→ host effect
→ external observation
→ terminal or contested KwanBlocks receipt
```

Effects are typed as `REVERSIBLE`, `COMPENSABLE` or `IRREVERSIBLE`. Recovery observes evidence and never blindly resends an uncertain effect. Adjudication and compensation require new exact authority. Compensation is a successor effect; it never rewrites the original receipt.

## Claim boundary

Demonstrated:

- stable effect and outbox identities;
- encrypted intent and HMAC-protected idempotency bindings;
- epoch-plus-holder fencing, including same-epoch/different-holder rejection;
- independent adapter SQLite inbox;
- four injected crash boundaries;
- exact observation-based recovery;
- typed adjudication with fresh authority;
- separately authorised successor compensation;
- KwanBlocks evidence with authority ceiling `NONE`;
- source/ZIP/bundle logical equivalence.

Not demonstrated:

- global ACID;
- distributed exactly-once execution;
- consensus or a linearizable federated fence service;
- arbitrary remote-effect observation;
- compensation of irreversible effects;
- production security hardening;
- ACTIVE readiness or scientific superiority.

## Repository state

The current `FacundoFirmenich/KwanTau` repository remains a SHADOW staging surface. `main` is untouched. The canonical target `FacundoFirmenich/KwanTau2DOS` is not claimed as created because the connected GitHub interface does not expose account-level repository creation. The complete Git bundle and publication script are sealed for exact migration once that repository exists.

## Next legitimate gate

`v0.17 — Typed External Effect Adapters and Federated Fencing`: messaging, publication and payment-like adapter contracts; shared linearizable fencing or explicit fail-closed substitutes; external observation receipts; domain-specific compensation classes; and multihost fault injection under partitions without treating availability as correctness.
