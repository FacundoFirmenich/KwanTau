from __future__ import annotations

import pytest

from kwantau_dos.canonical import canonical_bytes
from kwantau_dos.crypto import sha256_bytes
from kwantau_dos.errors import IntegrityError
from kwantau_dos.operator_fabric import (
    DeterminismMode,
    EnforcementDecision,
    ExperimentalMatrixPlan,
    FilesystemGrant,
    HostEnforcementProfile,
    MatrixArm,
    MatrixArmRole,
    MatrixMetric,
    MatrixVerdict,
    MetricDirection,
    NetworkGrant,
    NetworkMode,
    OperatorCapabilityContract,
    OperatorLane,
    OperatorResourceBudget,
)


ADD_WASM = bytes.fromhex(
    "0061736d01000000"
    "01070160027f7f017f"
    "03020100"
    "070701036164640000"
    "0a09010700200020016a0b"
)


def _contract(operator_id: str, version: str = "1.0.0") -> OperatorCapabilityContract:
    return OperatorCapabilityContract(
        operator_id=operator_id,
        operator_version=version,
        artifact_sha256=sha256_bytes(ADD_WASM),
        lane=OperatorLane.PURE_WASM,
        entrypoint="add",
        resource_budget=OperatorResourceBudget(
            cpu_millis=1000,
            wall_millis=2000,
            memory_bytes=32 * 1024 * 1024,
            output_bytes=1024 * 1024,
            open_files=0,
            process_count=1,
            network_requests=0,
        ),
        determinism=DeterminismMode.DETERMINISTIC,
        declared_metrics=["QUALITY", "LATENCY"],
    )


def _register(runtime, ride_id: str, contract: OperatorCapabilityContract):
    token = runtime.leases.issue(
        ride_id=ride_id,
        capability="sweetbox.operator_contract.register",
        resource={
            "contract_id": contract.contract_id,
            "artifact_sha256": contract.artifact_sha256,
        },
        realm="SHADOW",
    )
    return runtime.operator_fabric.register_contract(
        contract=contract,
        artifact_bytes=ADD_WASM,
        ride_id=ride_id,
        lease_token=token,
    )


def test_signed_operator_contract_is_content_addressed_and_zero_authority(runtime):
    ride = runtime.rides.mount()
    contract = _contract("kwan.matrix.probe")
    record = _register(runtime, ride.ride_id, contract)

    assert record.contract_id == contract.contract_id
    assert record.authority_inherited is False
    assert record.productive_effects is False
    assert record.promoted is False
    verified = runtime.operator_fabric.verify_contract(record.contract_id)
    assert verified["valid"] is True
    assert verified["authority_granted"] is False
    assert verified["execution_granted"] is False
    assert verified["promotion"] == "BLOCKED"

    profile = HostEnforcementProfile(
        platform="LINUX",
        kernel_release="test",
        cgroup_v2_present=True,
        cgroup_v2_writable=False,
        seccomp_mode=2,
        landlock_listed=False,
        user_namespaces_available=True,
        unshare_path="/usr/bin/unshare",
        bubblewrap_path=None,
        wasmtime_path=None,
        node_path="/usr/bin/node",
        profile_hash="a" * 64,
        observed_at="2026-10-13T00:00:00Z",
    )
    assessment = runtime.operator_fabric.assess_contract(record.contract_id, profile)
    assert assessment.decision is EnforcementDecision.SUPPORT
    assert assessment.authority_granted is False
    assert assessment.execution_granted is False

    artifact = runtime.config.operator_fabric_dir / record.artifact_relative_path
    original = artifact.read_bytes()
    artifact.write_bytes(original + b"tamper")
    with pytest.raises(IntegrityError, match="digest mismatch"):
        runtime.operator_fabric.verify_contract(record.contract_id)


def test_contract_model_denies_ambient_capabilities_and_host_paths():
    with pytest.raises(ValueError, match="logical resource identifiers"):
        FilesystemGrant(resource_id="/etc/passwd", access="READ")
    with pytest.raises(ValueError, match="wildcard"):
        NetworkGrant(protocol="https", host="*", ports=[443])
    with pytest.raises(ValueError, match="cannot receive filesystem"):
        OperatorCapabilityContract(
            operator_id="kwan.invalid.ambient",
            operator_version="1.0.0",
            artifact_sha256="a" * 64,
            lane=OperatorLane.PURE_WASM,
            entrypoint="run",
            filesystem_grants=[
                FilesystemGrant(resource_id="kwan://workspace/input", access="READ")
            ],
        )
    with pytest.raises(ValueError, match="ALLOWLIST requires"):
        OperatorCapabilityContract(
            operator_id="kwan.invalid.network",
            operator_version="1.0.0",
            artifact_sha256="a" * 64,
            lane=OperatorLane.NATIVE,
            entrypoint="run",
            network_mode=NetworkMode.ALLOWLIST,
            resource_budget=OperatorResourceBudget(network_requests=1),
        )


