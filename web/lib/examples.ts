export const EXAMPLES: Record<string, string> = {
  'Bell pair as a reusable gate (compose)': `from qiskit import QuantumCircuit

# 1. Build a small circuit and turn it into a reusable gate
bell = QuantumCircuit(2, name="bell")
bell.h(0)
bell.cx(0, 1)

# 2. Compose it into a bigger circuit
qc = QuantumCircuit(3)
qc.append(bell.to_gate(), [0, 1])
qc.cx(1, 2)
qc.measure_all()
`,
  'Redundant gates (watch the optimizer)': `from qiskit import QuantumCircuit
from math import pi

qc = QuantumCircuit(4)
qc.h(0)
qc.h(0)          # H then H cancels
qc.cx(0, 3)      # qubits 0 and 3 are far apart: routing needs swaps
qc.rz(pi / 4, 3)
qc.rz(pi / 4, 3) # two rotations merge into one
qc.cx(0, 1)
qc.cx(0, 1)      # CX then CX cancels
qc.measure_all()
`,
  'GHZ state with a loop': `from qiskit import QuantumCircuit

qc = QuantumCircuit(4)
qc.h(0)
for i in range(3):
    qc.cx(i, i + 1)
qc.measure_all()
`,
}
