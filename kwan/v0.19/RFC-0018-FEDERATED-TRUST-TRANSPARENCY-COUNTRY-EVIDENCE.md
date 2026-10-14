# RFC-0018 — Federated Trust, Attestation Transparency and Bitemporal Country World Evidence

**Status:** alpha implementation, `SHADOW` by default  
**Release:** `v0.19.0-alpha.1`  
**Authority inherited:** `false`  
**Automatic promotion:** `false`

## Abstract

Version 0.19 removes three ambient assumptions from the v0.18 sovereign external-effect path:

1. a remote workload identity is no longer accepted merely because a locally configured CA signed it;
2. provider attestation is no longer a transient observation without append-only inclusion evidence;
3. Country World no longer collapses provider self-assertions, official registries and unknown relations into one undifferentiated preflight.

The successor introduces explicit federated trust bundles, a signed append-only local attestation log, and a bitemporal evidence plane with source-family and independence-group semantics. A productive request may be prepared only after its workload identity, attestation inclusion, evidence resolution and replicated fence are bound into the canonical request.

## Constitutional separation

```text
trust anchor presence       != authority
SVID validity               != permission
attestation inclusion       != global transparency
official-source observation != legal conclusion
Country World SUPPORT       != KCH lease
fence token                 != effect authority
```

KCH remains the only authority path. KwanBlocks records evidence with authority ceiling `NONE`.

## Federated trust bundle

The implemented bundle profile is a strict SPIFFE-style X.509-SVID JWK Set:

- explicit trust domain;
- monotonically increasing sequence;
- pinned canonical SHA-256;
- strict CA certificate validation;
- EC and RSA public-parameter consistency;
- overlapping trust-anchor rotation by default;
- rollback and same-sequence replay rejection;
- exact X.509-SVID URI SAN, EKU, KeyUsage and validity verification.

The reference service does not discover endpoints, issue SVIDs, run SPIRE or claim hardware-backed identity.

## Attestation transparency

The local log uses domain-separated SHA-256 Merkle leaves and internal nodes, signed tree heads, inclusion proofs and append-only index enforcement. It produces local evidence that an attestation was included in this KwanTau2DOS log.

It does **not** demonstrate public non-equivocation because no external witness or transparency gossip is present. The release reports `external_witness_count=0` and `global_transparency_claimed=false`.

## Country World evidence plane

Claims are bitemporal:

```text
valid_from / valid_to  -> when the relation applies in the world
observed_at            -> when KwanTau2DOS learned it
knowledge_cutoff       -> evidence visible to a resolution
```

Every claim retains subject, typed relation, territory code, epistemic status, source snapshot, source family, independence group, confidence, evidence body and both time axes.

The resolver preserves unresolved, contradictory, stale, excluded and provider-only evidence. Policies may require independent source groups and non-provider corroboration. Global or provider averages cannot substitute for missing local relations.

The bundled IANA excerpt is intentionally narrow. TLD presence means only `DOMAIN_DELEGATION_HINT`; RDAP bootstrap means only `RDAP_SERVICE_DISCOVERY`. Neither establishes domicile, ownership, hosting, tax residence, data jurisdiction or political status. M49 validates identifiers only.

## Bound external request

The federated sovereign gateway binds into the canonical effect request:

- active trust-domain bundle sequence and hash;
- verified provider SPIFFE ID and SVID certificate hash;
- provider attestation hash and measurements;
- local transparency entry, tree size and signed root;
- Country World resolution ID, body hash and source snapshots;
- replicated fence identity;
- original effect payload hash.

Changing any bound field changes the request identity and invalidates a previously issued lease.

## Demonstrated

- pinned trust-bundle import and rollback rejection;
- overlapping trust-anchor rotation;
- exact X.509-SVID verification;
- signed Merkle tree heads and inclusion verification;
- official IANA excerpt ingestion with pinned bytes;
- provider-attestation source separation;
- bitemporal selection at explicit valid time and knowledge cutoff;
- independent-source and provider-only gates;
- end-to-end provider publication after trust, inclusion, evidence and fence binding;
- zero authority or promotion from evidence.

## Not demonstrated

- SPIRE issuance or bundle-endpoint discovery;
- hardware-backed attestation;
- public transparency witnesses or cross-log gossip;
- production legal correctness of Country World;
- complete IANA, GLEIF, BODS, registry, ASN, payment or supply-chain coverage;
- Byzantine provider tolerance;
- global consensus or distributed exactly-once effects;
- `ACTIVE` readiness.

## Next gate

The next legitimate gate is a witnessed trust and evidence fabric: external log witnesses, trust-bundle endpoint discovery with pinned roots, production source adapters with signed snapshots, source-correlation analysis, and jurisdiction-specific policy packs. It must preserve the same rule: corroboration and transparency inform KCH but do not create authority.
