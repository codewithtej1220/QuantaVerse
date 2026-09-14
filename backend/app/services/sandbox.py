from __future__ import annotations

import builtins
import contextlib
import io
import multiprocessing
import time
from queue import Empty
from typing import Any

TIMEOUT_SECONDS = 5.0
STARTUP_GRACE_SECONDS = 25.0
MAX_STDOUT = 8_000
MAX_CODE_LENGTH = 20_000
PREFERRED_NAMES = ("qc", "circuit", "quantum_circuit", "program")

ALLOWED_MODULES = {
    "cmath",
    "collections",
    "fractions",
    "functools",
    "itertools",
    "math",
    "numpy",
    "operator",
    "qiskit",
    "random",
    "statistics",
    "typing",
}

SAFE_BUILTIN_NAMES = (
    "ArithmeticError",
    "AssertionError",
    "AttributeError",
    "Exception",
    "False",
    "IndexError",
    "KeyError",
    "NameError",
    "None",
    "NotImplementedError",
    "OverflowError",
    "RuntimeError",
    "StopIteration",
    "True",
    "TypeError",
    "ValueError",
    "ZeroDivisionError",
    "abs",
    "all",
    "any",
    "bin",
    "bool",
    "callable",
    "chr",
    "classmethod",
    "complex",
    "dict",
    "divmod",
    "enumerate",
    "filter",
    "float",
    "format",
    "frozenset",
    "getattr",
    "hasattr",
    "hash",
    "hex",
    "int",
    "isinstance",
    "issubclass",
    "iter",
    "len",
    "list",
    "map",
    "max",
    "min",
    "next",
    "object",
    "oct",
    "ord",
    "pow",
    "print",
    "property",
    "range",
    "repr",
    "reversed",
    "round",
    "set",
    "setattr",
    "slice",
    "sorted",
    "staticmethod",
    "str",
    "sum",
    "super",
    "tuple",
    "type",
    "zip",
)

QISKIT_GATE_ALIASES = {
    "u3": "u",
    "u1": "p",
    "cnot": "cx",
    "toffoli": "ccx",
    "fredkin": "cswap",
    "iden": "id",
}

IGNORED_INSTRUCTIONS = {"barrier", "delay", "snapshot", "save_statevector", "id_gate"}


def _guarded_import(
    name: str,
    globals_dict: Any = None,
    locals_dict: Any = None,
    fromlist: Any = (),
    level: int = 0,
) -> Any:
    root = name.split(".")[0]
    if root not in ALLOWED_MODULES:
        raise ImportError(
            f"'{root}' is not importable in the sandbox. allowed: {', '.join(sorted(ALLOWED_MODULES))}"
        )
    return builtins.__import__(name, globals_dict, locals_dict, fromlist, level)


def _sandbox_globals() -> dict[str, Any]:
    safe: dict[str, Any] = {}
    for candidate in SAFE_BUILTIN_NAMES:
        if hasattr(builtins, candidate):
            safe[candidate] = getattr(builtins, candidate)
    safe["__import__"] = _guarded_import
    safe["__build_class__"] = builtins.__build_class__
    return {"__builtins__": safe, "__name__": "quantaverse_sandbox", "__doc__": None}


def _bit_indices(circuit: Any, bits: Any, kind: str) -> list[int]:
    indices: list[int] = []
    for bit in bits:
        try:
            indices.append(int(circuit.find_bit(bit).index))
        except Exception:
            registry = circuit.qubits if kind == "qubit" else circuit.clbits
            indices.append(list(registry).index(bit))
    return indices


def _split_wires(gate: str, wires: list[int]) -> tuple[int | None, list[int]]:
    if gate in {"cx", "cy", "cz", "ch", "crx", "cry", "crz", "cp"}:
        return wires[0], [wires[1]]
    if gate in {"ccx", "cswap"}:
        return wires[0], wires[1:]
    return None, wires


