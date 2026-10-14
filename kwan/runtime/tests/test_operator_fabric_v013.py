from __future__ import annotations

import shutil

import pytest

from kwantau_dos.canonical import canonical_bytes
from kwantau_dos.crypto import sha256_bytes
from kwantau_dos.experiment_matrix import ExperimentMatrixSpec, MatrixCell, MatrixRole
from kwantau_dos.operator_fabric import (
    KwanOperatorManifest,
    OperatorLane,
    OperatorRegistryStatus,
    WITContract,
)


ADD_WASM = bytes.fromhex(
    "0061736d01000000"
    "01070160027f7f017f"
    "03020100"
    "070701036164640000"
    "0a09010700200020016a0b"
)


def _register_pure(runtime, ride_id: str):
    underlying = runtime.sweetbox_wasm.register_operator(
        wasm_bytes=ADD_WASM,
        operator_id="kwan.add",
        operator_version="1.0.0",
        entrypoint="add",
        parameter_types=["i32", "i32"],
        result_type="i32",
        ride_id=ride_id,
    )
    manifest = KwanOperatorManifest(
        operator_id="kwan.add",
        operator_version="1.0.0",
        lane=OperatorLane.PURE_WASM,
        module_sha256=underlying.manifest.wasm_sha256,
        wit=WITContract(source_sha256=runtime.operator_fabric.wit_source_sha256),
    )
    token = runtime.leases.issue(
        ride_id=ride_id,
        capability="sweetbox.operator.register",
        resource={
            "operator_id": manifest.operator_id,
            "operator_version": manifest.operator_version,
            "module_sha256": manifest.module_sha256,
        },
        realm="SHADOW",
    )
    return runtime.operator_fabric.register(ride_id=ride_id, manifest=manifest, lease_token=token)


@pytest.mark.skipif(shutil.which("node") is None, reason="Node WebAssembly engine unavailable")
def test_operator_registry_is_signed_typed_and_non_authoritative(runtime):
    ride = runtime.rides.mount()
    record = _register_pure(runtime, ride.ride_id)
    assert record.status is OperatorRegistryStatus.REGISTERED_SHADOW
    assert record.manifest.realm == "SHADOW"
    assert record.manifest.authority_inherited is False
    assert record.manifest.promotion_allowed is False
    assert record.manifest.network.mode == "DENY"
    assert runtime.operator_fabric.get("kwan.add", "1.0.0").manifest_hash == record.manifest_hash


def test_wasi_component_is_preserved_but_blocked_without_complete_host_enforcement(runtime):
    ride = runtime.rides.mount()
    manifest = KwanOperatorManifest(
        operator_id="kwan.component",
        operator_version="1.0.0",
        lane=OperatorLane.WASI_COMPONENT,
        module_sha256="1" * 64,
        wit=WITContract(source_sha256=runtime.operator_fabric.wit_source_sha256),
    )
    token = runtime.leases.issue(
        ride_id=ride.ride_id,
        capability="sweetbox.operator.register",
        resource={
            "operator_id": manifest.operator_id,
            "operator_version": manifest.operator_version,
            "module_sha256": manifest.module_sha256,
        },
        realm="SHADOW",
    )
    record = runtime.operator_fabric.register(ride_id=ride.ride_id, manifest=manifest, lease_token=token)
    assert record.status is OperatorRegistryStatus.DECLARED_BLOCKED
    assert "WASI_HOST_ENFORCEMENT_INCOMPLETE" in record.enforcement_reasons
    assert runtime.operator_fabric.host_profile.complete_enforced_wasi_lane is False
    assert runtime.operator_fabric.host_profile.authority_granted is False
    assert runtime.operator_fabric.host_profile.execution_granted is False


def test_operator_manifest_rejects_ambient_pure_wasm_capabilities(runtime):
    with pytest.raises(Exception):
        KwanOperatorManifest(
            operator_id="kwan.bad",
            operator_version="1.0.0",
            lane=OperatorLane.PURE_WASM,
            module_sha256="2" * 64,
            wit=WITContract(source_sha256=runtime.operator_fabric.wit_source_sha256),
            network={"mode": "ALLOWLIST", "endpoints": ["example.com:443"]},
        )


