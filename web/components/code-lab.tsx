'use client'

import { useEffect, useRef, useState } from 'react'
import { Header } from '@/components/header'
import { EXAMPLES } from '@/lib/examples'

type Stage = {
  id: string
  title: string
  why: string
  chips?: string[]
  note?: string | null
  stats?: { depth: number; size: number; twoq: number }
  diagrams?: { label: string; text: string }[]
  table?: { head: string[]; rows: (string | number)[][]; highlight: number }
  histogram?: { key: string; ideal: number; measured: number }[]
  tvd?: number
}
type Job = { status: string; stages: Stage[]; error: string | null }

const ORDER = ['build', 'decompose', 'optimize', 'transpile', 'execute', 'post']
const NAMES = ['Build & compose', 'Decompose', 'Optimize', 'Transpile', 'Execute', 'Post-process']
const first = Object.keys(EXAMPLES)[0]

export function CodeLab() {
  const [ex, setEx] = useState(first)
  const [code, setCode] = useState(EXAMPLES[first])
  const [level, setLevel] = useState(1)
  const [shots, setShots] = useState(1024)
  const [backend, setBackend] = useState<'sim' | 'ibm'>('sim')
  const [hardware, setHardware] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then((d) => setHardware(!!d.hardware)).catch(() => setError('Cannot reach the Qiskit server. Start it with: python quantum/server.py'))
    return () => clearTimeout(timer.current)
  }, [])

  const poll = async (id: string) => {
    try {
      const j: Job = await (await fetch(`/api/jobs/${id}`)).json()
      setJob(j)
      if (j.status === 'running' || j.status.startsWith('queued') || j.status.endsWith('...')) timer.current = setTimeout(() => poll(id), 700)
      else setBusy(false)
    } catch {
      setError('Lost connection to the Qiskit server.')
      setBusy(false)
    }
  }

  const run = async () => {
    clearTimeout(timer.current)
    setBusy(true)
    setError(null)
    setJob(null)
    const r = await fetch('/api/run', { method: 'POST', body: JSON.stringify({ code, level, shots, backend }) }).catch(() => null)
    const d = await r?.json().catch(() => null)
    if (!r || !r.ok) {
      setError(d?.error ?? 'Cannot reach the Qiskit server. Start it with: python quantum/server.py')
      setBusy(false)
      return
    }
    poll(d.id)
  }

  const done = new Set(job?.stages.map((s) => s.id))
  const current = ORDER.find((id) => !done.has(id))

  return (
    <div>
      <Header active="/code" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="font-mono text-[12px] text-accent">Qiskit circuit lifecycle · runs on the server</p>
        <h1 className="mt-2 font-heading text-4xl font-bold tracking-tight">Code</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Write a Qiskit circuit and follow it through every stage IBM describes: build and compose, decompose, optimize, transpile for a device, execute, and post-process the results.
        </p>

        <ol aria-label="Lifecycle" className="mt-6 flex flex-wrap gap-2 font-mono text-[12px]">
          {NAMES.map((n, i) => {
            const state = done.has(ORDER[i]) ? 'done' : busy && ORDER[i] === current ? 'now' : 'todo'
            return (
              <li key={n} className={`rounded-md border px-3 py-1.5 ${state === 'done' ? 'border-slate-900 bg-slate-900 text-white' : state === 'now' ? 'border-accent text-accent' : 'border-border text-slate-500'}`}>
                {i + 1} {n}
              </li>
            )
          })}
        </ol>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <section className="self-start rounded-lg border border-border p-4">
            <label className="flex flex-wrap items-center gap-2 font-mono text-sm">
              <span className="text-slate-600">Example</span>
              <select value={ex} onChange={(e) => { setEx(e.target.value); setCode(EXAMPLES[e.target.value]) }} className="rounded border border-border px-2 py-1">
                {Object.keys(EXAMPLES).map((k) => <option key={k}>{k}</option>)}
              </select>
            </label>
            <textarea
              aria-label="Qiskit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              rows={18}
              maxLength={6000}
              className="mt-3 w-full resize-y rounded border border-border bg-surface p-3 font-mono text-[13px] leading-relaxed"
            />
            <p className="mt-1 text-xs text-slate-500">
              A safe subset of Qiskit is interpreted on the server: <code>QuantumCircuit</code>, gates, <code>compose/append/to_gate/inverse</code>, <code>for … in range()</code>. Your circuit must be named <code>qc</code>. Max 5 qubits.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-sm">
              <label>Optimization level
                <select value={level} onChange={(e) => setLevel(+e.target.value)} className="mt-1 block w-full rounded border border-border px-2 py-1">
                  {[0, 1, 2, 3].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              <label>Shots
                <select value={shots} onChange={(e) => setShots(+e.target.value)} className="mt-1 block w-full rounded border border-border px-2 py-1">
                  {[256, 1024, 4096].map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="col-span-2">Run on
                <select value={backend} onChange={(e) => setBackend(e.target.value as 'sim' | 'ibm')} className="mt-1 block w-full rounded border border-border px-2 py-1">
                  <option value="sim">Noise-model simulator (fast)</option>
                  <option value="ibm" disabled={!hardware}>IBM Quantum hardware{hardware ? ' (queue: minutes)' : ' (not enabled on this server)'}</option>
                </select>
              </label>
            </div>
            <button onClick={run} disabled={busy} className="mt-4 h-11 w-full rounded-md bg-slate-900 font-heading text-sm font-bold text-white disabled:opacity-50">
              {busy ? (job?.status && job.status !== 'running' ? job.status : 'Running…') : 'Run through the lifecycle'}
            </button>
            {error && <p role="alert" className="mt-3 whitespace-pre-wrap rounded border border-red-300 bg-red-50 p-3 font-mono text-sm text-red-800">{error}</p>}
          </section>

          <section aria-live="polite" className="space-y-4">
            {job?.error && <p role="alert" className="whitespace-pre-wrap rounded border border-red-300 bg-red-50 p-3 font-mono text-sm text-red-800">{job.error}</p>}
            {!job && !error && <p className="rounded-lg border border-dashed border-border p-8 text-center text-slate-500">Run the example to see each stage appear here.</p>}
            {job?.stages.map((s) => <StageCard key={s.id} s={s} />)}
          </section>
        </div>
      </main>
    </div>
  )
}

function StageCard({ s }: { s: Stage }) {
  return (
    <article className="rounded-lg border border-border p-5">
      <h2 className="font-heading text-xl font-bold">{s.title}</h2>
      <p className="mt-1 text-sm text-slate-600">{s.why}</p>
      {s.chips && s.chips.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-2 font-mono text-[12px]">
          {s.chips.map((c) => <span key={c} className="rounded border border-border bg-surface px-2 py-1">{c}</span>)}
        </p>
      )}
      {s.stats && (
        <p className="mt-3 font-mono text-sm">depth <b>{s.stats.depth}</b> · gates <b>{s.stats.size}</b> · 2-qubit gates <b>{s.stats.twoq}</b></p>
      )}
      {s.note && <p className="mt-2 font-mono text-sm text-accent">{s.note}</p>}
      {s.diagrams?.map((d) => (
        <figure key={d.label} className="mt-3">
          <figcaption className="font-mono text-[12px] text-slate-500">{d.label}</figcaption>
          <pre className="mt-1 overflow-x-auto rounded bg-slate-900 p-3 font-mono text-[12px] leading-tight text-slate-100">{d.text}</pre>
        </figure>
      ))}
      {s.table && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full font-mono text-[12px]">
            <thead><tr className="border-b border-border text-left">{s.table.head.map((h) => <th key={h} className="py-1 pr-3">{h}</th>)}</tr></thead>
            <tbody>
              {s.table.rows.map((r) => (
                <tr key={r[0]} className={`border-b border-border ${r[0] === s.table!.highlight ? 'bg-orange-50 font-bold' : ''}`}>
                  {r.map((c, i) => <td key={i} className="py-1 pr-3">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-slate-500">Highlighted row = the level you chose for transpiling.</p>
        </div>
      )}
      {s.histogram && (
        <div className="mt-3">
          <ul className="space-y-1.5 font-mono text-[12px]">
            {s.histogram.map((h) => (
              <li key={h.key} className="flex items-center gap-2">
                <span className="w-14">{h.key}</span>
                <div className="flex-1 space-y-0.5" role="img" aria-label={`${h.key}: ideal ${(h.ideal * 100).toFixed(1)}%, measured ${(h.measured * 100).toFixed(1)}%`}>
                  <div className="h-2 rounded bg-slate-900" style={{ width: `${h.ideal * 100}%` }} />
                  <div className="h-2 rounded bg-accent" style={{ width: `${h.measured * 100}%` }} />
                </div>
                <span className="w-24 text-right">{(h.ideal * 100).toFixed(1)} / {(h.measured * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[12px]"><span className="text-slate-900">■</span> ideal (noiseless) · <span className="text-accent">■</span> measured · distance from ideal (TVD) <b>{s.tvd}</b></p>
        </div>
      )}
    </article>
  )
}
