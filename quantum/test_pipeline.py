"""Self-check for the Code tab backend. Run: python quantum/test_pipeline.py"""
import pipeline
from sandbox import SandboxError, build

BELL = """
from qiskit import QuantumCircuit
bell = QuantumCircuit(2, name="bell")
bell.h(0)
bell.cx(0, 1)
qc = QuantumCircuit(3)
qc.append(bell.to_gate(), [0, 1])
for i in range(1, 2):
    qc.cx(i, i + 1)
qc.measure_all()
"""
REDUNDANT = "from math import pi\nqc = QuantumCircuit(4)\nqc.h(0)\nqc.h(0)\nqc.cx(0, 3)\nqc.rz(pi/4, 3)\nqc.rz(pi/4, 3)\nqc.cx(0, 1)\nqc.cx(0, 1)\nqc.measure_all()"

# the sandbox must reject everything outside the Qiskit subset
for evil in [
    "import os", "from os import system", "__import__('os')", "open('/etc/passwd')", "exec('1')",
    "qc = QuantumCircuit(2)\nqc.__class__", "qc = QuantumCircuit(2)\nqc.h(0).__class__.__mro__",
    "qc = (lambda: 1)()", "x = [i for i in range(3)]", "while True:\n  pass", "qc = QuantumCircuit(99)",
    "for i in range(10**9):\n  pass", "qc = QuantumCircuit(1)\nqc.data.clear()",
    "for a in range(32):\n for b in range(32):\n  for c in range(32):\n   pass",
]:
    try:
        build(evil)
    except SandboxError:
        continue
    raise AssertionError(f"sandbox accepted: {evil!r}")
assert build(BELL).num_qubits == 3

stages = []
pipeline.run(BELL, 1, 512, "sim", stages.append, lambda s: None)
assert [s["id"] for s in stages] == ["build", "decompose", "optimize", "transpile", "execute", "post"]
assert stages[0]["chips"] == [{"k": "sub", "v": "bell"}]
assert stages[3]["p"]["level"] == 1 and stages[3]["note"]["k"] == "delta"
assert stages[-1]["tvd"] < 0.25, stages[-1]["tvd"]  # noisy but still close to ideal GHZ

stages = []
pipeline.run(REDUNDANT, 3, 256, "sim", stages.append, lambda s: None)
rows = stages[2]["table"]["rows"]
assert rows[3][2] < rows[0][2], rows  # level 3 removes cancelling gates
print("ok: sandbox blocks 14 attack patterns, 6 lifecycle stages emitted, optimize level 3 shrinks", rows[0][2], "->", rows[3][2])
