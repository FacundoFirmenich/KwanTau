# RFC-0004 — Ride como primitiva operacional de KwanTau DOS

**Estado:** Implemented reference runtime / pre-production  
**Versión:** 0.4.0  
**Motto canónico:** **No run. No implant. Ride.**

## 1. Resumen

KwanTau DOS adopta **Ride** como unidad primaria de continuidad usuario–máquina. Ride reemplaza dos modelos inadecuados:

1. **run**, que reduce la inteligencia a una ejecución episódica y descartable;
2. **implant**, que sugiere inserción invasiva, permanencia no controlada o apropiación del host.

Una Ride es una trayectoria durable, desmontable y portable, conducida por un principal humano, que puede aprender mediante señales explícitas y producir efectos únicamente a través de KCH y de un borde de capacidades del host.

## 2. Terminología normativa

- **MUST / DEBE:** invariante obligatorio.
- **MUST NOT / NO DEBE:** conducta prohibida.
- **SHOULD / DEBERÍA:** conducta recomendada cuya excepción exige justificación y receipt.
- **MAY / PUEDE:** capacidad opcional que no altera los invariantes.

## 3. Definición formal

Para un usuario o principal `u`, una Ride en el tiempo `t` se modela como:

\[
R_u(t)=\langle I_u, K_t, M_t, L_t, A_t, E_t, C_t, P_t \rangle
\]

con:

- `I_u`: identidad y raíces criptográficas;
- `K_t`: estado durable y event spine;
- `M_t`: modelos, memorias y habilidades personales;
- `L_t`: leases vigentes;
- `A_t`: políticas y autoridad contextual;
- `E_t`: efectos observados y receipts;
- `C_t`: checkpoints y genealogía;
- `P_t`: superficies y hosts actualmente acoplados.

La transición productiva admisible es:

\[
(K_t,\,\text{Intent})
\xrightarrow{\text{KCH preflight}}
\text{Lease}
\xrightarrow{\text{Host adapter}}
\text{Effect}
\xrightarrow{\text{Observation}}
\text{Receipt}
\xrightarrow{\text{append}}
K_{t+1}
\]

Sin lease verificable, el borde productivo DEBE permanecer inalcanzable.

## 4. Dualidad operacional

KwanTau DOS no reemplaza el kernel anfitrión. La dualidad se distribuye así:

| Host OS | KwanTau DOS |
|---|---|
| CPU, memoria, drivers, syscalls | intenciones, misiones, evidencia, autoridad |
| usuarios y tokens del host | principals, roles y leases KCH |
| procesos e hilos | tareas, agentes y ramas |
| rutas físicas | objetos y recursos lógicos |
| scheduler de CPU | scheduler de misiones |
| resultado técnico | effect receipt y límite observacional |

KwanTau DOS DEBE poder desmontarse sin alterar la soberanía del host. El host PUEDE reiniciarse o cambiar; la Ride conserva genealogía, pero NO conserva automáticamente autoridad.

## 5. Estados

Los estados canónicos son:

```text
PROVISIONED
    ↓ mount
MOUNTED
    ↓ begin
RIDING ⇄ PAUSED
    ↓ detach
DETACHED

cualquier estado materialmente sospechoso → QUARANTINED
```

No existe un estado `RUNNING`.

### 5.1 PROVISIONED

Identidad, charter, almacén y políticas iniciales existen. No prueba aprendizaje ni autoridad productiva.

### 5.2 MOUNTED

El arnés está acoplado a un host concreto y se registra su perfil de enforcement. Montar no equivale a iniciar efectos.

### 5.3 RIDING

La continuidad está activa. Pueden emitirse intents, pero cada efecto sigue necesitando preflight y lease.

### 5.4 PAUSED

Se revocan leases vigentes y se suspende la fase de aprendizaje. El estado durable permanece.

### 5.5 DETACHED

No existe host activo. La identidad y la historia permanecen, pero no hay ejecución productiva posible.

### 5.6 QUARANTINED

Estado de contención ante corrupción, conflicto de identidad o sospecha de compromiso. No puede montarse mediante el flujo ordinario.

## 6. Reinos

- **ACTIVE:** único reino capaz de recibir autoridad productiva.
- **SHADOW:** investigación, replay, entrenamiento candidato y simulación; autoridad productiva cero.
- **QUARANTINE:** objetos o ramas retenidos para análisis; no activables automáticamente.

