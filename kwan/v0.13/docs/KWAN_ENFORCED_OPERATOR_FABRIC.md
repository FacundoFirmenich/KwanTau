# Kwan Enforced Operator Fabric

The fabric is the bridge between a typed experimental intention and a future
host-enforced execution. It has three material parts in v0.13:

1. **Signed operator registry.** Content-addressed contracts and artifacts,
   stored in SHADOW with authority and promotion fixed to false.
2. **Host enforcement assessment.** Evidence-bearing SUPPORT, DENY or ABSTAIN
   over the actual host profile. Assessment never creates a lease.
3. **Preregistered experimental matrices.** Baseline/candidate/ablation/control
   plans with seed-bound observations and explicit adverse-evidence rules.

## Non-equivalences

```text
registered ≠ executable
signed ≠ safe
supported ≠ authorised
conformant ≠ promoted
candidate win ≠ scientific validation
host primitive present ≠ host primitive enforced
```

## Data boundaries

Contracts may name logical resources but not absolute host paths. Secret access
is either denied or delegated through opaque handles in future adapters. Network
access is denied unless an explicit allowlist and non-zero request budget are
both present. PURE_WASM has no filesystem, network, environment or secret
capabilities.
