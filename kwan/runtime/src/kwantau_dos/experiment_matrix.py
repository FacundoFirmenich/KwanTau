from __future__ import annotations

import json
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from .canonical import canonical_bytes, canonical_json, utc_now_iso
from .crypto import sha256_bytes
from .errors import IntegrityError, LeaseError
from .kwan_blocks import KwanBlocksEpistemicStatus, KwanBlocksGraph
from .leases import LeaseService
from .ledger import EventLedger
from .operator_fabric import OperatorFabricService
from .storage import Database
from .wasm_lane import WasmRunStatus


class MatrixRole(StrEnum):
    BASELINE = "BASELINE"
    CANDIDATE = "CANDIDATE"
    ABLATION = "ABLATION"
    NEGATIVE_CONTROL = "NEGATIVE_CONTROL"


class MatrixCell(BaseModel):
    cell_id: str
    role: MatrixRole
    operator_id: str
    operator_version: str
    arguments: list[int | float | str] = Field(default_factory=list)
    seed: int = Field(ge=0, le=2**63 - 1)


class ExperimentMatrixSpec(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    hypothesis: str = Field(min_length=1, max_length=2000)
    outcome_contract: str = Field(min_length=1, max_length=1000)
    cells: list[MatrixCell] = Field(min_length=4, max_length=128)
    realm: Literal["SHADOW"] = "SHADOW"
    authority_inherited: Literal[False] = False
    auto_promotion: Literal[False] = False

    @model_validator(mode="after")
    def required_roles(self) -> "ExperimentMatrixSpec":
        roles = {cell.role for cell in self.cells}
        required = {MatrixRole.BASELINE, MatrixRole.CANDIDATE, MatrixRole.ABLATION, MatrixRole.NEGATIVE_CONTROL}
        missing = sorted(role.value for role in required - roles)
        if missing:
            raise ValueError("matrix is missing required roles: " + ",".join(missing))
        if len({cell.cell_id for cell in self.cells}) != len(self.cells):
            raise ValueError("matrix cell_id values must be unique")
        return self


class MatrixRecord(BaseModel):
    matrix_id: str = Field(pattern=r"^sbm:[0-9a-f]{64}$")
    ride_id: str
    spec: ExperimentMatrixSpec
    spec_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    status: Literal["SEALED_SHADOW", "OBSERVED", "ADJUDICATED"]
    created_at: str
    adjudicated_at: str | None = None
    verdict: dict[str, Any] | None = None
    receipt_block_id: str | None = None


class ExperimentMatrixService:
    """CreaLabs/Sweetbox paired experimental matrix.

    The matrix records baseline, candidate, ablation and negative-control cells
    separately. It never averages them into a scalar promotion score and never
    promotes an operator. Observations must refer to already closed Sweetbox
    runs and remain SHADOW evidence.
    """

    def __init__(
        self,
        database: Database,
        ledger: EventLedger,
        leases: LeaseService,
        graph: KwanBlocksGraph,
        operators: OperatorFabricService,
    ) -> None:
        self.database = database
        self.ledger = ledger
        self.leases = leases
        self.graph = graph
        self.operators = operators

    def compose(self, *, ride_id: str, spec: ExperimentMatrixSpec, lease_token: str) -> MatrixRecord:
        spec_hash = sha256_bytes(canonical_bytes(spec.model_dump(mode="json")))
        reservation = self.leases.reserve(
            lease_token,
            expected_capability="crealabs.matrix.compose",
            resource_check=lambda resource: resource.get("spec_hash") == spec_hash,
        )
        if reservation.claims.realm != "SHADOW" or reservation.claims.ride_id != ride_id:
            self.leases.finalize(reservation, success=False, failure_reason="MATRIX_REQUIRES_SHADOW")
            raise LeaseError("experiment matrix requires a SHADOW lease on this Ride")
        try:
            for cell in spec.cells:
                operator = self.operators.get(cell.operator_id, cell.operator_version)
                if operator.status.value != "REGISTERED_SHADOW":
                    raise IntegrityError(f"matrix cell operator is not executable in SHADOW: {cell.cell_id}")
            body = {"ride_id": ride_id, "spec_hash": spec_hash}
            matrix_id = f"sbm:{sha256_bytes(canonical_bytes(body))}"
            created_at = utc_now_iso()
            with self.database.transaction() as connection:
                existing = connection.execute(
                    "SELECT spec_hash FROM experiment_matrices WHERE matrix_id=?", (matrix_id,)
                ).fetchone()
                if existing is None:
                    connection.execute(
                        """
                        INSERT INTO experiment_matrices(
                            matrix_id,ride_id,spec_json,spec_hash,status,created_at,adjudicated_at,verdict_json,receipt_block_id
                        ) VALUES(?,?,?,?, 'SEALED_SHADOW', ?,NULL,NULL,NULL)
                        """,
                        (matrix_id, ride_id, canonical_json(spec.model_dump(mode="json")), spec_hash, created_at),
                    )
                    for cell in spec.cells:
                        connection.execute(
                            """
                            INSERT INTO experiment_matrix_cells(
                                matrix_id,cell_id,role,operator_id,operator_version,arguments_json,seed
                            ) VALUES(?,?,?,?,?,?,?)
                            """,
                            (
                                matrix_id,
                                cell.cell_id,
                                cell.role.value,
                                cell.operator_id,
                                cell.operator_version,
                                canonical_json(cell.arguments),
                                cell.seed,
                            ),
                        )
                    self.ledger.append_in_transaction(
                        connection,
                        "CREALABS_MATRIX_COMPOSED",
                        {
                            "matrix_id": matrix_id,
                            "spec_hash": spec_hash,
                            "cell_count": len(spec.cells),
                            "roles": sorted({cell.role.value for cell in spec.cells}),
                            "authority_inherited": False,
                            "auto_promotion": False,
                        },
                        ride_id=ride_id,
                        realm="SHADOW",
                    )
                elif str(existing["spec_hash"]) != spec_hash:
                    raise IntegrityError("matrix identity collision")
            self.leases.finalize(reservation, success=True)
            return self.get(matrix_id)
        except Exception:
            try:
                self.leases.finalize(reservation, success=False, failure_reason="MATRIX_COMPOSE_FAILED")
            except Exception:
                pass
            raise

    def observe(self, *, matrix_id: str, cell_id: str, run_id: str, lease_token: str) -> MatrixRecord:
        matrix = self.get(matrix_id)
        reservation = self.leases.reserve(
            lease_token,
            expected_capability="crealabs.matrix.observe",
            resource_check=lambda resource: resource.get("matrix_id") == matrix_id and resource.get("cell_id") == cell_id and resource.get("run_id") == run_id,
        )
        if reservation.claims.realm != "SHADOW" or reservation.claims.ride_id != matrix.ride_id:
            self.leases.finalize(reservation, success=False, failure_reason="MATRIX_OBSERVE_REQUIRES_SHADOW")
            raise LeaseError("matrix observation requires a SHADOW lease on this Ride")
        try:
            with self.database.connect() as connection:
                cell = connection.execute(
                    "SELECT * FROM experiment_matrix_cells WHERE matrix_id=? AND cell_id=?", (matrix_id, cell_id)
                ).fetchone()
                run = connection.execute(
                    "SELECT * FROM sweetbox_wasm_runs WHERE run_id=?", (run_id,)
                ).fetchone()
            if cell is None or run is None:
                raise KeyError((matrix_id, cell_id, run_id))
            if str(run["ride_id"]) != matrix.ride_id:
                raise IntegrityError("run belongs to another Ride")
            if str(run["operator_id"]) != str(cell["operator_id"]) or str(run["operator_version"]) != str(cell["operator_version"]):
                raise IntegrityError("run operator does not match matrix cell")
            if WasmRunStatus(str(run["status"])) not in {WasmRunStatus.SUCCEEDED, WasmRunStatus.FAILED, WasmRunStatus.TIMED_OUT, WasmRunStatus.QUARANTINED}:
                raise IntegrityError("run is not terminal")
            observed_at = utc_now_iso()
            with self.database.transaction() as connection:
                connection.execute(
                    """
                    INSERT INTO experiment_matrix_observations(matrix_id,cell_id,run_id,result_hash,status,observed_at)
                    VALUES(?,?,?,?,?,?)
                    ON CONFLICT(matrix_id,cell_id) DO UPDATE SET
                        run_id=excluded.run_id,result_hash=excluded.result_hash,status=excluded.status,observed_at=excluded.observed_at
                    """,
                    (
                        matrix_id,
                        cell_id,
                        run_id,
                        str(run["result_hash"] or ""),
                        str(run["status"]),
                        observed_at,
                    ),
                )
                connection.execute("UPDATE experiment_matrices SET status='OBSERVED' WHERE matrix_id=?", (matrix_id,))
                self.ledger.append_in_transaction(
                    connection,
                    "CREALABS_MATRIX_OBSERVATION_RECORDED",
                    {"matrix_id": matrix_id, "cell_id": cell_id, "run_id": run_id, "run_status": str(run["status"])},
                    ride_id=matrix.ride_id,
                    realm="SHADOW",
                )
            self.leases.finalize(reservation, success=True)
            return self.get(matrix_id)
        except Exception:
            try:
                self.leases.finalize(reservation, success=False, failure_reason="MATRIX_OBSERVE_FAILED")
            except Exception:
                pass
            raise

    def adjudicate(self, *, matrix_id: str, lease_token: str) -> MatrixRecord:
        matrix = self.get(matrix_id)
        reservation = self.leases.reserve(
            lease_token,
            expected_capability="crealabs.matrix.adjudicate",
            resource_check=lambda resource: resource.get("matrix_id") == matrix_id,
        )
        if reservation.claims.realm != "SHADOW" or reservation.claims.ride_id != matrix.ride_id:
            self.leases.finalize(reservation, success=False, failure_reason="MATRIX_ADJUDICATE_REQUIRES_SHADOW")
            raise LeaseError("matrix adjudication requires a SHADOW lease on this Ride")
        try:
            with self.database.connect() as connection:
                cells = connection.execute(
                    "SELECT * FROM experiment_matrix_cells WHERE matrix_id=? ORDER BY cell_id", (matrix_id,)
                ).fetchall()
                observations = connection.execute(
                    "SELECT * FROM experiment_matrix_observations WHERE matrix_id=? ORDER BY cell_id", (matrix_id,)
                ).fetchall()
            by_cell = {str(row["cell_id"]): row for row in observations}
            missing = [str(row["cell_id"]) for row in cells if str(row["cell_id"]) not in by_cell]
            if missing:
                raise IntegrityError("matrix has unobserved cells: " + ",".join(missing))
            role_results: dict[str, list[dict[str, str]]] = {}
            for cell in cells:
                observation = by_cell[str(cell["cell_id"])]
                role_results.setdefault(str(cell["role"]), []).append(
                    {
                        "cell_id": str(cell["cell_id"]),
                        "run_id": str(observation["run_id"]),
                        "status": str(observation["status"]),
                        "result_hash": str(observation["result_hash"]),
                    }
                )
            verdict = {
                "roles": role_results,
                "all_terminal": True,
                "scalar_score": None,
                "promotion_recommended": False,
                "promotion_executed": False,
                "interpretation": "PAIRWISE_EVIDENCE_ONLY",
            }
            receipt = self.graph.add_block(
                block_type="CREALABS_EXPERIMENT_MATRIX_RECEIPT",
                schema_version="1.0",
                maturity="LOCAL_SHADOW_EXPERIMENTAL_RECEIPT",
                epistemic_status=KwanBlocksEpistemicStatus.RECEIPT,
                source_refs=[],
                payload={
                    "matrix_id": matrix_id,
                    "spec_hash": matrix.spec_hash,
                    "verdict_hash": sha256_bytes(canonical_bytes(verdict)),
                    "authority_inherited": False,
                    "promotion_executed": False,
                    "scientific_claim_created": False,
                },
                ride_id=matrix.ride_id,
                realm="SHADOW",
            )
            now = utc_now_iso()
            with self.database.transaction() as connection:
                connection.execute(
                    "UPDATE experiment_matrices SET status='ADJUDICATED',adjudicated_at=?,verdict_json=?,receipt_block_id=? WHERE matrix_id=?",
                    (now, canonical_json(verdict), receipt.block_id, matrix_id),
                )
                self.ledger.append_in_transaction(
                    connection,
                    "CREALABS_MATRIX_ADJUDICATED",
                    {
                        "matrix_id": matrix_id,
                        "verdict_hash": sha256_bytes(canonical_bytes(verdict)),
                        "receipt_block_id": receipt.block_id,
                        "promotion_executed": False,
                    },
                    ride_id=matrix.ride_id,
                    realm="SHADOW",
                )
            self.leases.finalize(reservation, success=True)
            return self.get(matrix_id)
        except Exception:
            try:
                self.leases.finalize(reservation, success=False, failure_reason="MATRIX_ADJUDICATE_FAILED")
            except Exception:
                pass
            raise

    def get(self, matrix_id: str) -> MatrixRecord:
        with self.database.connect() as connection:
            row = connection.execute("SELECT * FROM experiment_matrices WHERE matrix_id=?", (matrix_id,)).fetchone()
        if row is None:
            raise KeyError(matrix_id)
        return MatrixRecord(
            matrix_id=str(row["matrix_id"]),
            ride_id=str(row["ride_id"]),
            spec=ExperimentMatrixSpec.model_validate_json(str(row["spec_json"])),
            spec_hash=str(row["spec_hash"]),
            status=str(row["status"]),
            created_at=str(row["created_at"]),
            adjudicated_at=str(row["adjudicated_at"]) if row["adjudicated_at"] else None,
            verdict=json.loads(str(row["verdict_json"])) if row["verdict_json"] else None,
            receipt_block_id=str(row["receipt_block_id"]) if row["receipt_block_id"] else None,
        )

    def list(self) -> list[MatrixRecord]:
        with self.database.connect() as connection:
            rows = connection.execute("SELECT matrix_id FROM experiment_matrices ORDER BY created_at,matrix_id").fetchall()
        return [self.get(str(row["matrix_id"])) for row in rows]

    def status(self) -> dict[str, Any]:
        records = self.list()
        return {
            "matrix_count": len(records),
            "adjudicated": sum(item.status == "ADJUDICATED" for item in records),
            "required_roles": [role.value for role in MatrixRole],
            "scalar_score": None,
            "auto_promotion": False,
            "authority_inherited": False,
        }
