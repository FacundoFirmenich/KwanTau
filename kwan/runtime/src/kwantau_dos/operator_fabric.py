from __future__ import annotations

import json
import re
from enum import StrEnum
from pathlib import PurePosixPath
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from .canonical import b64url_decode, b64url_encode, canonical_bytes, canonical_json, utc_now_iso
from .crypto import LocalCrypto, sha256_bytes
from .errors import IntegrityError, LeaseError
from .host_enforcement import HostEnforcementProfile, probe_host_enforcement
from .leases import LeaseService
from .ledger import EventLedger
from .storage import Database
from .wasm_lane import SweetboxWasmLane, WasmRunRecord


_OPERATOR = re.compile(r"^[a-z][a-z0-9_.-]{2,127}$")
_VERSION = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$")

KWAN_OPERATOR_WIT = """package kwan:operator@1.0.0;

interface context {
  record budget {
    cpu-ms: u64,
    wall-ms: u64,
    memory-bytes: u64,
    io-bytes: u64,
  }
}

world operator {
  export run: func(input: list<u8>) -> result<list<u8>, string>;
}
"""


class OperatorLane(StrEnum):
    PURE_WASM = "PURE_WASM"
    WASI_COMPONENT = "WASI_COMPONENT"


class OperatorRegistryStatus(StrEnum):
    REGISTERED_SHADOW = "REGISTERED_SHADOW"
    DECLARED_BLOCKED = "DECLARED_BLOCKED"
    REVOKED = "REVOKED"


class FilesystemGrant(BaseModel):
    guest_path: str
    mode: Literal["READ_ONLY", "READ_WRITE"]
    source_class: Literal["SEALED_INPUT", "EPHEMERAL_OUTPUT", "WORKSPACE_SUBTREE"]

    @field_validator("guest_path")
    @classmethod
    def safe_guest_path(cls, value: str) -> str:
        path = PurePosixPath(value)
        if not path.is_absolute() or ".." in path.parts or value == "/":
            raise ValueError("guest_path must be an absolute, non-root path without traversal")
        return path.as_posix()


class NetworkPolicy(BaseModel):
    mode: Literal["DENY", "ALLOWLIST"] = "DENY"
    endpoints: list[str] = Field(default_factory=list, max_length=32)

    @model_validator(mode="after")
    def consistent(self) -> "NetworkPolicy":
        if self.mode == "DENY" and self.endpoints:
            raise ValueError("DENY network policy cannot contain endpoints")
        if self.mode == "ALLOWLIST" and not self.endpoints:
            raise ValueError("ALLOWLIST requires at least one endpoint")
        return self


class ResourceBudget(BaseModel):
    cpu_ms: int = Field(default=2_000, ge=10, le=3_600_000)
    wall_ms: int = Field(default=5_000, ge=10, le=3_600_000)
    memory_bytes: int = Field(default=128 * 1024 * 1024, ge=1 * 1024 * 1024, le=16 * 1024**3)
    io_bytes: int = Field(default=16 * 1024 * 1024, ge=0, le=16 * 1024**3)
    stdout_bytes: int = Field(default=1 * 1024 * 1024, ge=0, le=64 * 1024**2)
    file_count: int = Field(default=128, ge=0, le=100_000)
    process_count: int = Field(default=1, ge=1, le=512)


class WITContract(BaseModel):
    package: Literal["kwan:operator@1.0.0"] = "kwan:operator@1.0.0"
    world: Literal["operator"] = "operator"
    source_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    imports: list[str] = Field(default_factory=list)
    exports: list[str] = Field(default_factory=lambda: ["run"])


