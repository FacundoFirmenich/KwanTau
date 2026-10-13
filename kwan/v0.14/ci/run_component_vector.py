#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
import subprocess
import sys


def canonical_hash(document: dict) -> str:
    material = json.dumps(document, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(material).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", required=True)
    parser.add_argument("--contract", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--platform", required=True)
    args = parser.parse_args()

    engine = pathlib.Path(args.engine).resolve()
    contract_path = pathlib.Path(args.contract).resolve()
    contract = json.loads(contract_path.read_text(encoding="utf-8"))
    artifact = (contract_path.parent / pathlib.Path(contract["artifact_path"]).name).resolve()

    findings: list[str] = []
    if contract.get("realm") != "SHADOW": findings.append("realm is not SHADOW")
    if contract.get("authority_inherited") is not False: findings.append("authority inherited")
    if contract.get("productive_effects") is not False: findings.append("productive effects enabled")
    if contract.get("promotion") != "BLOCKED": findings.append("promotion is not blocked")
    for boundary in ("filesystem", "network", "environment", "secrets"):
        if contract.get(boundary) != "DENY": findings.append(f"{boundary} is not denied")
    artifact_hash = hashlib.sha256(artifact.read_bytes()).hexdigest()
    if artifact_hash != contract.get("artifact_sha256"):
        findings.append("artifact SHA-256 mismatch")

    engine_version = subprocess.check_output([str(engine), "--version"], text=True).strip()
    invocation = f'{contract["entrypoint"]}({contract["arguments"][0]}, {contract["arguments"][1]})'
    completed = subprocess.run(
        [str(engine), "run", "--invoke", invocation, str(artifact)],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    combined = "\n".join(part for part in (completed.stdout.strip(), completed.stderr.strip()) if part)
    integers = [int(value) for value in re.findall(r"(?<![A-Za-z0-9_])-?\d+(?![A-Za-z0-9_])", combined)]
    observed = integers[-1] if integers else None
    if completed.returncode != 0: findings.append(f"engine exit code {completed.returncode}")
    if observed != contract.get("expected_result"): findings.append(f"expected 42, observed {observed!r}")

    report = {
        "format": "KWANTAU2DOS_V014_EXTERNAL_COMPONENT_VECTOR_EVIDENCE_V1",
        "platform": args.platform,
        "engine": "wasmtime",
        "engine_version": engine_version,
        "engine_sha256": hashlib.sha256(engine.read_bytes()).hexdigest(),
        "contract_sha256": hashlib.sha256(contract_path.read_bytes()).hexdigest(),
        "artifact_sha256": artifact_hash,
        "invocation_sha256": hashlib.sha256(invocation.encode("utf-8")).hexdigest(),
        "expected_result": contract.get("expected_result"),
        "observed_result": observed,
        "exit_code": completed.returncode,
        "stdout_sha256": hashlib.sha256(completed.stdout.encode("utf-8")).hexdigest(),
        "stderr_sha256": hashlib.sha256(completed.stderr.encode("utf-8")).hexdigest(),
        "passed": not findings,
        "findings": findings,
        "authority_granted": False,
        "promotion_performed": False,
        "scientific_claim_created": False,
        "full_broker_integration_claimed": False
    }
    report["report_sha256"] = canonical_hash(report)
    output = pathlib.Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report, sort_keys=True))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