@pytest.mark.skipif(shutil.which("node") is None, reason="Node WebAssembly engine unavailable")
def test_crealabs_matrix_preserves_roles_and_never_promotes(runtime):
    ride = runtime.rides.mount()
    _register_pure(runtime, ride.ride_id)
    spec = ExperimentMatrixSpec(
        title="paired arithmetic evidence",
        hypothesis="candidate behaviour is compared without scalar promotion",
        outcome_contract="retain role-separated terminal result hashes",
        cells=[
            MatrixCell(cell_id="baseline", role=MatrixRole.BASELINE, operator_id="kwan.add", operator_version="1.0.0", arguments=[17, 25], seed=1),
            MatrixCell(cell_id="candidate", role=MatrixRole.CANDIDATE, operator_id="kwan.add", operator_version="1.0.0", arguments=[20, 22], seed=2),
            MatrixCell(cell_id="ablation", role=MatrixRole.ABLATION, operator_id="kwan.add", operator_version="1.0.0", arguments=[40, 2], seed=3),
            MatrixCell(cell_id="negative", role=MatrixRole.NEGATIVE_CONTROL, operator_id="kwan.add", operator_version="1.0.0", arguments=[0, 0], seed=4),
        ],
    )
    spec_hash = sha256_bytes(canonical_bytes(spec.model_dump(mode="json")))
    compose_lease = runtime.leases.issue(
        ride_id=ride.ride_id,
        capability="crealabs.matrix.compose",
        resource={"spec_hash": spec_hash},
        realm="SHADOW",
    )
    matrix = runtime.experiment_matrix.compose(ride_id=ride.ride_id, spec=spec, lease_token=compose_lease)
    for cell in spec.cells:
        execute_lease = runtime.leases.issue(
            ride_id=ride.ride_id,
            capability="sweetbox.wasm.execute",
            resource={"operator_id": "kwan.add", "operator_version": "1.0.0", "entrypoint": "add"},
            realm="SHADOW",
        )
        run = runtime.operator_fabric.execute_pure_wasm(
            ride_id=ride.ride_id,
            operator_id="kwan.add",
            operator_version="1.0.0",
            arguments=cell.arguments,
            lease_token=execute_lease,
        )
        observe_lease = runtime.leases.issue(
            ride_id=ride.ride_id,
            capability="crealabs.matrix.observe",
            resource={"matrix_id": matrix.matrix_id, "cell_id": cell.cell_id, "run_id": run.run_id},
            realm="SHADOW",
        )
        runtime.experiment_matrix.observe(
            matrix_id=matrix.matrix_id,
            cell_id=cell.cell_id,
            run_id=run.run_id,
            lease_token=observe_lease,
        )
    adjudicate_lease = runtime.leases.issue(
        ride_id=ride.ride_id,
        capability="crealabs.matrix.adjudicate",
        resource={"matrix_id": matrix.matrix_id},
        realm="SHADOW",
    )
    result = runtime.experiment_matrix.adjudicate(matrix_id=matrix.matrix_id, lease_token=adjudicate_lease)
    assert result.status == "ADJUDICATED"
    assert set(result.verdict["roles"]) == {role.value for role in MatrixRole}
    assert result.verdict["scalar_score"] is None
    assert result.verdict["promotion_recommended"] is False
    assert result.verdict["promotion_executed"] is False
    assert result.receipt_block_id


def test_storage_schema_advances_to_v10(runtime):
    with runtime.database.connect() as connection:
        version = int(connection.execute("PRAGMA user_version").fetchone()[0])
        tables = {str(row[0]) for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    assert version == 10
    assert {"kwan_operator_registry", "experiment_matrices", "experiment_matrix_cells", "experiment_matrix_observations"} <= tables