def test_native_contract_fails_closed_when_host_enforcement_is_incomplete(runtime):
    ride = runtime.rides.mount()
    artifact = b"native-shadow-probe"
    contract = OperatorCapabilityContract(
        operator_id="kwan.native.probe",
        operator_version="1.0.0",
        artifact_sha256=sha256_bytes(artifact),
        lane=OperatorLane.NATIVE,
        entrypoint="probe",
        resource_budget=OperatorResourceBudget(
            cpu_millis=100,
            wall_millis=200,
            memory_bytes=8 * 1024 * 1024,
            output_bytes=4096,
            open_files=8,
            process_count=1,
            network_requests=0,
        ),
    )
    token = runtime.leases.issue(
        ride_id=ride.ride_id,
        capability="sweetbox.operator_contract.register",
        resource={
            "contract_id": contract.contract_id,
            "artifact_sha256": contract.artifact_sha256,
        },
        realm="SHADOW",
    )
    record = runtime.operator_fabric.register_contract(
        contract=contract,
        artifact_bytes=artifact,
        ride_id=ride.ride_id,
        lease_token=token,
    )
    incomplete = HostEnforcementProfile(
        platform="LINUX",
        kernel_release="test",
        cgroup_v2_present=True,
        cgroup_v2_writable=False,
        seccomp_mode=2,
        landlock_listed=False,
        user_namespaces_available=True,
        unshare_path="/usr/bin/unshare",
        bubblewrap_path=None,
        wasmtime_path=None,
        node_path=None,
        profile_hash="b" * 64,
        observed_at="2026-10-13T00:00:00Z",
    )
    assessment = runtime.operator_fabric.assess_contract(record.contract_id, incomplete)
    assert assessment.decision is EnforcementDecision.DENY
    assert "CGROUP_V2_DELEGATED" in assessment.missing_requirements
    assert "LANDLOCK" in assessment.missing_requirements
    assert assessment.execution_granted is False


def test_preregistered_matrix_preserves_adverse_evidence_and_never_promotes(runtime):
    ride = runtime.rides.mount()
    baseline = _register(runtime, ride.ride_id, _contract("kwan.matrix.baseline"))
    candidate = _register(runtime, ride.ride_id, _contract("kwan.matrix.candidate"))
    arms = [
        MatrixArm(role=MatrixArmRole.BASELINE, contract_id=baseline.contract_id, label="sealed baseline"),
        MatrixArm(role=MatrixArmRole.CANDIDATE, contract_id=candidate.contract_id, label="candidate"),
    ]
    primary = MatrixMetric(
        name="QUALITY",
        direction=MetricDirection.HIGHER_IS_BETTER,
        minimum_delta=0.10,
        adverse_delta=0.05,
    )
    guardrails = [
        MatrixMetric(
            name="LATENCY",
            direction=MetricDirection.LOWER_IS_BETTER,
            minimum_delta=0.0,
            adverse_delta=5.0,
        )
    ]
    body = runtime.operator_fabric._plan_body(
        ride_id=ride.ride_id,
        title="paired candidate versus baseline",
        arms=arms,
        seeds=[11, 29],
        primary_metric=primary,
        guardrails=guardrails,
    )
    matrix_id = f"kem:{sha256_bytes(canonical_bytes(body))}"
    compose = runtime.leases.issue(
        ride_id=ride.ride_id,
        capability="crealabs.matrix.compose",
        resource={"matrix_id": matrix_id},
        realm="SHADOW",
    )
    plan = runtime.operator_fabric.create_matrix(
        ride_id=ride.ride_id,
        title="paired candidate versus baseline",
        arms=arms,
        seeds=[11, 29],
        primary_metric=primary,
        guardrails=guardrails,
        lease_token=compose,
    )
    assert isinstance(plan, ExperimentalMatrixPlan)
    assert plan.matrix_id == matrix_id
    assert plan.promotion == "BLOCKED"

    observations = {
        (MatrixArmRole.BASELINE, 11): {"QUALITY": 0.70, "LATENCY": 10.0},
        (MatrixArmRole.CANDIDATE, 11): {"QUALITY": 0.85, "LATENCY": 11.0},
        (MatrixArmRole.BASELINE, 29): {"QUALITY": 0.72, "LATENCY": 10.5},
        (MatrixArmRole.CANDIDATE, 29): {"QUALITY": 0.90, "LATENCY": 11.0},
    }
    for (role, seed), metrics in observations.items():
        lease = runtime.leases.issue(
            ride_id=ride.ride_id,
            capability="crealabs.matrix.observe",
            resource={"matrix_id": matrix_id, "arm_role": role.value, "seed": seed},
            realm="SHADOW",
        )
        runtime.operator_fabric.record_observation(
            matrix_id=matrix_id,
            arm_role=role,
            seed=seed,
            run_id=f"run:{role.value.lower()}:{seed}",
            metrics=metrics,
            result_hash=sha256_bytes(f"{role.value}:{seed}".encode()),
            lease_token=lease,
        )

    adjudicate = runtime.leases.issue(
        ride_id=ride.ride_id,
        capability="crealabs.matrix.adjudicate",
        resource={"matrix_id": matrix_id},
        realm="SHADOW",
    )
    result = runtime.operator_fabric.adjudicate_matrix(matrix_id, lease_token=adjudicate)
    assert result.verdict is MatrixVerdict.CANDIDATE_OUTPERFORMED
    assert result.complete is True
    assert result.candidate_promoted is False
    assert result.authority_granted is False
    assert result.scientific_claim_created is False
    assert result.receipt_block_id
    stored = runtime.operator_fabric.get_matrix(matrix_id)
    assert stored.status.value == "ADJUDICATED"
    assert stored.promotion == "BLOCKED"
    assert runtime.operator_fabric.status()["scalar_completeness_score"] is None
