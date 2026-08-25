from __future__ import annotations

from functools import lru_cache
from importlib import import_module
from typing import Any

from app.services.adapters.base import BaseAdapter
from app.services.adapters.cirq_adapter import CirqAdapter
from app.services.adapters.pennylane_adapter import PennyLaneAdapter
from app.services.adapters.qbraid_adapter import QBraidAdapter
from app.services.adapters.qiskit_adapter import QiskitAdapter

REGISTRY: dict[str, type[BaseAdapter]] = {
    "qiskit": QiskitAdapter,
    "cirq": CirqAdapter,
    "pennylane": PennyLaneAdapter,
    "qbraid": QBraidAdapter,
}

ALIASES: dict[str, str] = {
    "aer": "qiskit",
    "qiskit-aer": "qiskit",
    "ibm": "qiskit",
    "google": "cirq",
    "xanadu": "pennylane",
    "penny": "pennylane",
    "qml": "pennylane",
    "braket": "qbraid",
    "qbraid-stub": "qbraid",
}

MODULE_FOR: dict[str, str] = {
    "qiskit": "qiskit",
    "cirq": "cirq",
    "pennylane": "pennylane",
    "qbraid": "app.services.adapters.qbraid_adapter",
}

DEFAULT_BACKEND = "qiskit"


class UnknownBackendError(ValueError):
    def __init__(self, backend_name: str) -> None:
        super().__init__(
            f"unknown backend '{backend_name}'. available: {', '.join(sorted(REGISTRY))}"
        )
        self.backend_name = backend_name


def normalise_backend(backend_name: str | None) -> str:
    if not backend_name:
        return DEFAULT_BACKEND
    key = backend_name.strip().lower()
    return ALIASES.get(key, key)


@lru_cache(maxsize=None)
def _instance(key: str) -> BaseAdapter:
    return REGISTRY[key]()


def get_adapter(backend_name: str) -> BaseAdapter:
    key = normalise_backend(backend_name)
    if key not in REGISTRY:
        raise UnknownBackendError(backend_name)
    return _instance(key)


def available_backends() -> list[str]:
    return sorted(REGISTRY)


def probe_backends() -> dict[str, Any]:
    report: dict[str, Any] = {}
    for key in available_backends():
        adapter = _instance(key)
        installed = True
        detail = adapter.version()
        if key != "qbraid":
            try:
                import_module(MODULE_FOR[key])
            except Exception as error:
                installed = False
                detail = str(error)
        report[key] = {
            "framework": adapter.framework,
            "installed": installed,
            "version": detail,
            "real": key != "qbraid",
        }
    return report
