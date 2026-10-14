# KwanTau2DOS v0.19.0-alpha.1 — SHADOW staging receipt

This branch stages **Federated Trust, Attestation Transparency and Bitemporal Country World Evidence** for later exact migration into the canonical repository `FacundoFirmenich/KwanTau2DOS`.

## Canonical identities

```text
release:        0.19.0-alpha.1
branch:         kwantau2dos/v0.19.0-alpha.1
release commit: cbc557e25c46b195f8e389609c2e6a83e3b188f3
predecessor:    d5b1d98ae1dca175905e100dc73e9e0a61998b1d
source ZIP:     b405bfb055e3b7920d48a0db45813a35f2f0a64a8c25b9e148b2515e2b872aa9
Git bundle:     48695db3f6837380c60583acbf3e837941a691f13af9c8ad3524afc80297ed26
source capsule: bfe6095d0985cb517ea48fed1c503963ec4b2b8cc18decdb22dc9ac4b5457906
```

## Material result

- 160 tests collected;
- 159 passed;
- one explicit conditional Wasmtime skip;
- zero failures, errors or timeouts;
- SQLite schema v17;
- 21 registered services;
- 19 mandatory architectural components;
- 439 logical files;
- logical tree SHA-256 `440a7c0ec06eef24fd0806b7d58855d34e4700befe19f1bc6b2d5370efb62275`.

## Scientific boundary

Material:

- pinned SPIFFE-style X.509 trust-bundle admission and rotation;
- exact X.509-SVID verification;
- signed local append-only Merkle log and inclusion receipts;
- bitemporal Country World source snapshots and claims;
- source-family and independence-group resolution;
- request binding across trust, inclusion, evidence and replicated fence.

Not claimed:

- SPIRE issuance;
- hardware attestation;
- externally witnessed transparency;
- global non-equivocation;
- complete Country World coverage;
- legal correctness;
- production readiness;
- authority or promotion derived from evidence.

## Repository boundary

This staging branch is **not** the canonical repository and must not be merged into `main` as a substitute. Exact migration requires the Git bundle above. The remote repository `FacundoFirmenich/KwanTau2DOS` was not available through the connected installation when this receipt was produced.
