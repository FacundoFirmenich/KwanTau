from __future__ import annotations

import os
import platform
import shutil
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field


class EnforcementObservation(BaseModel):
    name: str
    status: Literal["OBSERVED", "AVAILABLE", "UNAVAILABLE", "UNPROBED", "NOT_APPLICABLE"]
    enforced_for_kwan: bool = False
    evidence: dict[str, str | int | bool | None] = Field(default_factory=dict)
    notes: list[str] = Field(default_factory=list)


class HostEnforcementProfile(BaseModel):
    os_name: str
    kernel: str
    architecture: str
    user_namespace: EnforcementObservation
    network_namespace: EnforcementObservation
    cgroup_v2: EnforcementObservation
    seccomp: EnforcementObservation
    landlock: EnforcementObservation
    bubblewrap: EnforcementObservation
    wasmtime: EnforcementObservation
    appcontainer: EnforcementObservation
    complete_enforced_wasi_lane: bool = False
    authority_granted: bool = False
    execution_granted: bool = False


def _read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8").strip()
    except OSError:
        return None


def _linux_seccomp() -> EnforcementObservation:
    status = _read_text(Path("/proc/self/status"))
    if status is None:
        return EnforcementObservation(name="seccomp", status="UNPROBED")
    values: dict[str, str] = {}
    for line in status.splitlines():
        if line.startswith("Seccomp:") or line.startswith("Seccomp_filters:"):
            key, value = line.split(":", 1)
            values[key] = value.strip()
    mode = int(values.get("Seccomp", "0") or 0)
    return EnforcementObservation(
        name="seccomp",
        status="OBSERVED" if mode else "UNAVAILABLE",
        enforced_for_kwan=False,
        evidence={"process_seccomp_mode": mode, "process_filter_count": int(values.get("Seccomp_filters", "0") or 0)},
        notes=[
            "Observed process-level seccomp state is not evidence of a dedicated KWAN operator filter.",
        ],
    )


def _linux_cgroup_v2() -> EnforcementObservation:
    controllers = Path("/sys/fs/cgroup/cgroup.controllers")
    if not controllers.exists():
        return EnforcementObservation(name="cgroup_v2", status="UNAVAILABLE")
    cgroup_line = _read_text(Path("/proc/self/cgroup")) or ""
    relative = "/"
    for line in cgroup_line.splitlines():
        parts = line.split(":", 2)
        if len(parts) == 3 and parts[0] == "0":
            relative = parts[2] or "/"
            break
    current = (Path("/sys/fs/cgroup") / relative.lstrip("/")).resolve()
    writable = os.access(current, os.W_OK)
    return EnforcementObservation(
        name="cgroup_v2",
        status="AVAILABLE",
        enforced_for_kwan=False,
        evidence={
            "controllers": _read_text(controllers),
            "current_cgroup": str(current),
            "current_cgroup_writable": writable,
        },
        notes=[
            "Presence of cgroup v2 does not mean KWAN has delegated budget enforcement.",
        ],
    )


def probe_host_enforcement() -> HostEnforcementProfile:
    system = platform.system()
    kernel = platform.release()
    architecture = platform.machine()
    if system == "Linux":
        user_ns = Path("/proc/self/ns/user").exists()
        net_ns = Path("/proc/self/ns/net").exists()
        bwrap = shutil.which("bwrap")
        wasmtime = shutil.which("wasmtime")
        landlock_header = Path("/usr/include/linux/landlock.h").exists()
        return HostEnforcementProfile(
            os_name=system,
            kernel=kernel,
            architecture=architecture,
            user_namespace=EnforcementObservation(
                name="user_namespace",
                status="AVAILABLE" if user_ns else "UNAVAILABLE",
                evidence={"namespace_visible": user_ns},
            ),
            network_namespace=EnforcementObservation(
                name="network_namespace",
                status="AVAILABLE" if net_ns else "UNAVAILABLE",
                evidence={"namespace_visible": net_ns},
            ),
            cgroup_v2=_linux_cgroup_v2(),
            seccomp=_linux_seccomp(),
            landlock=EnforcementObservation(
                name="landlock",
                status="AVAILABLE" if landlock_header else "UNPROBED",
                enforced_for_kwan=False,
                evidence={"userspace_header_present": landlock_header},
                notes=["Header presence is not proof that a Landlock ruleset is active."],
            ),
            bubblewrap=EnforcementObservation(
                name="bubblewrap",
                status="AVAILABLE" if bwrap else "UNAVAILABLE",
                evidence={"binary": bwrap},
            ),
            wasmtime=EnforcementObservation(
                name="wasmtime",
                status="AVAILABLE" if wasmtime else "UNAVAILABLE",
                evidence={"binary": wasmtime},
            ),
            appcontainer=EnforcementObservation(name="appcontainer", status="NOT_APPLICABLE"),
            complete_enforced_wasi_lane=False,
        )
    if system == "Windows":
        return HostEnforcementProfile(
            os_name=system,
            kernel=kernel,
            architecture=architecture,
            user_namespace=EnforcementObservation(name="user_namespace", status="NOT_APPLICABLE"),
            network_namespace=EnforcementObservation(name="network_namespace", status="NOT_APPLICABLE"),
            cgroup_v2=EnforcementObservation(name="cgroup_v2", status="NOT_APPLICABLE"),
            seccomp=EnforcementObservation(name="seccomp", status="NOT_APPLICABLE"),
            landlock=EnforcementObservation(name="landlock", status="NOT_APPLICABLE"),
            bubblewrap=EnforcementObservation(name="bubblewrap", status="NOT_APPLICABLE"),
            wasmtime=EnforcementObservation(
                name="wasmtime",
                status="AVAILABLE" if shutil.which("wasmtime") else "UNAVAILABLE",
                evidence={"binary": shutil.which("wasmtime")},
            ),
            appcontainer=EnforcementObservation(
                name="appcontainer",
                status="UNPROBED",
                enforced_for_kwan=False,
                notes=["Windows AppContainer enforcement requires a native adapter and material test."],
            ),
            complete_enforced_wasi_lane=False,
        )
    unavailable = EnforcementObservation(name="unsupported", status="UNPROBED")
    return HostEnforcementProfile(
        os_name=system,
        kernel=kernel,
        architecture=architecture,
        user_namespace=unavailable.model_copy(update={"name": "user_namespace"}),
        network_namespace=unavailable.model_copy(update={"name": "network_namespace"}),
        cgroup_v2=unavailable.model_copy(update={"name": "cgroup_v2"}),
        seccomp=unavailable.model_copy(update={"name": "seccomp"}),
        landlock=unavailable.model_copy(update={"name": "landlock"}),
        bubblewrap=unavailable.model_copy(update={"name": "bubblewrap"}),
        wasmtime=EnforcementObservation(
            name="wasmtime",
            status="AVAILABLE" if shutil.which("wasmtime") else "UNAVAILABLE",
            evidence={"binary": shutil.which("wasmtime")},
        ),
        appcontainer=unavailable.model_copy(update={"name": "appcontainer"}),
        complete_enforced_wasi_lane=False,
    )
