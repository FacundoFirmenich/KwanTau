#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="$ROOT/enforcement/linux"
EVIDENCE_DIR="${KWAN_EVIDENCE_DIR:-$ROOT/evidence/v013-linux-enforcement}"
WASMTIME_BIN="${KWAN_WASMTIME_BIN:-}"
mkdir -p "$EVIDENCE_DIR"

if [[ -z "$WASMTIME_BIN" || ! -x "$WASMTIME_BIN" ]]; then
  echo "KWAN_WASMTIME_BIN must point to an executable" >&2
  exit 64
fi
for cmd in gcc bwrap sudo setpriv sha256sum python3; do command -v "$cmd" >/dev/null || { echo "missing $cmd" >&2; exit 65; }; done
[[ -f /usr/include/seccomp.h ]] || { echo "libseccomp headers missing" >&2; exit 66; }

BUILD="$(mktemp -d)"
INPUT="$(mktemp -d)"
OUTPUT="$(mktemp -d)"
CG="/sys/fs/cgroup/kwan-v013-${GITHUB_RUN_ID:-$$}"
cleanup() {
  sudo rmdir "$CG" 2>/dev/null || true
  rm -rf "$BUILD" "$INPUT" "$OUTPUT"
}
trap cleanup EXIT

gcc -O2 -Wall -Wextra -o "$BUILD/landlock-exec" "$SRC/landlock_exec.c"
gcc -O2 -Wall -Wextra -o "$BUILD/make-seccomp-filter" "$SRC/make_seccomp_filter.c" -lseccomp
gcc -O2 -Wall -Wextra -o "$BUILD/fs-probe" "$SRC/fs_probe.c"
gcc -O2 -Wall -Wextra -o "$BUILD/socket-probe" "$SRC/socket_probe.c"
gcc -O2 -Wall -Wextra -o "$BUILD/pids-probe" "$SRC/pids_probe.c"
"$BUILD/make-seccomp-filter" "$BUILD/filter.bpf"

cat > "$INPUT/add.wat" <<'WAT'
(module
  (func (export "add") (param i32 i32) (result i32)
    local.get 0
    local.get 1
    i32.add))
WAT

echo "probe" > "$INPUT/probe.txt"

if [[ ! -f /sys/fs/cgroup/cgroup.controllers ]]; then
  echo "cgroup v2 unavailable" >&2
  exit 70
fi
sudo mkdir "$CG"
if [[ ! -e "$CG/memory.max" || ! -e "$CG/pids.max" || ! -e "$CG/cpu.max" ]]; then
  echo "+cpu +memory +pids" | sudo tee /sys/fs/cgroup/cgroup.subtree_control >/dev/null || true
fi
[[ -e "$CG/memory.max" && -e "$CG/pids.max" && -e "$CG/cpu.max" ]] || { echo "required cgroup controllers unavailable" >&2; exit 71; }
echo 268435456 | sudo tee "$CG/memory.max" >/dev/null
echo 16 | sudo tee "$CG/pids.max" >/dev/null
echo "50000 100000" | sudo tee "$CG/cpu.max" >/dev/null

uid="$(id -u)"; gid="$(id -g)"
sudo "$SRC/cgroup_exec.sh" "$CG" "$uid" "$gid" "$BUILD/pids-probe" | tee "$EVIDENCE_DIR/pids-probe.txt"
grep -q 'blocked_errno=11' "$EVIDENCE_DIR/pids-probe.txt"

set +e
bwrap --die-with-parent --new-session --unshare-user --unshare-pid --unshare-ipc --unshare-uts \
  --ro-bind /usr /usr --ro-bind /bin /bin --ro-bind /lib /lib --ro-bind-try /lib64 /lib64 \
  --proc /proc --dev /dev --tmpfs /tmp --dir /input --dir /output --dir /opt --dir /opt/kwan \
  --bind "$INPUT" /input --bind "$OUTPUT" /output --ro-bind "$BUILD/fs-probe" /opt/kwan/fs-probe \
  /opt/kwan/fs-probe /input/control-write.txt /output/control-write.txt \
  >"$EVIDENCE_DIR/landlock-control.out" 2>"$EVIDENCE_DIR/landlock-control.err"
landlock_control_rc=$?
set -e
[[ "$landlock_control_rc" -eq 1 ]]
rm -f "$INPUT/control-write.txt" "$OUTPUT/control-write.txt"

bwrap --die-with-parent --new-session --unshare-user --unshare-pid --unshare-ipc --unshare-uts \
  --ro-bind /usr /usr --ro-bind /bin /bin --ro-bind /lib /lib --ro-bind-try /lib64 /lib64 \
  --proc /proc --dev /dev --tmpfs /tmp --dir /input --dir /output --dir /opt --dir /opt/kwan \
  --bind "$INPUT" /input --bind "$OUTPUT" /output \
  --ro-bind "$BUILD/landlock-exec" /opt/kwan/landlock-exec \
  --ro-bind "$BUILD/fs-probe" /opt/kwan/fs-probe \
  /opt/kwan/landlock-exec \
    --ro /usr --ro /bin --ro /lib --ro /lib64 --ro /proc --ro /opt/kwan --ro /input \
    --rw /dev --rw /tmp --rw /output -- \
    /opt/kwan/fs-probe /input/landlock-denied.txt /output/landlock-allowed.txt \
  >"$EVIDENCE_DIR/landlock-enforced.out" 2>"$EVIDENCE_DIR/landlock-enforced.err"
