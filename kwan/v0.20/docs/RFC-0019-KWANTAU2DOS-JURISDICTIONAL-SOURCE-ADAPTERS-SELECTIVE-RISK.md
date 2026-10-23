# RFC-0019 — KwanTau2DOS Jurisdictional Source Adapters and Selective-Risk Calibration

**Status:** executable alpha  
**Release:** `0.20.0-alpha.1`  
**Realm:** `SHADOW`  
**Authority inherited:** false  
**Automatic promotion:** blocked

## 1. Purpose

Country World must not become a global country classifier whose mean score hides local failures. v0.20 introduces typed adapters for real source families and a selective-risk gate whose primary unit is the relation, territory and relation×territory stratum. Global summaries remain descriptive accessories.

The gate separates:

```text
source transport
≠ parser correctness
≠ evidence independence
≠ calibrated local support
≠ jurisdictional authority
≠ KCH execution authority
```

## 2. Typed source contracts

A `SourceAdapterContract` binds the parser to:

- adapter type and semantic version;
- publisher and source family;
- independence group;
- exact source URLs;
- raw schema identifier;
- relations it is permitted to emit;
- credential mode;
- update cadence and maximum staleness;
- licence note and trust assumptions;
- upstream dependencies.

Registration and ingestion require distinct one-shot KCH leases. A payload is bound by SHA-256 before parsing. The parser cannot emit an undeclared relation.

## 3. Initial adapters

The release materialises:

- GLEIF Level 1 legal-entity reference;
- GLEIF Level 2 accounting-parent relationships;
- Open Ownership BODS 0.4 statements;
- RIPEstat AS Overview;
- RIPE Database `aut-num` excerpts;
- PeeringDB network records;
- IANA ccTLD delegation records.

The included records are pinned, real-source factual excerpts or explicit schema contracts. The release never fabricates entity claims to fill coverage gaps.

## 4. Dependency graph

Evidence independence is not inferred from page count. The source graph records:

```text
MIRROR_OF
DERIVED_FROM
AGGREGATES
SAME_PUBLISHER
INDEPENDENT
```

GLEIF Level 1 and Level 2 share an upstream governance regime. RIPEstat holder information is linked to RIPE registry data. Those relations prevent source multiplicity from becoming false independent support.

## 5. Selective-risk calibration

Calibration cases declare a real adjudication reference, relation, expected territories or abstention, and evidence tier:

```text
INDEPENDENT_EXTERNAL
SAME_UPSTREAM_CONSISTENCY
SCHEMA_CONFORMANCE
```

The gate can require any combination of:

```text
RELATION
TERRITORY
RELATION_TERRITORY
TIER
```

For each stratum, it records cases, decisions, errors, abstentions, conflicts, coverage and a Jeffreys-posterior upper bound on selective error. A stratum is:

```text
ELIGIBLE
INSUFFICIENT
FAIL
DESCRIPTIVE_ONLY
```

The final decision is:

```text
SUPPORT   all required local strata eligible
ABSTAIN   at least one required local stratum insufficient
DENY      at least one required local stratum fails
```

A favourable global summary cannot override a local abstention or failure.

## 6. Initial empirical boundary

Five independent-external IANA/M49 extraction cases support the `DOMAIN_DELEGATION_HINT` relation as a parser stratum. The same corpus contains only one case per territory, so every required relation×territory stratum abstains. This is the intended result: relation-level competence is not silently promoted into jurisdiction-level operational support.

The corpus is deliberately small and non-representative. It establishes an executable protocol, not general Country World accuracy.

## 7. Ecosystem integration

- **KCH** issues exact registration, ingestion and calibration leases.
- **Country World Evidence Fabric** stores bitemporal claims.
- **KwanBlocks** stores source-run and calibration receipts with authority ceiling `NONE`.
- **CreaLabs** can later preregister larger calibration matrices.
- **KwanMe** supplies opaque credentials only when a future source requires them.
- **Kwan Browser** exposes status and evidence without becoming the authority centrum.
- **Provider Federation** and **replicated fencing** remain separate prerequisites for external effects.

## 8. Limits

This release does not demonstrate representative global calibration, legal correctness, complete beneficial ownership, complete infrastructure geography, or production source freshness. Curated excerpts are not claimed to be byte-exact responses unless explicitly declared. A calibration report creates no KCH lease, permission, execution or scientific authority.
