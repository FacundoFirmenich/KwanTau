# KwanTau DOS Ride Operational Fabric

## 1. Invariante central

```text
claim ≠ permission ≠ authority ≠ execution ≠ receipt
```

Una tarea puede estar lista y ser reclamada por un worker sin que exista autoridad para producir su efecto. HOQ organiza trabajo; KCH decide si un intent recibe un lease; el host adapter ejecuta sólo después de consumirlo; el receipt conserva el límite de observación.

## 2. Flujo material

```text
Mission
  └─ Task PENDING
       └─ fenced claim + TTL
            └─ ActionIntent
                 └─ KCH preflight
                      ├─ DENY / ABSTAIN / ASK / SHADOW
                      └─ APPLY + bounded lease
                           └─ consume + transactional outbox
                                └─ host capability handler
                                     └─ EffectReceipt
                                          └─ fenced task completion
```

`mission-work-once` materializa este recorrido para una tarea. El worker no recibe una autoridad reusable: recibe un claim de cola, y el intent posterior debe ser adjudicado de nuevo.

## 3. Observer–Jarvis

Jarvis conserva tres fronteras:

1. `PROPOSED`: draft cifrado y audit-safe summary; `authority_granted=false`.
2. `ADOPTED`: el usuario o una superficie autorizada convierte el draft en `ActionIntent`; todavía no existe lease.
3. `APPLIED`: transición separada que pasa por KCH y puede terminar bloqueada.

No hay ruta `proposal → effect` que saltee preflight.

## 4. Surfaces

Las superficies son interfaces desmontables: Kwan Browser, CLI, móvil, voz, Telegram, desktop o headless. Registran capacidades de interacción, host y heartbeat, pero:

```text
state_ownership = false
authority_inheritance = 0
```

Cerrar Kwan Browser no desmonta la Ride. Desmontar la Ride sí revoca leases.

## 5. Sweetbox

Toda rama se crea en SHADOW con `authority_inheritance=0`. Los trials cifran resultados privados y publican sólo hashes/metadata audit-safe. Cerrar una rama no promueve nada; la promoción cognitiva utiliza el pipeline checkpoint → evaluation → explicit promotion.

## 6. Truqueplace

La referencia verifica:

- firma Ed25519 del provider;
- digest del artefacto;
- digest del SBOM;
- capabilities declaradas;
- minimum enforcement declarado.

El resultado entra en `market/quarantine/...`; `activated=false` y `authority_granted=false`. La activación futura requiere su propio RFC, sandbox y gate de autorización.

## 7. Country World

Country World entrega evidencia contextual a intents y misiones. En 0.4.0 sólo resuelve conservadoramente metadatos técnicos limitados. Ningún claim territorial concede permiso o autoridad.

## 8. Continuidad

La continuidad reside en SQLite WAL, event spine, object store, checkpoints y bundles `.ktride`; no en una pestaña. Una importación queda `DETACHED`, sin leases activos y con token local rotado.
