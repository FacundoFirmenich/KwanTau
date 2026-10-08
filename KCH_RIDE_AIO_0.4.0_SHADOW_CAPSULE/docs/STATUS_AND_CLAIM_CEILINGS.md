# Estado y límites de afirmación

## 1. Implementado y probado

| Componente | Evidencia en 0.4.0 | Claim permitido |
|---|---|---|
| Ride lifecycle | tests de estados y reversibilidad | existe continuidad durable local |
| KCH default-deny | tests de policy y realm | intents no autorizados se bloquean |
| Leases Ed25519 | firma, TTL, max uses, binding | leases firmados y acotados localmente |
| Consumo + outbox | concurrencia y transacción | una entrega idéntica no consume dos leases |
| Event spine | tamper test | modificaciones cubiertas por el chain son detectables |
| Aprendizaje router | outcomes explícitos y futuros | actualización bayesiana local real |
| Payload privado | cifrado y ausencia en eventos | el texto privado no se almacena en claro en esos campos |
| Checkpoints | create/evaluate/promote/taint | promoción gobernada del router personal |
| Portabilidad | export/import/tamper | bundle autenticado; no transfiere leases |
| Country World | ccTLD hint tests | hint técnico conservador, no nacionalidad |
| Scheduler/HOQ | dependencies/fencing/receipt + `work-once` | claims durables; ejecución aún atraviesa KCH |
| Observer–Jarvis | proposal/adoption tests | propone y prepara intents, sin autoautoridad |
| Surfaces | attach/heartbeat/detach tests | interfaces desmontables sin propiedad del estado |
| Sweetbox | zero-authority test | rama SHADOW sin autoridad productiva |
| Truqueplace | signature/hash/quarantine | artefacto verificado entra en cuarentena |
| Daemon/API | auth/status/fabric tests + OpenAPI coverage | API loopback autenticada y documentada |
| Chromium surface | MV3/no content scripts/JS syntax | panel local operativo; no fork Chromium |

## 2. Especificado, no materializado

- fork completo de Chromium y páginas `kwan://`;
- Jarvis multimodal ambiental;
- Telegram container y broker de envío;
- sincronización multidispositivo;
- adapters E2/E3 por sistema operativo;
- lane WASI;
- remote executor atestado;
- updater firmado y canales de release;
- marketplace público;
- entrenamiento paramétrico de LLM;
- unlearning paramétrico verificable;
- federación privada;
- hardware-backed keys.

## 3. Afirmaciones prohibidas

Esta release no puede describirse como:

- sistema operativo de producción;
- sandbox seguro frente a host comprometido;
- inteligencia general entrenada por el usuario;
- Chromium propio ya construido;
- exactly-once universal;
- privacidad absoluta;
- unlearning completo de pesos;
- Country World capaz de determinar el país “real” de cualquier objeto;
- Jarvis autónomo con autoridad propia.

## 4. Interpretación de “modelo entrenable”

En 0.4.0 existe entrenamiento/actualización real sólo para el router bayesiano y consolidación de memoria cifrada. La lane paramétrica informa `NOT_CONFIGURED`. Recordar una regla no se presenta como ajuste de pesos.

## 5. Interpretación de “Ride desplegada”

Significa que el runtime puede instalarse, provisionarse, montarse, continuar estado, aprender mediante señales explícitas, emitir leases, producir receipts, operar misiones HOQ, registrar superficies, propuestas Jarvis y ramas Sweetbox, verificar paquetes en cuarentena, exportarse e importarse en una máquina de desarrollo. No significa que todos los productos de la suite ya estén implementados ni que exista aislamiento nativo de producción.