def circuit_to_ir_payload(circuit: Any) -> dict[str, Any]:
    from qiskit.converters import circuit_to_dag

    from app.models.circuit_ir import GATE_ARITY, canonical_gate_name

    dag = circuit_to_dag(circuit)
    timeline: list[dict[str, Any]] = []
    measure_targets: list[int] = []
    measure_clbits: list[int] = []
    unsupported: set[str] = set()
    step = 0

    for layer in dag.layers():
        placed = False
        for node in layer["graph"].topological_op_nodes():
            raw_name = str(getattr(node.op, "name", node.name)).lower()
            if raw_name in IGNORED_INSTRUCTIONS:
                continue

            wires = _bit_indices(circuit, node.qargs, "qubit")

            if raw_name == "measure":
                clbits = _bit_indices(circuit, node.cargs, "clbit")
                measure_targets.extend(wires)
                measure_clbits.extend(clbits)
                continue

            if raw_name == "reset":
                unsupported.add("reset")
                continue

            name = QISKIT_GATE_ALIASES.get(raw_name, canonical_gate_name(raw_name))
            if name not in GATE_ARITY:
                unsupported.add(raw_name)
                continue

            params: list[float] = []
            for value in getattr(node.op, "params", []) or []:
                try:
                    params.append(float(value))
                except Exception:
                    unsupported.add(f"{raw_name} (symbolic parameter)")
                    params = []
                    break

            if raw_name == "u2":
                import math

                params = [math.pi / 2, *params]

            control, targets = _split_wires(name, wires)
            timeline.append(
                {
                    "gate": name,
                    "targets": targets,
                    "control": control,
                    "params": params,
                    "step": step,
                }
            )
            placed = True
        if placed:
            step += 1

    if unsupported:
        raise ValueError(
            "these instructions have no place in the QuantaVerse IR yet: "
            + ", ".join(sorted(unsupported))
        )

    measurements: list[dict[str, Any]] = []
    if measure_targets:
        measurements.append({"targets": measure_targets, "clbits": measure_clbits})

    return {
        "qubits": int(circuit.num_qubits),
        "clbits": int(circuit.num_clbits),
        "timeline": timeline,
        "measurements": measurements,
    }


def _find_circuit(namespace: dict[str, Any], variable: str | None) -> tuple[str, Any]:
    from qiskit import QuantumCircuit

    if variable:
        if variable not in namespace:
            raise ValueError(f"no variable named '{variable}' was defined by the code")
        candidate = namespace[variable]
        if not isinstance(candidate, QuantumCircuit):
            raise ValueError(f"'{variable}' is a {type(candidate).__name__}, not a QuantumCircuit")
        return variable, candidate

    for name in PREFERRED_NAMES:
        if isinstance(namespace.get(name), QuantumCircuit):
            return name, namespace[name]

    found = [
        (name, value)
        for name, value in namespace.items()
        if isinstance(value, QuantumCircuit) and not name.startswith("_")
    ]
    if not found:
        raise ValueError(
            "no QuantumCircuit was found. assign one to a variable named 'qc' "
            "so the sandbox can pick it up"
        )
    return found[-1]


def _worker(code: str, variable: str | None, channel: Any) -> None:
    try:
        from qiskit import QuantumCircuit
        import numpy

        channel.put({"event": "ready"})
    except Exception as error:
        channel.put({"event": "result", "ok": False, "error": str(error), "error_type": "ImportError"})
        return

    namespace: dict[str, Any] = {}
    scope = _sandbox_globals()
    scope["QuantumCircuit"] = QuantumCircuit
    scope["np"] = numpy
    stream = io.StringIO()
    started = time.perf_counter()

    try:
        compiled = compile(code, "<quantaverse>", "exec")
        with contextlib.redirect_stdout(stream), contextlib.redirect_stderr(stream):
            exec(compiled, scope, namespace)
        name, circuit = _find_circuit({**scope, **namespace}, variable)
        payload = circuit_to_ir_payload(circuit)

        from app.models.circuit_ir import CircuitIR

        validated = CircuitIR(**payload)
        diagram = None
        try:
            diagram = str(circuit.draw(output="text", fold=72))
        except Exception:
            diagram = None

        channel.put(
            {
                "event": "result",
                "ok": True,
                "circuit": validated.model_dump(),
                "variable": name,
                "stdout": stream.getvalue()[:MAX_STDOUT],
                "duration_ms": round((time.perf_counter() - started) * 1000, 3),
                "diagram": diagram,
            }
        )
    except SyntaxError as error:
        channel.put(
            {
                "event": "result",
                "ok": False,
                "error": f"line {error.lineno}: {error.msg}",
                "error_type": "SyntaxError",
                "stdout": stream.getvalue()[:MAX_STDOUT],
                "duration_ms": round((time.perf_counter() - started) * 1000, 3),
            }
        )
    except BaseException as error:
        message = str(error) or error.__class__.__name__
        line = _user_line(error.__traceback__)
        channel.put(
            {
                "event": "result",
                "ok": False,
                # Same shape as the SyntaxError branch above, so a caller reads
                # a line number out of one format rather than two.
                "error": f"line {line}: {message}" if line else message,
                "error_type": error.__class__.__name__,
                "stdout": stream.getvalue()[:MAX_STDOUT],
                "duration_ms": round((time.perf_counter() - started) * 1000, 3),
            }
        )


