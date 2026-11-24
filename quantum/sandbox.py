"""Interpreter for a safe subset of Qiskit circuit-building code.

User code is parsed with `ast` and walked here; it is NEVER passed to exec/eval, so it cannot
import modules, open files or reach Python internals. Supported: QuantumCircuit(n[, m]),
gate methods, compose/append/to_gate/copy/inverse, numeric math with pi, `for i in range(k)`.
"""
import ast
import math

from qiskit import QuantumCircuit
from qiskit.circuit import Instruction

MAX_QUBITS, MAX_CLBITS, MAX_STEPS, MAX_RANGE, MAX_OPS = 5, 16, 500, 32, 300

METHODS = set(
    "h x y z s sdg t tdg sx sxdg id i rx ry rz p u cx cnot cy cz ch swap ccx toffoli cswap "
    "cp crx cry crz rzz rxx ryy measure measure_all barrier reset "
    "compose append to_gate to_instruction copy inverse".split()
)
KWARGS = {"qubits", "clbits", "inplace", "front", "label", "name"}
IMPORTS = {("qiskit", "QuantumCircuit"), ("math", "pi"), ("numpy", "pi")}
PI_OWNERS = {"math", "np", "numpy"}
BINOPS = {ast.Add: lambda a, b: a + b, ast.Sub: lambda a, b: a - b, ast.Mult: lambda a, b: a * b,
          ast.Div: lambda a, b: a / b, ast.FloorDiv: lambda a, b: a // b, ast.Mod: lambda a, b: a % b}


class SandboxError(Exception):
    pass


class _Sandbox:
    def __init__(self):
        self.env = {"pi": math.pi}
        self.steps = 0

    def block(self, body, depth=0):
        for s in body:
            self.steps += 1
            if self.steps > MAX_STEPS:
                raise SandboxError("program too long (max 500 statements executed)")
            try:
                self.stmt(s, depth)
            except SandboxError as e:
                raise e if str(e).startswith("line ") else SandboxError(f"line {s.lineno}: {e}")
            except Exception as e:  # Qiskit's own errors, e.g. qubit out of range
                raise SandboxError(f"line {s.lineno}: {e}")

    def stmt(self, s, depth):
        if isinstance(s, ast.ImportFrom):
            ok = s.level == 0 and all((s.module, a.name) in IMPORTS for a in s.names)
            if not ok:
                raise SandboxError("only `from qiskit import QuantumCircuit` and `from math import pi` are allowed")
            for a in s.names:
                if a.name == "pi":
                    self.env[a.asname or "pi"] = math.pi
        elif isinstance(s, ast.Import):
            if not all(a.name in ("math", "numpy") for a in s.names):
                raise SandboxError("only `import math` and `import numpy as np` are allowed")
        elif isinstance(s, ast.Pass):
            pass
        elif isinstance(s, ast.Expr):
            if not isinstance(s.value, ast.Constant):  # bare strings = docstrings/comments
                self.ev(s.value, stmt=True)
        elif isinstance(s, ast.Assign) and len(s.targets) == 1 and isinstance(s.targets[0], ast.Name):
            self.env[s.targets[0].id] = self.ev(s.value)
        elif isinstance(s, ast.For) and not s.orelse and isinstance(s.target, ast.Name) and depth < 2:
            items = self.ev(s.iter)
            if not isinstance(items, list) or len(items) > MAX_RANGE:
                raise SandboxError(f"loops must use range() with at most {MAX_RANGE} steps")
            for v in items:
                self.env[s.target.id] = v
                self.block(s.body, depth + 1)
        else:
            raise SandboxError(f"unsupported statement: {type(s).__name__}")

    def ev(self, n, stmt=False):
        if isinstance(n, ast.Constant):
            if isinstance(n.value, bool) or not isinstance(n.value, (int, float, str)) or (isinstance(n.value, str) and len(n.value) > 40):
                raise SandboxError("only numbers and short strings are allowed")
            return n.value
        if isinstance(n, ast.Name):
            if n.id not in self.env:
                raise SandboxError(f"name '{n.id}' is not defined")
            return self.env[n.id]
        if isinstance(n, ast.Attribute) and n.attr == "pi" and isinstance(n.value, ast.Name) and n.value.id in PI_OWNERS:
            return math.pi
        if isinstance(n, (ast.List, ast.Tuple)):
            return [self.ev(e) for e in n.elts]
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, (ast.USub, ast.UAdd)):
            v = self.ev(n.operand)
            return -v if isinstance(n.op, ast.USub) else v
        if isinstance(n, ast.BinOp) and type(n.op) in BINOPS:
            return BINOPS[type(n.op)](self.ev(n.left), self.ev(n.right))
        if isinstance(n, ast.Call):
            return self.call(n, stmt)
        raise SandboxError(f"unsupported expression: {type(n).__name__}")

    def call(self, n, stmt):
        args = [self.ev(a) for a in n.args]
        kw = {}
        for k in n.keywords:
            if k.arg not in KWARGS:
                raise SandboxError(f"keyword argument '{k.arg}' is not supported")
            kw[k.arg] = self.ev(k.value)
        f = n.func
        if isinstance(f, ast.Name) and f.id == "range":
            if not 1 <= len(args) <= 3 or not all(type(a) is int for a in args) or len(range(*args)) > MAX_RANGE:
                raise SandboxError(f"range() needs 1-3 integers and at most {MAX_RANGE} steps")
            return list(range(*args))
        if isinstance(f, ast.Name) and f.id == "QuantumCircuit":
            if not 1 <= len(args) <= 2 or not all(type(a) is int for a in args):
                raise SandboxError("use QuantumCircuit(num_qubits) or QuantumCircuit(num_qubits, num_clbits)")
            if not 1 <= args[0] <= MAX_QUBITS or not 0 <= (args[1] if len(args) > 1 else 0) <= MAX_CLBITS:
                raise SandboxError(f"at most {MAX_QUBITS} qubits and {MAX_CLBITS} classical bits are allowed here")
            if set(kw) - {"name"}:
                raise SandboxError("QuantumCircuit only accepts name=")
            return QuantumCircuit(*args, **kw)
        if isinstance(f, ast.Attribute) and f.attr in METHODS:
            obj = self.ev(f.value)
            if not isinstance(obj, QuantumCircuit):
                raise SandboxError(f".{f.attr}() can only be called on a QuantumCircuit")
            if f.attr == "compose" and stmt:
                kw["inplace"] = True  # a bare `qc.compose(x)` would otherwise discard its result
            out = getattr(obj, f.attr)(*args, **kw)
            if len(obj.data) > MAX_OPS:
                raise SandboxError(f"circuit too large (max {MAX_OPS} instructions)")
            return out if isinstance(out, (QuantumCircuit, Instruction)) else None
        raise SandboxError("only QuantumCircuit gate/compose methods and range() can be called")


def build(code: str) -> QuantumCircuit:
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        raise SandboxError(f"line {e.lineno}: syntax error: {e.msg}")
    sb = _Sandbox()
    sb.block(tree.body)
    qc = sb.env.get("qc")
    if not isinstance(qc, QuantumCircuit):
        raise SandboxError("define the circuit to run as `qc = QuantumCircuit(...)`")
    return qc