[[ ! -e "$INPUT/landlock-denied.txt" && -e "$OUTPUT/landlock-allowed.txt" ]]
grep -q 'KWAN_LANDLOCK_ABI=' "$EVIDENCE_DIR/landlock-enforced.err"

set +e
"$BUILD/socket-probe" >"$EVIDENCE_DIR/seccomp-control.out" 2>&1
seccomp_control_rc=$?
set -e
[[ "$seccomp_control_rc" -eq 1 ]]

(
  exec 9<"$BUILD/filter.bpf"
  bwrap --die-with-parent --new-session --unshare-all \
    --ro-bind /usr /usr --ro-bind /bin /bin --ro-bind /lib /lib --ro-bind-try /lib64 /lib64 \
    --proc /proc --dev /dev --tmpfs /tmp --dir /opt --dir /opt/kwan \
    --ro-bind "$BUILD/socket-probe" /opt/kwan/socket-probe --seccomp 9 \
    /opt/kwan/socket-probe
) >"$EVIDENCE_DIR/seccomp-enforced.out" 2>"$EVIDENCE_DIR/seccomp-enforced.err"
grep -q 'socket_errno=1' "$EVIDENCE_DIR/seccomp-enforced.out"

(
  export KWAN_SECCOMP_FILE="$BUILD/filter.bpf"
  sudo --preserve-env=KWAN_SECCOMP_FILE "$SRC/cgroup_exec.sh" "$CG" "$uid" "$gid" \
    bwrap --die-with-parent --new-session --unshare-all \
      --ro-bind /usr /usr --ro-bind /bin /bin --ro-bind /lib /lib --ro-bind-try /lib64 /lib64 \
      --proc /proc --dev /dev --tmpfs /tmp --dir /input --dir /output --dir /opt --dir /opt/kwan \
      --bind "$INPUT" /input --bind "$OUTPUT" /output \
      --ro-bind "$BUILD/landlock-exec" /opt/kwan/landlock-exec \
      --ro-bind "$WASMTIME_BIN" /opt/kwan/wasmtime --seccomp 9 \
      /opt/kwan/landlock-exec \
        --ro /usr --ro /bin --ro /lib --ro /lib64 --ro /proc --ro /opt/kwan --ro /input \
        --rw /dev --rw /tmp --rw /output -- \
        /opt/kwan/wasmtime run --invoke add /input/add.wat 17 25
) >"$EVIDENCE_DIR/operator.out" 2>"$EVIDENCE_DIR/operator.err"
grep -Eq '(^|[^0-9])42([^0-9]|$)' "$EVIDENCE_DIR/operator.out"

memory_max="$(cat "$CG/memory.max")"
pids_max="$(cat "$CG/pids.max")"
cpu_max="$(cat "$CG/cpu.max")"
memory_peak="$(cat "$CG/memory.peak" 2>/dev/null || echo unknown)"
pids_peak="$(cat "$CG/pids.peak" 2>/dev/null || echo unknown)"
landlock_abi="$(sed -n 's/.*KWAN_LANDLOCK_ABI=//p' "$EVIDENCE_DIR/landlock-enforced.err" | tail -1)"
filter_sha="$(sha256sum "$BUILD/filter.bpf" | awk '{print $1}')"
wasmtime_sha="$(sha256sum "$WASMTIME_BIN" | awk '{print $1}')"

python3 - "$EVIDENCE_DIR/report.json" <<PY
import json, pathlib, platform, hashlib, sys
out = pathlib.Path(sys.argv[1])
d = {
  "format": "KWAN_LINUX_ENFORCEMENT_GATE_V1",
  "gate": "v0.13.0-alpha.1",
  "result": "PASS",
  "host": {"platform": platform.platform()},
  "cgroup_v2": {"material": True, "memory_max": "$memory_max", "pids_max": "$pids_max", "cpu_max": "$cpu_max", "memory_peak": "$memory_peak", "pids_peak": "$pids_peak", "pids_limit_probe": "PASS"},
  "seccomp": {"material": True, "dedicated_filter_sha256": "$filter_sha", "socket_denied_with_eperm": True},
  "landlock": {"material": True, "abi": int("$landlock_abi"), "read_only_input_denied_write": True, "declared_output_write_allowed": True},
  "namespaces": {"bubblewrap_material": True, "network_namespace_unshared": True},
  "wasmtime": {"sha256": "$wasmtime_sha", "operator_result": 42, "material": True},
  "composition": {"cgroup_plus_bwrap_plus_seccomp_plus_landlock_plus_wasmtime": True},
  "wasi_component_model": {"material": False, "reason": "This gate still executes the exact core-WebAssembly operator; the component-model lane remains fail-closed."},
  "complete_enforced_core_wasm_lane": True,
  "complete_enforced_wasi_lane": False,
  "authority_granted": False,
  "promotion_performed": False,
}
raw = json.dumps(d, sort_keys=True, separators=(",", ":")).encode()
d["report_sha256"] = hashlib.sha256(raw).hexdigest()
out.write_text(json.dumps(d, indent=2, sort_keys=True) + "\n")
print(json.dumps({"result": d["result"], "report_sha256": d["report_sha256"]}, sort_keys=True))
PY

cat "$EVIDENCE_DIR/report.json"
