export type Gate = { g: 'h' | 'x' | 'z' | 'cx' | 'cz'; q: number[] }

/**
 * Exact statevector simulation. Returns probabilities indexed by basis state i,
 * where bit k of i is qubit k, so i.toString(2).padStart(n, '0') matches Qiskit's bitstrings.
 * ponytail: real amplitudes only (H, X, Z, CX, CZ are all real). Add S/T/RY => switch to complex.
 */
export function probabilities(n: number, gates: Gate[]): number[] {
  const a = new Float64Array(1 << n)
  a[0] = 1
  for (const { g, q } of gates) {
    const m = 1 << q[0]
    for (let i = 0; i < a.length; i++) {
      if (g === 'h' && !(i & m)) {
        const x = a[i], y = a[i | m]
        a[i] = (x + y) * Math.SQRT1_2
        a[i | m] = (x - y) * Math.SQRT1_2
      } else if (g === 'x' && !(i & m)) {
        ;[a[i], a[i | m]] = [a[i | m], a[i]]
      } else if (g === 'z' && i & m) {
        a[i] = -a[i]
      } else if (g === 'cx' && i & m && !(i & (1 << q[1]))) {
        const j = i | (1 << q[1])
        ;[a[i], a[j]] = [a[j], a[i]]
      } else if (g === 'cz' && i & m && i & (1 << q[1])) {
        a[i] = -a[i]
      }
    }
  }
  return Array.from(a, (v) => v * v)
}