Una rama SHADOW puede disponer de capacidades internas acotadas para escribir su checkpoint o evidencia. Eso NO equivale a autoridad sobre el mundo externo.

## 7. Separaciones constitucionales

KwanTau DOS DEBE preservar:

```text
capability ≠ support ≠ permission ≠ authority ≠ execution ≠ training
```

En particular:

- una capability disponible no implica que esté permitida;
- una recomendación no es autoridad;
- una política favorable no es ejecución;
- una ejecución no prueba que el efecto externo ocurrió como se esperaba;
- una experiencia aprendida no amplía permisos;
- la repetición de una salida del modelo no constituye evidencia independiente.

## 8. Aprendizaje personal

Todos los modelos propios DEBEN declarar un contrato de aprendibilidad:

- señales admitidas;
- estado modificable;
- mecanismo de actualización;
- ámbito de transferencia esperado;
- evaluación requerida;
- procedimiento de reversión o reconstrucción;
- claim ceiling.

La referencia 0.4.0 implementa un router Beta–Bernoulli future-only. Las señales pasivas no actualizan el estado. La vía paramétrica no está configurada y DEBE fallar sin afirmar entrenamiento.

## 9. Primera inflación usuario–máquina

La Ride comienza en `FIRST_INFLATION`. El cierre de esta fase requiere:

1. un checkpoint candidato sellado en SHADOW;
2. una evaluación prospectiva registrada;
3. ausencia de regresión crítica;
4. promoción explícita;
5. asociación del checkpoint con el estado durable.

Cerrar la primera inflación sólo prueba el alcance evaluado. No prueba inteligencia general ni mejora universal.

## 10. KCH y efectos

Cada intent contiene al menos:

- principal;
- misión;
- capability;
- recurso;
- efecto declarado;
- realm;
- host;
- reversibilidad y compensación;
- mínimo perfil de enforcement;
- contexto jurisdiccional cuando corresponda.

KCH puede decidir `APPLY`, `TOP_2`, `ASK`, `SHADOW`, `ABSTAIN` o `DENY`. La referencia sólo emite lease ante políticas no ambiguas, enforcement suficiente y realm compatible.

## 11. Durabilidad e idempotencia

El consumo de lease y el staging del efecto DEBEN ocurrir en una única transacción durable. La clave de idempotencia evita consumir dos veces el lease ante redelivery idéntico.

Esto no demuestra exactly-once para un efecto externo arbitrario. Entre la acción externa y su receipt puede existir una ventana de incertidumbre. Cada adapter DEBE declarar su estrategia de reconciliación.

## 12. Receipts y límites observacionales

Todo intento de efecto debe producir un receipt con:

- estado observado;
- fingerprint cuando exista;
- límite observacional;
- host;
- enlace al event spine;
- detalles no secretos.

Un receipt demuestra lo observado por la instrumentación declarada, no verdad universal.

## 13. Portabilidad

Una exportación `.ktride` DEBE:

- cifrarse y autenticarse;
- incluir manifest firmado y hashes;
- excluir autoridad transferible;
- revocar leases en la copia;
- importar como `DETACHED`;
- rotar el token del daemon;
- exigir montaje y nueva autoridad en el destino.

Portabilidad de identidad y aprendizaje no es continuidad automática de autoridad.

## 14. Superficies

Kwan Browser, Telegram, voz, CLI, panel móvil y escritorio son superficies desmontables. Ninguna superficie es el sistema completo. Cerrar una superficie no detiene la Ride ni borra misiones.

## 15. Country World

Country World es un servicio sistémico, no una decoración del navegador. Produce claims jurisdiccionales tipados, con procedencia, confianza, estado epistemológico y tiempo de validez. No concede autoridad.

La referencia 0.4.0 sólo deriva `DOMAIN_DELEGATION_HINT` desde un ccTLD y deja explícitamente sin resolver domicilio, control, infraestructura, datos y fiscalidad.

## 16. Conformidad mínima

Una implementación conforme a este RFC DEBE demostrar al menos:

- ausencia de `RUNNING` como estado;
- default-deny;
- cero autoridad productiva en SHADOW;
- leases firmados, acotados y revocables;
- consumo atómico e idempotente;
- event spine verificable;
- aprendizaje future-only y explícito;
- promoción sin autoridad;
- portabilidad sin leases;
- desmontaje reversible;
- claim ceilings públicos.