class KwanOperatorManifest(BaseModel):
    operator_id: str
    operator_version: str
    lane: OperatorLane
    module_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    wit: WITContract
    budget: ResourceBudget = Field(default_factory=ResourceBudget)
    filesystem: list[FilesystemGrant] = Field(default_factory=list, max_length=16)
    network: NetworkPolicy = Field(default_factory=NetworkPolicy)
    environment_keys: list[str] = Field(default_factory=list, max_length=32)
    secret_handles: Literal[False] = False
    clocks: Literal[False] = False
    randomness: Literal[False] = False
    realm: Literal["SHADOW"] = "SHADOW"
    authority_inherited: Literal[False] = False
    productive_effects: Literal[False] = False
    promotion_allowed: Literal[False] = False

    @field_validator("operator_id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        if not _OPERATOR.fullmatch(value):
            raise ValueError("invalid operator_id")
        return value

    @field_validator("operator_version")
    @classmethod
    def validate_version(cls, value: str) -> str:
        if not _VERSION.fullmatch(value):
            raise ValueError("operator_version must be semantic version")
        return value

    @model_validator(mode="after")
    def lane_contract(self) -> "KwanOperatorManifest":
        if self.lane is OperatorLane.PURE_WASM:
            if self.filesystem:
                raise ValueError("PURE_WASM cannot declare filesystem grants")
            if self.network.mode != "DENY":
                raise ValueError("PURE_WASM network policy must be DENY")
            if self.environment_keys:
                raise ValueError("PURE_WASM cannot declare environment keys")
        return self


class KwanOperatorRecord(BaseModel):
    manifest: KwanOperatorManifest
    manifest_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    signature_b64: str
    signer_public_key_b64: str
    status: OperatorRegistryStatus
    enforcement_reasons: list[str]
    created_at: str


class OperatorFabricService:
    """Typed SHADOW operator registry.

    Registration records declared capabilities and budgets but never grants an
    execution lease. PURE_WASM can be bound to the existing no-import lane.
    WASI_COMPONENT is deliberately DECLARED_BLOCKED until the host-enforcement
    adapter can demonstrate the required filesystem/network/resource controls.
    """

    def __init__(
        self,
        database: Database,
        crypto: LocalCrypto,
        ledger: EventLedger,
        leases: LeaseService,
        wasm_lane: SweetboxWasmLane,
    ) -> None:
        self.database = database
        self.crypto = crypto
        self.ledger = ledger
        self.leases = leases
        self.wasm_lane = wasm_lane
        self.host_profile = probe_host_enforcement()
        self.wit_source_sha256 = sha256_bytes(KWAN_OPERATOR_WIT.encode("utf-8"))

    def enforcement_reasons(self, manifest: KwanOperatorManifest) -> list[str]:
        reasons: list[str] = []
        if manifest.wit.source_sha256 != self.wit_source_sha256:
            reasons.append("WIT_CONTRACT_HASH_MISMATCH")
        if manifest.lane is OperatorLane.PURE_WASM:
            if manifest.filesystem:
                reasons.append("PURE_WASM_FILESYSTEM_MUST_BE_EMPTY")
            if manifest.network.mode != "DENY":
                reasons.append("PURE_WASM_NETWORK_MUST_BE_DENY")
            if manifest.environment_keys:
                reasons.append("PURE_WASM_ENVIRONMENT_MUST_BE_EMPTY")
            return reasons
        if self.host_profile.wasmtime.status != "AVAILABLE":
            reasons.append("WASMTIME_UNAVAILABLE")
        if not self.host_profile.complete_enforced_wasi_lane:
            reasons.append("WASI_HOST_ENFORCEMENT_INCOMPLETE")
        if manifest.network.mode == "ALLOWLIST":
            reasons.append("NETWORK_ALLOWLIST_ENFORCEMENT_NOT_MATERIALISED")
        if any(grant.mode == "READ_WRITE" for grant in manifest.filesystem):
            reasons.append("WRITABLE_FILESYSTEM_GRANT_ENFORCEMENT_NOT_MATERIALISED")
        return reasons

    def register(
        self,
        *,
        ride_id: str,
        manifest: KwanOperatorManifest,
        lease_token: str,
    ) -> KwanOperatorRecord:
        reservation = self.leases.reserve(
            lease_token,
            expected_capability="sweetbox.operator.register",
            resource_check=lambda resource: (
                resource.get("operator_id") == manifest.operator_id
                and resource.get("operator_version") == manifest.operator_version
                and resource.get("module_sha256") == manifest.module_sha256
            ),
        )
        if reservation.claims.realm != "SHADOW" or reservation.claims.ride_id != ride_id:
            self.leases.finalize(reservation, success=False, failure_reason="OPERATOR_REGISTRY_REQUIRES_SHADOW")
            raise LeaseError("operator registry requires a SHADOW lease on this Ride")
        try:
            if manifest.lane is OperatorLane.PURE_WASM:
                underlying = self.wasm_lane.get_operator(manifest.operator_id, manifest.operator_version)
                if underlying.manifest.wasm_sha256 != manifest.module_sha256:
                    raise IntegrityError("operator registry module hash does not match Sweetbox module")
            reasons = self.enforcement_reasons(manifest)
            status = OperatorRegistryStatus.REGISTERED_SHADOW if not reasons else OperatorRegistryStatus.DECLARED_BLOCKED
            manifest_json = canonical_json(manifest.model_dump(mode="json"))
            manifest_hash = sha256_bytes(manifest_json.encode("utf-8"))
            signature = self.crypto.sign(manifest_json.encode("utf-8"))
            created_at = utc_now_iso()
            with self.database.transaction() as connection:
                existing = connection.execute(
                    "SELECT manifest_hash FROM kwan_operator_registry WHERE operator_id=? AND operator_version=?",
                    (manifest.operator_id, manifest.operator_version),
                ).fetchone()
                if existing is None:
                    connection.execute(
                        """
                        INSERT INTO kwan_operator_registry(
                            operator_id,operator_version,lane,manifest_json,manifest_hash,
                            signature,signer_public_key,status,enforcement_reasons_json,created_at
                        ) VALUES(?,?,?,?,?,?,?,?,?,?)
                        """,
                        (
                            manifest.operator_id,
                            manifest.operator_version,
                            manifest.lane.value,
                            manifest_json,
                            manifest_hash,
                            signature,
                            self.crypto.public_key_bytes,
                            status.value,
                            canonical_json(reasons),
                            created_at,
                        ),
                    )
                    self.ledger.append_in_transaction(
                        connection,
                        "KWAN_OPERATOR_REGISTERED",
                        {
                            "operator_id": manifest.operator_id,
                            "operator_version": manifest.operator_version,
                            "lane": manifest.lane.value,
                            "manifest_hash": manifest_hash,
                            "status": status.value,
                            "enforcement_reasons": reasons,
                            "authority_inherited": False,
                            "promotion_allowed": False,
                        },
                        ride_id=ride_id,
                        realm="SHADOW",
                    )
                elif str(existing["manifest_hash"]) != manifest_hash:
                    raise IntegrityError("operator identity already exists with a different manifest")
            self.leases.finalize(reservation, success=True)
            return self.get(manifest.operator_id, manifest.operator_version)
        except Exception:
            try:
                self.leases.finalize(reservation, success=False, failure_reason="OPERATOR_REGISTRY_FAILED")
            except Exception:
                pass
            raise

    def get(self, operator_id: str, operator_version: str) -> KwanOperatorRecord:
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT * FROM kwan_operator_registry WHERE operator_id=? AND operator_version=?",
                (operator_id, operator_version),
            ).fetchone()
        if row is None:
            raise KeyError((operator_id, operator_version))
        manifest = KwanOperatorManifest.model_validate_json(str(row["manifest_json"]))
        manifest_json = canonical_json(manifest.model_dump(mode="json"))
        manifest_hash = sha256_bytes(manifest_json.encode("utf-8"))
        if manifest_hash != str(row["manifest_hash"]):
            raise IntegrityError("operator manifest hash mismatch")
        if not LocalCrypto.verify(bytes(row["signer_public_key"]), manifest_json.encode("utf-8"), bytes(row["signature"])):
            raise IntegrityError("operator manifest signature invalid")
        return KwanOperatorRecord(
            manifest=manifest,
            manifest_hash=manifest_hash,
            signature_b64=b64url_encode(bytes(row["signature"])),
            signer_public_key_b64=b64url_encode(bytes(row["signer_public_key"])),
            status=OperatorRegistryStatus(str(row["status"])),
            enforcement_reasons=json.loads(str(row["enforcement_reasons_json"])),
            created_at=str(row["created_at"]),
        )

    def list(self) -> list[KwanOperatorRecord]:
        with self.database.connect() as connection:
            rows = connection.execute(
                "SELECT operator_id,operator_version FROM kwan_operator_registry ORDER BY operator_id,operator_version"
            ).fetchall()
        return [self.get(str(row["operator_id"]), str(row["operator_version"])) for row in rows]

    def execute_pure_wasm(
        self,
        *,
        ride_id: str,
        operator_id: str,
        operator_version: str,
        arguments: list[Any],
        lease_token: str,
    ) -> WasmRunRecord:
        record = self.get(operator_id, operator_version)
        if record.manifest.lane is not OperatorLane.PURE_WASM:
            raise IntegrityError("operator is not in the PURE_WASM lane")
        if record.status is not OperatorRegistryStatus.REGISTERED_SHADOW:
            raise IntegrityError("operator is blocked by its enforcement contract")
        return self.wasm_lane.execute(
            ride_id=ride_id,
            operator_id=operator_id,
            operator_version=operator_version,
            arguments=arguments,
            lease_token=lease_token,
        )

    def status(self) -> dict[str, Any]:
        records = self.list()
        return {
            "wit_package": "kwan:operator@1.0.0",
            "wit_source_sha256": self.wit_source_sha256,
            "registered": sum(item.status is OperatorRegistryStatus.REGISTERED_SHADOW for item in records),
            "blocked": sum(item.status is OperatorRegistryStatus.DECLARED_BLOCKED for item in records),
            "authority_inherited": False,
            "promotion_allowed": False,
            "host_enforcement": self.host_profile.model_dump(mode="json"),
        }
