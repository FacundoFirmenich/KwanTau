# KwanTau2DOS v0.18.0-alpha.1

**Replicated Fencing, Attested Adapters and Jurisdictional Preflight**  
**No run. No implant. Ride.**

This directory is the textual SHADOW staging receipt for v0.18. The complete canonical history is carried by the sealed Git bundle for `FacundoFirmenich/KwanTau2DOS`; this predecessor repository is not the final container.

## Exact identity

```text
branch:       kwantau2dos/v0.18.0-alpha.1
tag:          v0.18.0-alpha.1
commit:       d5b1d98ae1dca175905e100dc73e9e0a61998b1d
feature:      6d10057ef8ff89c4f9284612cecbd0fa49a53db4
predecessor:  883551b881aa9ff34a05749466983790c8dfe44d
merge:        41e11e04d554df023ab7a6df255efd4abd536949
logical tree: 27bba9042224294088802e1dc8536bf97ebf2cf326a796537eff40f1cf429bad
```

## Sovereign external gate

```text
replicated fence
+ mTLS workload identity
+ signed software-measurement attestation
+ Country World jurisdictional preflight
→ request binding
→ exact KCH authority
```

A positive result in one plane never substitutes for another:

```text
mTLS identity ≠ software attestation
software attestation ≠ KCH authority
KCH authority ≠ jurisdictional support
jurisdictional support ≠ fence ownership
fence ownership ≠ execution
execution ≠ observed effect
```

## Validation

```text
source validation                  PASS
clean ZIP validation               PASS
clean bundle-clone validation      PASS
153 tests collected                152 PASS + 1 conditional skip
material demo                      PASS
logical files                      399
schema                             v16
runtime services                   17
mandatory components               19
```

The skip is the local material Wasmtime test because the release host lacked the binary. It is not counted as a pass.

## External etcd gate

Run `38497097598` executed a self-contained protocol vector against a real three-member etcd 3.7.2 cluster. It survived leader loss with quorum, advanced one successor epoch and denied acquisition after quorum loss. The full product client was validated separately by the local suite and is not claimed to have executed in that workflow.

## Limits

This release does not claim SPIRE issuance, hardware attestation, replicated CA, production provider assurance, globally complete Country World data, legal correctness, distributed exactly-once effects, Byzantine tolerance or ACTIVE readiness.
