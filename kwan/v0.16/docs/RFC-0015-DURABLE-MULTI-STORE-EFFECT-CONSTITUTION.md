# RFC-0015 — KwanTau2DOS Durable Multi-Store Effect Constitution

**Status:** executable alpha  
**Release:** `0.16.0-alpha.1`  
**Realm:** `SHADOW`  
**Authority inherited:** false  
**Automatic promotion:** blocked

## Purpose

The effect constitution coordinates KCH authority, an independent adapter inbox, a material resource and KwanBlocks evidence without claiming a global ACID transaction. It makes uncertainty first-class and forbids blind replay after an effect may have reached the world.

## Effect classes

- `REVERSIBLE`: exact preimage or `ABSENT` marker is preserved; compensation may restore it.
- `COMPENSABLE`: a successor compensation payload is declared ex ante.
- `IRREVERSIBLE`: no compensation is admitted; uncertain outcomes require adjudication or unresolved closure.

## Durable protocol

```text
intent + exact KCH lease reservation
→ encrypted intent + durable outbox
→ independent adapter inbox
→ epoch-plus-holder fence
→ material effect
→ external observation
→ terminal or contested receipt
```

Stable identities and HMAC-protected idempotency prevent ambiguous rebinding. The adapter rejects stale epochs and also equal epochs presented by a different holder.

## Recovery

Recovery observes current evidence. It may conclude `APPLIED`, `NOT_APPLIED` or `UNCERTAIN`; it never blindly redispatches an uncertain effect. Historical evidence that an effect was applied remains immutable even if a later compensation changes current resource state.

## Adjudication and compensation

Adjudication requires a fresh capability `durable_effect.adjudicate`. Compensation requires a separate capability `durable_effect.compensate`; it is a successor effect with its own lease, identity and receipt. The original effect and adverse evidence remain preserved.

## Crash matrix

Fault injection is materialised at four boundaries: after KCH prepare, after adapter accept, after host effect before terminal receipt, and after terminal adapter evidence before KCH finalisation. Reconciliation is idempotent and does not reissue authority.

## Limits

This release does not demonstrate global ACID, distributed exactly-once, consensus, a linearizable shared fence service, arbitrary remote observation, irreversible compensation or production security hardening. Hash equality proves byte identity under the declared serializer, not semantic correctness.
