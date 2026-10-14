#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import signal
import socket
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path
from typing import Any


def canonical_hash(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def post(endpoint: str, path: str, body: dict[str, Any], timeout: float = 0.8) -> dict[str, Any]:
    request = urllib.request.Request(
        endpoint.rstrip("/") + path,
        data=json.dumps(body, separators=(",", ":")).encode(),
        method="POST",
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode())


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def range_one(endpoints: list[str], key: bytes) -> tuple[dict[str, Any] | None, str, int]:
    errors: list[str] = []
    for endpoint in endpoints:
        try:
            document = post(endpoint, "/v3/kv/range", {"key": b64(key), "serializable": False, "limit": "1"})
            header = document.get("header") or {}
            revision = int(header.get("revision") or 0)
            rows = document.get("kvs") or []
            if not rows:
                return None, str(header.get("cluster_id") or ""), revision
            row = rows[0]
            return {
                "value": json.loads(base64.b64decode(row["value"]).decode()),
                "mod_revision": int(row["mod_revision"]),
                "version": int(row["version"]),
            }, str(header.get("cluster_id") or ""), revision
        except Exception as exc:
            errors.append(f"{endpoint}:{type(exc).__name__}")
    raise RuntimeError("all linearizable ranges failed: " + ";".join(errors))


def compare_put(endpoints: list[str], key: bytes, value: dict[str, Any], expected_mod: int | None) -> tuple[bool, str, int]:
    compare = ({"key": b64(key), "target": "VERSION", "result": "EQUAL", "version": "0"}
               if expected_mod is None else
               {"key": b64(key), "target": "MOD", "result": "EQUAL", "mod_revision": str(expected_mod)})
    body = {
        "compare": [compare],
        "success": [{"request_put": {"key": b64(key), "value": b64(json.dumps(value, sort_keys=True, separators=(",", ":")).encode())}}],
        "failure": [{"request_range": {"key": b64(key), "limit": "1"}}],
    }
    errors: list[str] = []
    for endpoint in endpoints:
        try:
            document = post(endpoint, "/v3/kv/txn", body)
            header = document.get("header") or {}
            return bool(document.get("succeeded")), str(header.get("cluster_id") or ""), int(header.get("revision") or 0)
        except Exception as exc:
            errors.append(f"{endpoint}:{type(exc).__name__}")
    raise RuntimeError("all conditional writes failed: " + ";".join(errors))


def acquire(endpoints: list[str], resource: str, holder: str) -> dict[str, Any]:
    key = f"/kwan/v018/fences/{hashlib.sha256(resource.encode()).hexdigest()}".encode()
    for _ in range(32):
        current, cluster_id, _ = range_one(endpoints, key)
        epoch = int((current or {}).get("value", {}).get("epoch", 0)) + 1
        record = {"format": "KWAN_V018_ETCD_FENCE_V1", "resource": resource, "holder": holder, "epoch": epoch}
        ok, observed_cluster, revision = compare_put(endpoints, key, record, current["mod_revision"] if current else None)
        if ok:
            return {**record, "cluster_id": observed_cluster or cluster_id, "etcd_revision": revision}
        time.sleep(0.05)
    raise RuntimeError("CAS retry budget exhausted")


def status(endpoints: list[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for endpoint in endpoints:
        try:
            document = post(endpoint, "/v3/maintenance/status", {})
            rows.append({"endpoint": endpoint, "reachable": True, **document})
        except Exception as exc:
            rows.append({"endpoint": endpoint, "reachable": False, "error": type(exc).__name__})
    return rows


def wait_cluster(endpoints: list[str], minimum: int, timeout: float = 30.0) -> list[dict[str, Any]]:
    deadline = time.monotonic() + timeout
    last: list[dict[str, Any]] = []
    while time.monotonic() < deadline:
        last = status(endpoints)
        reachable = [row for row in last if row.get("reachable")]
        leaders = {str(row.get("leader")) for row in reachable if str(row.get("leader") or "0") != "0"}
        if len(reachable) >= minimum and leaders:
            return last
        time.sleep(0.25)
    raise RuntimeError(f"cluster did not become ready: {last}")


def terminate(process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
        process.wait(timeout=8)
    except (ProcessLookupError, subprocess.TimeoutExpired):
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait(timeout=5)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--etcd", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    etcd = Path(args.etcd).resolve()
    started = time.monotonic()
    processes: list[subprocess.Popen[str]] = []
    logs = []
    report: dict[str, Any] = {
        "format": "KWANTAU2DOS_V018_EXTERNAL_ETCD_GATE_V1",
        "etcd_sha256": hashlib.sha256(etcd.read_bytes()).hexdigest(),
        "authority_granted": False,
        "promotion_performed": False,
        "local_fallback": False,
        "scope": "ETCD_RAFT_KV_FENCING_PROTOCOL_VECTOR",
        "full_product_client_executed": False,
        "distributed_exactly_once_claimed": False,
    }
    try:
        with tempfile.TemporaryDirectory(prefix="kwan-v018-etcd-") as temp:
            root = Path(temp)
            client_ports = [free_port() for _ in range(3)]
            peer_ports = [free_port() for _ in range(3)]
            names = [f"kwan-etcd-{i}" for i in (1, 2, 3)]
            endpoints = [f"http://127.0.0.1:{port}" for port in client_ports]
            peers = [f"http://127.0.0.1:{port}" for port in peer_ports]
            cluster = ",".join(f"{name}={peer}" for name, peer in zip(names, peers))
            for index, name in enumerate(names):
                log = (root / f"{name}.log").open("w+", encoding="utf-8")
                logs.append(log)
                command = [str(etcd), "--name", name, "--data-dir", str(root / f"data-{index}"),
                           "--listen-client-urls", endpoints[index], "--advertise-client-urls", endpoints[index],
                           "--listen-peer-urls", peers[index], "--initial-advertise-peer-urls", peers[index],
                           "--initial-cluster", cluster, "--initial-cluster-state", "new",
                           "--initial-cluster-token", "kwantau-v018", "--logger", "zap", "--log-level", "error"]
                processes.append(subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT, text=True, start_new_session=True))

            initial = wait_cluster(endpoints, 3)
            leader_id = next(str(row["leader"]) for row in initial if row.get("reachable") and str(row.get("leader") or "0") != "0")
            leader_index = next(i for i, row in enumerate(initial)
                                if str((row.get("header") or {}).get("member_id")) == leader_id)
            first = acquire(endpoints, "publication:v018-quorum", "host-before-leader-failure")
            terminate(processes[leader_index])
            survivors = [endpoint for i, endpoint in enumerate(endpoints) if i != leader_index]
            after_failure = wait_cluster(survivors, 2)
            second = acquire(survivors, "publication:v018-quorum", "host-after-leader-failure")
            if second["epoch"] != first["epoch"] + 1:
                raise RuntimeError("epoch did not advance exactly once")
            current, _, _ = range_one(survivors, f"/kwan/v018/fences/{hashlib.sha256('publication:v018-quorum'.encode()).hexdigest()}".encode())
            if not current or current["value"]["holder"] != second["holder"]:
                raise RuntimeError("successor fence was not current")

            remaining = [i for i, proc in enumerate(processes) if proc.poll() is None]
            terminate(processes[remaining[0]])
            lone = [endpoints[i] for i, proc in enumerate(processes) if proc.poll() is None]
            time.sleep(1.0)
            no_quorum_rejected = False
            error = ""
            try:
                acquire(lone, "publication:v018-quorum", "host-without-quorum")
            except Exception as exc:
                no_quorum_rejected = True
                error = f"{type(exc).__name__}:{exc}"
            if not no_quorum_rejected:
                raise RuntimeError("acquisition succeeded without quorum")

            report.update({
                "passed": True,
                "cluster_size": 3,
                "leader_failure_continuity": True,
                "quorum_loss_failed_closed": True,
                "initial_epoch": first["epoch"],
                "successor_epoch": second["epoch"],
                "cluster_id": first["cluster_id"],
                "initial_status_sha256": canonical_hash(initial),
                "post_failure_status_sha256": canonical_hash(after_failure),
                "quorum_loss_error_sha256": hashlib.sha256(error.encode()).hexdigest(),
            })
    except Exception as exc:
        report.update({"passed": False, "error": f"{type(exc).__name__}:{exc}"})
    finally:
        for process in processes:
            terminate(process)
        for log in logs:
            try:
                log.close()
            except Exception:
                pass
    report["elapsed_seconds"] = round(time.monotonic() - started, 3)
    report["report_sha256"] = canonical_hash(report)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"passed": report.get("passed"), "report_sha256": report["report_sha256"]}, sort_keys=True))
    return 0 if report.get("passed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
