// Run: npm test. Checks the browser simulator against the same expected values Qiskit is checked against.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { probabilities } from './sim.ts'

const dir = new URL('../lessons/', import.meta.url)
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const l = JSON.parse(readFileSync(new URL(f, dir), 'utf8'))
  const gates = l.gates.map(([g, ...q]: [string, ...number[]]) => ({ g, q }))
  const p = probabilities(l.qubits, gates)
  for (let i = 0; i < 1 << l.qubits; i++) {
    const key = i.toString(2).padStart(l.qubits, '0')
    assert.ok(Math.abs(p[i] - (l.expected[key] ?? 0)) < 1e-9, `${l.id} ${key}: ${p[i]}`)
  }
  console.log('ok', l.id)
}
assert.ok(Math.abs(probabilities(1, [{ g: 'h', q: [0] }, { g: 'h', q: [0] }])[0] - 1) < 1e-9, 'H·H = identity')
