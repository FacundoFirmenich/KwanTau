#!/usr/bin/env bash
set -euo pipefail

BUNDLE="${1:-KwanTau2DOS_v0_16_0-alpha.1.bundle}"
REMOTE="${2:-git@github.com:FacundoFirmenich/KwanTau2DOS.git}"
TARGET="${3:-KwanTau2DOS}"
BRANCH="kwantau2dos/v0.16.0-alpha.1"
TAG="v0.16.0-alpha.1"
EXPECTED_HEAD="d194794a9de022e3778241bc5be5e227873b20ec"
EXPECTED_BUNDLE_SHA256="49f2d1b30f34d259603a000695d31f79be56ebfb9e90e52671329066ccd43381"

actual_bundle_sha256="$(sha256sum "$BUNDLE" | awk '{print $1}')"
[ "$actual_bundle_sha256" = "$EXPECTED_BUNDLE_SHA256" ] || { echo "bundle SHA-256 mismatch: $actual_bundle_sha256" >&2; exit 1; }
git bundle verify "$BUNDLE"
rm -rf "$TARGET"
git clone -b "$BRANCH" "$BUNDLE" "$TARGET"
cd "$TARGET"
[ "$(git rev-parse HEAD)" = "$EXPECTED_HEAD" ] || { echo "unexpected HEAD" >&2; exit 1; }
[ "$(git rev-list -n1 "$TAG")" = "$EXPECTED_HEAD" ] || { echo "unexpected tag" >&2; exit 1; }
git remote remove origin || true
git remote add origin "$REMOTE"
echo "Verified KwanTau2DOS $TAG. Publish explicitly with:"
echo "  git push -u origin $BRANCH"
echo "  git push origin $TAG"
