# Kwan Operator Fabric

## Object model

A Kwan operator is a signed manifest bound to exact module bytes and a canonical
WIT contract. The registry deliberately separates **declaration**, **support**,
**authority** and **execution**.

```text
module bytes
  + WIT hash
  + lane
  + budgets
  + filesystem grants
  + network policy
  + environment declaration
      ↓ canonical manifest
      ↓ local Ed25519 signature
Kwan operator registry
      ↓ KCH lease required later
Sweetbox execution
      ↓ receipt
KwanBlocks evidence
```

### Statuses

- `REGISTERED_SHADOW`: the declared contract fits an actually material lane.
- `DECLARED_BLOCKED`: preserved for inspection, but at least one required
  enforcement property is unavailable or unproven.
- `REVOKED`: reserved for explicit revocation semantics.

A blocked manifest is not automatically weakened to fit the host.

## Privacy and authority

The manifest may describe capability classes but must not embed secrets. Secret
use, when implemented, must occur through KwanMe handles and a protected broker.
No operator manifest transports a KCH lease.
