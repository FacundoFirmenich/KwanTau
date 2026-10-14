#!/usr/bin/env bash
set -euo pipefail
BUNDLE="${1:-kwantau_dos_kwan_enforced_operator_fabric_v0_13_0.bundle}"
REMOTE="${2:-git@github.com:FacundoFirmenich/KwanTauDOS.git}"
TARGET="${3:-KwanTauDOS}"
BRANCH="kwan-ecosystem/v0.13.0-alpha.1"
EXPECTED_HEAD="4fca70ff36c0b050d22ad8d4787ce44df0bf0992"
rm -rf "$TARGET"
git clone -b "$BRANCH" "$BUNDLE" "$TARGET"
cd "$TARGET"
ACTUAL_HEAD="$(git rev-parse HEAD)"
[ "$ACTUAL_HEAD" = "$EXPECTED_HEAD" ] || { echo "unexpected HEAD: $ACTUAL_HEAD" >&2; exit 1; }
git remote remove origin || true
git remote add origin "$REMOTE"
printf 'Prepared %s at %s.\n' "$TARGET" "$ACTUAL_HEAD"
printf 'After the KwanTauDOS repository exists, publish with:\n  git push -u origin %s\n' "$BRANCH"
