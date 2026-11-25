import superposition from '../lessons/1-superposition.json'
import entanglement from '../lessons/2-entanglement.json'
import grover from '../lessons/3-grover.json'
import type { Gate } from './sim'

export type { Lang } from './dicts'
export type Text = {
  title: string
  intro: string
  steps: string[]
  quiz: { q: string; options: string[]; answer: number; why: string }[]
}
export type Lesson = {
  id: string
  qubits: number
  gates: Gate[]
  expected: Record<string, number>
  en: Text
  hi: Text
  kn: Text
}

// The JSON stores gates as ["cx", 0, 1] (same order as Qiskit calls); the app uses {g, q}.
export const toGates = (raw: (string | number)[][]): Gate[] =>
  raw.map(([g, ...q]) => ({ g, q }) as Gate)

export const LESSONS: Lesson[] = [superposition, entanglement, grover].map((l) => ({
  ...l,
  gates: toGates(l.gates),
}))
