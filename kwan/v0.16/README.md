# KwanTau2DOS v0.16.0-alpha.1

**Durable Multi-Store Effect Constitution — No run. No implant. Ride.**

This directory is a SHADOW staging receipt. The complete canonical history is carried by the sealed Git bundle for `FacundoFirmenich/KwanTau2DOS`; this predecessor repository is not the final container.

## Identity

```text
branch:       kwantau2dos/v0.16.0-alpha.1
tag:          v0.16.0-alpha.1
commit:       d194794a9de022e3778241bc5be5e227873b20ec
feature:      2efe487a2e9409f18c5fc026b41585f1ce1ab533
predecessor:  24c58815e889b3c6a3912b159be6501644b8e1c5
merge:        41e11e04d554df023ab7a6df255efd4abd536949
logical tree: f2ad41c886a79dd8b92d16fb88a08e33358a04c80c16afdd87339c69ec0442b6
```

## Material frontier

```text
KCH intent + lease reservation
→ durable outbox
→ independent adapter inbox
→ epoch-plus-holder fence
→ host effect
→ observation and recovery
→ terminal / contested KwanBlocks evidence
```

The release distinguishes reversible, compensable and irreversible effects; injects crashes at four boundaries; rejects stale and colliding holders; preserves `UNCERTAIN`; requires new authority for adjudication; and models compensation as a separately authorised successor effect.

## Validation

```text
source validation                  PASS
clean ZIP validation               PASS
clean bundle-clone validation      PASS
logical files                      332
132 tests collected                131 passed + 1 conditional skip
material durable-effect demo       PASS
schema                             v14
runtime services                   15
mandatory components               19
```

The conditional skip is the actual-Wasmtime local test because this host lacked the binary. Pinned v0.14 evidence preserves the exact Component Model vector under Wasmtime 49.0.2 on Linux and Windows. The skip is not counted as a pass.

## Non-equivalences

```text
idempotency ≠ distributed exactly-once
hash equality ≠ semantic correctness
receipt ≠ truth universal
compensation ≠ deletion of history
availability ≠ correctness
evidence ≠ authority
```