def _user_line(trace: Any) -> int | None:
    """The deepest line of the learner's own program on a traceback.

    A syntax error carries its line on the exception, and the branch for it
    always reported one. A runtime error does not: the line lives on the
    traceback, and returning ``str(error)`` alone threw it away, so a NameError
    on line 5 arrived as a sentence with no idea where it happened. Walking to
    the *deepest* frame compiled from the learner's source means an error inside
    a function they wrote points at the line inside it, and one raised deep in
    Qiskit points at the line of theirs that called it.
    """
    line = None
    while trace is not None:
        if trace.tb_frame.f_code.co_filename == "<quantaverse>":
            line = trace.tb_lineno
        trace = trace.tb_next
    return line


def _failure(message: str, kind: str, duration_ms: float = 0.0) -> dict[str, Any]:
    return {
        "ok": False,
        "circuit": None,
        "variable": None,
        "stdout": "",
        "error": message,
        "error_type": kind,
        "duration_ms": duration_ms,
        "diagram": None,
    }


def execute_and_introspect(
    code_string: str,
    variable: str | None = None,
    timeout: float = TIMEOUT_SECONDS,
) -> dict[str, Any]:
    if not code_string or not code_string.strip():
        return _failure("there is no code to run", "EmptyInput")
    if len(code_string) > MAX_CODE_LENGTH:
        return _failure(
            f"the program is {len(code_string)} characters; the limit is {MAX_CODE_LENGTH}",
            "InputTooLarge",
        )

    started = time.perf_counter()
    try:
        context = multiprocessing.get_context("spawn")
        channel = context.Queue()
        process = context.Process(
            target=_worker, args=(code_string, variable, channel), daemon=True
        )
        process.start()
    except Exception as error:
        return _failure(f"could not start the sandbox process: {error}", "SandboxUnavailable")

    try:
        first = channel.get(timeout=STARTUP_GRACE_SECONDS)
        if first.get("event") == "ready":
            payload = channel.get(timeout=timeout)
        else:
            payload = first
    except Empty:
        payload = None
    except Exception as error:
        payload = {"event": "result", "ok": False, "error": str(error), "error_type": "IPCError"}
    finally:
        if process.is_alive():
            process.terminate()
        process.join(timeout=1.0)
        if process.is_alive():
            process.kill()
        channel.close()

    elapsed = round((time.perf_counter() - started) * 1000, 3)

    if payload is None:
        return _failure(
            f"the program was still running after {timeout:.0f} seconds and was stopped. "
            "check for an unbounded loop, or a register larger than a laptop can simulate",
            "Timeout",
            elapsed,
        )

    result = {
        "ok": bool(payload.get("ok")),
        "circuit": payload.get("circuit"),
        "variable": payload.get("variable"),
        "stdout": payload.get("stdout", ""),
        "error": payload.get("error"),
        "error_type": payload.get("error_type"),
        "duration_ms": payload.get("duration_ms", elapsed),
        "diagram": payload.get("diagram"),
    }
    return result
