"""Classical baseline vs the three lessons' quantum circuits, on the same expected outputs.

Run: python quantum/baseline.py     (prints the table pasted into README.md; asserts the claims)
Noise column: replay on the fake 127-qubit IBM Sherbrooke noise model (no IBM account needed).
"""
import random

from qiskit import transpile
from qiskit_aer import AerSimulator
from qiskit_ibm_runtime.fake_provider import FakeSherbrooke

from lessons import build_circuit, load_lessons

SHOTS, SEED = 4096, 7
random.seed(SEED)
dev = FakeSherbrooke()
noisy = AerSimulator.from_backend(dev, seed_simulator=SEED)


def tvd(counts, want):
    keys = set(counts) | set(want)
    return 0.5 * sum(abs(counts.get(k, 0) / SHOTS - want.get(k, 0)) for k in keys)


def classical(lesson):
    """The simplest classical program that makes the same histogram (Grover: random guessing)."""
    n = lesson["qubits"]
    out = {}
    for _ in range(SHOTS):
        if lesson["id"] == "superposition":
            k = str(random.getrandbits(1))
        elif lesson["id"] == "entanglement":
            k = str(random.getrandbits(1)) * 2  # one shared coin, copied to both bits
        else:
            k = format(random.randrange(2**n), f"0{n}b")
        out[k] = out.get(k, 0) + 1
    return out


def classical_queries(items=4):
    """Exact expected oracle calls to find 1 marked item among 4, without repeats (the 4th needs no call)."""
    return sum(min(i, items - 1) for i in range(1, items + 1)) / items


rows = []
for lesson in load_lessons():
    qc = build_circuit(lesson)
    qc.measure_all()
    t = transpile(qc, dev, optimization_level=3, seed_transpiler=SEED)
    q_noisy = noisy.run(t, shots=SHOTS).result().get_counts()
    want = lesson["expected"]
    c = classical(lesson)
    grover = lesson["id"] == "grover"
    rows.append((lesson["id"], tvd(c, want), tvd(q_noisy, want), qc.depth(), t.depth(), "2.25 / 1" if grover else "n/a"))

print("| Lesson | Classical TVD | Quantum (noise model) TVD | Logical depth | Transpiled depth | Oracle queries classical / quantum |")
print("| --- | --- | --- | --- | --- | --- |")
for r in rows:
    print(f"| {r[0]} | {r[1]:.3f} | {r[2]:.3f} | {r[3]} | {r[4]} | {r[5]} |")

assert classical_queries() == 2.25
# Classical guessing fails Grover (TVD ~0.75); the quantum circuit stays far closer even with device noise.
g = rows[2]
assert g[1] > 0.6 and g[2] < g[1], g
# For lessons 1-2 a classical program matches the histogram: no quantum advantage claimed.
assert rows[0][1] < 0.05 and rows[1][1] < 0.05, rows
print("ok baseline")
