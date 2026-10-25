# RFC-0037 — Persistent Encrypted State Replication and Human-Bound Federated Failover

**Status:** executable SHADOW alpha  
**Release:** `0.41.0-alpha.1`  
**Authority inherited:** false  
**Training eligibility:** false  
**Automatic merge, execution and promotion:** blocked

## Purpose

Replicate private lifecycle state to an exact recipient host without transporting KCH leases, authority codes, sessions or source-host authority. Preserve concurrent branches explicitly and require a human-bound two-parent successor. Permit failover only into a fresh local Ride using a current fence, explicit decision, local KCH leases and locally unlocked KwanMe.

## Snapshot envelope

A snapshot binds:

```text
lifecycle
source host and principal
source signing key
recipient host and X25519 key
parent snapshot set
vector clock
state package SHA-256
manifest SHA-256
chunk identities
signature
```

The package is encrypted with an ephemeral X25519 key, HKDF-SHA256 and AES-256-GCM. Import verifies recipient identity, source-key pin, signature, manifest and every chunk before re-encrypting the package under the recipient host master key.

## Divergence

Sibling descendants of the same parent are retained as a divergence. Last-write-wins is unsupported. Resolution requires a local one-time authority challenge and a KCH lease bound to the exact divergence, selected basis and rationale. The result is a new snapshot whose parents contain both branches.

## Failover

A failover request binds a pinned inbound snapshot, a pinned recovery capsule, a current local fence claim, a fresh local Ride and expiry. Approval and activation use separate authorities. Activation writes one private packet into local KwanMe and terminates in `RECOVERED_SHADOW`.

## Crash recovery

Before crossing into KwanMe the lifecycle stores the reservation ID and lease nonce. If KwanMe commits but the failover record does not, recovery verifies the exact packet and effect receipt, then finalises the original reservation. It never reissues authority or replays the effect.

## Boundaries

```text
snapshot identity ≠ authority
recipient decryption ≠ failover permission
Ride continuity ≠ lease continuity
divergence ≠ last-write-wins
recovery ≠ replay
RECOVERED_SHADOW ≠ ACTIVE
fixture decision ≠ real user approval
```

## Current result

```text
RECIPIENT_ENCRYPTED_REPLICATION_VALIDATED
EXPLICIT_DIVERGENCE_VALIDATED
TWO_PARENT_SUCCESSOR_VALIDATED_WITH_FIXTURE_AUTHORITY
HUMAN_BOUND_SHADOW_FAILOVER_VALIDATED_WITH_FIXTURE_DECISION
ACTIVE_REHYDRATION_NOT_IMPLEMENTED
REAL_USER_FAILOVER_APPROVAL_UNRESOLVED
NO_CAUSAL_CLAIM
```
