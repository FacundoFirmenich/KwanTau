#!/usr/bin/env bash
set -euo pipefail
cg="$1"; uid="$2"; gid="$3"; shift 3
printf '%s\n' "$$" > "$cg/cgroup.procs"
exec /usr/bin/setpriv --reuid="$uid" --regid="$gid" --clear-groups -- "$@"
