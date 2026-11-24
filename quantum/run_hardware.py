"""Run each lesson circuit on real IBM Quantum hardware and on that backend's noise model.

Usage: python quantum/run_hardware.py [lesson-id ...]   (default: entanglement grover)
Needs QUANTUM_API_KEY in .env (see .env.example). Saves results/<lesson>.json.
"""
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from qiskit import transpile
from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
from qiskit_aer import AerSimulator
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2

from lessons import build_circuit, load_lessons

SHOTS = 4096
OUT = Path(__file__).resolve().parent.parent / "results"

load_dotenv()
service = QiskitRuntimeService(channel="ibm_quantum_platform", token=os.environ["QUANTUM_API_KEY"])
backend = service.least_busy(operational=True, simulator=False)
wanted = set(sys.argv[1:]) or {"entanglement", "grover"}

OUT.mkdir(exist_ok=True)
for lesson in load_lessons():
    if lesson["id"] not in wanted:
        continue
    qc = build_circuit(lesson)
    qc.measure_all()
    # optimization_level=3 for the smallest depth; dynamical decoupling suppresses idle-qubit errors
    isa = generate_preset_pass_manager(backend=backend, optimization_level=3).run(qc)
    sampler = SamplerV2(mode=backend)
    sampler.options.dynamical_decoupling.enable = True
    sampler.options.twirling.enable_gates = True  # Pauli twirling turns coherent error into noise that averages out
    job = sampler.run([isa], shots=SHOTS)
    print(f"{lesson['id']}: job {job.job_id()} on {backend.name}, waiting in queue...")
    hw = job.result()[0].data.meas.get_counts()
    noisy = AerSimulator.from_backend(backend)
    sim = noisy.run(transpile(isa, noisy), shots=SHOTS).result().get_counts()
    (OUT / f"{lesson['id']}.json").write_text(json.dumps({
        "lesson": lesson["id"], "backend": backend.name, "shots": SHOTS,
        "date": datetime.now(timezone.utc).isoformat(), "job_id": job.job_id(),
        "logical_depth": build_circuit(lesson).depth(), "transpiled_depth": isa.depth(),
        "transpiled_ops": dict(isa.count_ops()), "expected": lesson["expected"],
        "hardware_counts": hw, "noise_model_counts": sim,
    }, indent=2))
    print(f"saved results/{lesson['id']}.json")
