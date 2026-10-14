# CreaLabs experimental matrices

The v0.13 matrix is an additive SHADOW structure for paired and adversarial
comparison. It requires baseline, candidate, ablation and negative-control
cells and records each cell's terminal Sweetbox run independently.

The first adjudicator is deliberately conservative: it verifies completeness
and preserves result hashes by role. It does **not** declare scientific
superiority, average heterogeneous cells, or promote a candidate.

Future adjudicators may add domain-specific statistics, repeated seeds,
uncertainty intervals and preregistered decision rules. Those adjudicators must
be independently versioned and their output must remain evidence rather than
authority.
