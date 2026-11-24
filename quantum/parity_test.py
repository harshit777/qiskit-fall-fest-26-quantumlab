"""Fails if Qiskit disagrees with the lesson's expected probabilities.

The web app's TypeScript simulator is checked against the same JSON (web/lib/sim.test.ts),
so passing both tests means Qiskit and the browser demo give the same answers.
Run: python quantum/parity_test.py
"""
from qiskit.quantum_info import Statevector
from qiskit_aer import AerSimulator
from qiskit import transpile

from lessons import build_circuit, load_lessons

SHOTS = 4096
TOL = 0.03

for lesson in load_lessons():
    qc = build_circuit(lesson)
    n = lesson["qubits"]
    exact = Statevector(qc).probabilities_dict()
    meas = qc.copy()
    meas.measure_all()
    counts = AerSimulator().run(transpile(meas, AerSimulator()), shots=SHOTS).result().get_counts()
    for i in range(2**n):
        key = format(i, f"0{n}b")  # Qiskit prints qubit n-1 ... qubit 0, same as the web app
        want = lesson["expected"].get(key, 0)
        assert abs(exact.get(key, 0) - want) < 1e-9, (lesson["id"], key, exact.get(key, 0), want)
        assert abs(counts.get(key, 0) / SHOTS - want) < TOL, (lesson["id"], key, counts.get(key, 0), want)
    print(f"ok  {lesson['id']}: depth={qc.depth()} gates={sum(qc.count_ops().values())}")
