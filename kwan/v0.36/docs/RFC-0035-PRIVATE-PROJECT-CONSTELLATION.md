# RFC-0035 — KwanTau2DOS Private Project Constellation and Decision Inbox

**Status:** executable alpha  
**Release:** `0.36.0-alpha.1`  
**Realm:** `SHADOW`  
**Authority inherited:** false

## Purpose

KwanFront and the Multiproject Attention Router need a durable private account of which projects exist, what currently holds focus, which decisions remain genuinely human and what work the system can continue without interruption. v0.36 supplies that state without converting project presence, routing or workload into authority.

## State planes

```text
private plane
  project label
  private metadata
  decision descriptor

public operational plane
  opaque identifiers
  hashes
  lifecycle
  vector load state
  routing disposition
```

Private payloads are encrypted locally. Public receipts contain hashes and counts only.

## Vector routing

The service preserves independent dimensions for user decisions, system-resolvable work, blocked missions, deadlines, irreversible boundaries, privacy, authority and unknown items. No scalar priority score exists.

```text
SYSTEM_RESOLVABLE → BACKGROUND
active-project USER_ONLY → considered within card and word budgets
critical cross-project USER_ONLY → considered within switch budget
all other open items → DEFERRED with explicit reason
```

## Trial cohorts

The constellation can summarize prospective attention-policy cases by project and arm. It cannot change assignment, adjudicate a human decision or activate a policy.

## Claim boundary

The material gate ingests twenty private project labels, marks one current focus and preserves nineteen statuses as `UNKNOWN`. It does not claim those projects are inactive, blocked or lower priority. No prospective cognitive benefit is claimed.
