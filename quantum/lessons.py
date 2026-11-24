"""Build Qiskit circuits from the lesson JSON files (single source of truth shared with the web app)."""
import json
from pathlib import Path

from qiskit import QuantumCircuit

LESSON_DIR = Path(__file__).resolve().parent.parent / "web" / "lessons"


def load_lessons():
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(LESSON_DIR.glob("*.json"))]


def build_circuit(lesson):
    qc = QuantumCircuit(lesson["qubits"])
    for name, *qubits in lesson["gates"]:
        getattr(qc, name)(*qubits)  # h, x, z, cx, cz share the QuantumCircuit method names
    return qc
