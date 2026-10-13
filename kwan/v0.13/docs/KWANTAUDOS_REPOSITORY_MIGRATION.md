# Repository migration to `KwanTauDOS`

The canonical remote repository name is **`KwanTauDOS`**, with KWAN written
K+W and DOS as the acronym for **Dual Operational System**.

The predecessor remote `FacundoFirmenich/KwanTau` contains an OpenClaw-derived
history and remains a staging source. Migration must be additive and auditable:

1. create `FacundoFirmenich/KwanTauDOS`;
2. import the full KWAN Git lineage without rewriting predecessor commits;
3. push the v0.13 branch as `kwan-ecosystem/v0.13.0-alpha.1`;
4. preserve upstream/OpenClaw attribution and licences where reused;
5. protect `main`; integrate through SHADOW pull requests;
6. retain release bundles and their SHA-256 receipts;
7. never infer authority from repository presence, CI PASS or mergeability.

The connected GitHub interface used for this release can write branches,
commits, issues and pull requests to existing repositories, but exposes no
administrative endpoint to create or rename a repository. A write probe to
`FacundoFirmenich/KwanTauDOS` returned 404. Therefore the prepared release is
staged on the existing remote until the new repository container exists.
