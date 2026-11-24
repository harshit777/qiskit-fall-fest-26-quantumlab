"""The Qiskit circuit lifecycle, one stage at a time:
build & compose -> decompose -> optimize -> transpile -> execute -> post-process.
Each stage is emitted as a JSON-able dict so the web UI can show it as soon as it is done."""
import os

from qiskit import QuantumCircuit, transpile
from qiskit.circuit import Gate, Instruction
from qiskit.primitives import StatevectorSampler
from qiskit.providers.fake_provider import GenericBackendV2
from qiskit.transpiler import CouplingMap
from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
from qiskit_aer import AerSimulator

from sandbox import build

BASIS = ["cz", "id", "rz", "sx", "x"]  # native gates of IBM Heron-class devices
SEED = 7


def sim_backend():
    """Deterministic 5-qubit noisy device with a line topology (stand-in for real hardware)."""
    return GenericBackendV2(num_qubits=5, coupling_map=CouplingMap.from_line(5), basis_gates=BASIS, seed=42)


def stats(c: QuantumCircuit):
    return {"depth": c.depth(), "size": c.size(), "twoq": c.num_nonlocal_gates(), "ops": dict(c.count_ops())}


def draw(c: QuantumCircuit):
    return str(c.draw("text", fold=110, idle_wires=False))


def counts_of(result):
    return next(iter(result.data.values())).get_counts()  # first (usually only) classical register


def run(code, level, shots, kind, emit, status):
    qc = build(code)
    auto = qc.count_ops().get("measure", 0) == 0
    if auto:
        qc.measure_all()

    # 1. Build & compose: the circuit as written, including sub-circuits turned into gates
    composites = sorted({i.operation.name for i in qc.data if type(i.operation) in (Gate, Instruction)})
    emit({
        "id": "build", "title": "1 · Build & compose",
        "why": "Your code becomes a QuantumCircuit. compose() and append() nest smaller circuits inside bigger ones, so you can build once and reuse.",
        "stats": stats(qc), "diagrams": [{"label": "qc", "text": draw(qc)}],
        "chips": [f"sub-circuit: {c}" for c in composites],
        "note": "No measurement found, so qc.measure_all() was added to read results." if auto else None,
    })

    # 2. Decompose: expand sub-circuits into the gates they are made of
    one, full = qc.decompose(reps=1), qc.decompose(reps=5)
    diagrams = [{"label": "qc.decompose(reps=1)", "text": draw(one)}]
    if full.count_ops() != one.count_ops():
        diagrams.append({"label": "fully decomposed", "text": draw(full)})
    emit({
        "id": "decompose", "title": "2 · Decompose",
        "why": "decompose() opens composite gates one level at a time. Optimizers and hardware only understand simple gates, so everything is unrolled before it runs.",
        "stats": stats(full), "diagrams": diagrams,
        "note": None if composites else "This circuit has no sub-circuits, so decomposing changes nothing. Try qc.append(bell.to_gate(), [0, 1]).",
    })

    # 3. Optimize: gate-level simplification only (no device yet), compared across levels 0-3
    rows = []
    for lv in range(4):
        t = transpile(qc, basis_gates=BASIS, optimization_level=lv, seed_transpiler=SEED)
        s = stats(t)
        rows.append([lv, s["depth"], s["size"], s["twoq"], ", ".join(f"{k}:{v}" for k, v in sorted(s["ops"].items()))])
    emit({
        "id": "optimize", "title": "3 · Optimize",
        "why": "Higher optimization levels cancel inverse gates, merge rotations and re-synthesize blocks, so the circuit gets shallower. Fewer gates means less noise.",
        "table": {"head": ["Level", "Depth", "Gates", "2-qubit", "Operations"], "rows": rows, "highlight": level},
    })

    # 4. Transpile: map the circuit onto a concrete device
    status("connecting to IBM Quantum..." if kind == "ibm" else "transpiling...")
    if kind == "ibm":
        from qiskit_ibm_runtime import QiskitRuntimeService
        svc = QiskitRuntimeService(channel="ibm_quantum_platform", token=os.environ["QUANTUM_API_KEY"])
        backend = svc.least_busy(operational=True, simulator=False, min_num_qubits=qc.num_qubits)
    else:
        backend = sim_backend()
    pm = generate_preset_pass_manager(backend=backend, optimization_level=level, seed_transpiler=SEED)
    isa = pm.run(qc)
    try:
        layout = f"virtual qubit -> physical qubit: {isa.layout.final_index_layout()}"
    except Exception:
        layout = None
    before, after = stats(qc), stats(isa)
    emit({
        "id": "transpile", "title": f"4 · Transpile (level {level}) for {backend.name}",
        "why": "The device only has certain gates and only some qubits are connected. Transpiling picks a layout, inserts swaps to route two-qubit gates, and translates everything to native gates.",
        "stats": after, "diagrams": [{"label": "ISA circuit (what the device runs)", "text": draw(isa)}],
        "chips": ["pass stages: " + " > ".join(pm.stages)] + ([layout] if layout else []),
        "note": f"depth {before['depth']} -> {after['depth']}, gates {before['size']} -> {after['size']}, 2-qubit gates {before['twoq']} -> {after['twoq']}",
    })

    # 5. Execute: noisy simulator of the device, or real hardware through the Runtime Sampler
    if kind == "ibm":
        from qiskit_ibm_runtime import SamplerV2
        sampler = SamplerV2(mode=backend)
        sampler.options.dynamical_decoupling.enable = True
        sampler.options.twirling.enable_gates = True
        job = sampler.run([isa], shots=shots)
        status(f"queued on {backend.name} (IBM job {job.job_id()}), waiting for results...")
        counts, where = counts_of(job.result()[0]), f"IBM Quantum hardware {backend.name}, job {job.job_id()}"
        chips = ["dynamical decoupling on", "Pauli twirling on"]
    else:
        status("running noisy simulation...")
        counts = AerSimulator.from_backend(backend).run(isa, shots=shots).result().get_counts()
        where, chips = f"noise-model simulation of {backend.name}", []
    emit({
        "id": "execute", "title": "5 · Execute",
        "why": "The Sampler runs the circuit many times (shots) and counts each measured bit string.",
        "chips": [where, f"{shots} shots"] + chips,
    })

    # 6. Post-process: compare what we measured with the ideal noiseless answer
    ideal = counts_of(StatevectorSampler(default_shots=20000, seed=1).run([qc]).result()[0])
    keys = set(counts) | set(ideal)
    p = {k: (ideal.get(k, 0) / 20000, counts.get(k, 0) / shots) for k in keys}
    top = sorted(p, key=lambda k: -max(p[k]))[:16]
    tvd = 0.5 * sum(abs(a - b) for a, b in p.values())
    emit({
        "id": "post", "title": "6 · Post-process",
        "why": "Raw counts become probabilities. The total variation distance says how far noise pushed the measured distribution from the ideal one (0 = identical, 1 = completely different).",
        "histogram": [{"key": k, "ideal": p[k][0], "measured": p[k][1]} for k in sorted(top)], "tvd": round(tvd, 4),
    })
