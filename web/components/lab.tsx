'use client'

import { useMemo, useState } from 'react'
import { LESSONS, type Lang } from '@/lib/lessons'
import { probabilities, type Gate } from '@/lib/sim'

const UI = {
  en: { lessons: 'Lessons', circuit: 'Circuit', add: 'Add gate to qubit', reset: 'Reset to lesson', remove: 'Click a gate to remove it', hist: 'Measurement probabilities', walk: 'Try this', quiz: 'Quiz', score: 'Score', nogates: 'No gates: the qubits stay at 0.', site: 'Back to susinbinary.com', tag: 'Quantum learning for every student, with no hardware and no heavy math.' },
  hi: { lessons: 'पाठ', circuit: 'सर्किट', add: 'क्यूबिट पर गेट जोड़ें', reset: 'पाठ का मूल सर्किट', remove: 'गेट हटाने के लिए उस पर क्लिक करें', hist: 'माप की संभावनाएँ', walk: 'आज़माइए', quiz: 'प्रश्नोत्तरी', score: 'स्कोर', nogates: 'कोई गेट नहीं: क्यूबिट 0 पर ही रहते हैं।', site: 'susinbinary.com पर वापस', tag: 'हर विद्यार्थी के लिए क्वांटम सीखना, बिना हार्डवेयर और भारी गणित के।' },
} as const

const label = (g: Gate) => g.g.toUpperCase()

export function Lab() {
  const [lang, setLang] = useState<Lang>('en')
  const [li, setLi] = useState(0)
  const lesson = LESSONS[li]
  const [gates, setGates] = useState<Gate[]>(lesson.gates)
  const [target, setTarget] = useState(0)
  const [picked, setPicked] = useState<Record<string, number>>({})
  const t = UI[lang]
  const text = lesson[lang]
  const probs = useMemo(() => probabilities(lesson.qubits, gates), [lesson.qubits, gates])
  const other = (target + 1) % lesson.qubits

  const choose = (i: number) => {
    setLi(i)
    setGates(LESSONS[i].gates)
    setTarget(0)
  }
  const add = (g: Gate['g']) =>
    setGates([...gates, { g, q: g === 'cx' || g === 'cz' ? [target, other] : [target] }])
  const score = text.quiz.filter((q, k) => picked[`${lesson.id}-${k}`] === q.answer).length

  return (
    <div lang={lang}>
      <header className="sticky top-0 z-10 border-b border-border bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <a href="https://susinbinary.com" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-slate-900 font-mono text-[11px] font-bold text-white">01</span>
            <span className="font-mono text-[15px] font-bold tracking-tight">SusinBinary</span>
            <span className="font-mono text-[12px] text-slate-500">/ ./quantum</span>
          </a>
          <div role="group" aria-label="Language" className="flex gap-1 font-mono text-[12px]">
            {(['en', 'hi'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`rounded px-3 py-1.5 ${lang === l ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {l === 'en' ? 'English' : 'हिन्दी'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="font-mono text-[12px] text-accent">QFF 2026 · Education · Team SusInBinary</p>
        <h1 className="mt-2 font-heading text-4xl font-bold tracking-tight">QuantumLab</h1>
        <p className="mt-2 max-w-2xl text-slate-600">{t.tag}</p>

        <nav aria-label={t.lessons} className="mt-8 flex flex-wrap gap-2">
          {LESSONS.map((l, i) => (
            <button
              key={l.id}
              onClick={() => choose(i)}
              aria-current={i === li}
              className={`rounded-md border px-4 py-2 font-heading text-sm font-semibold ${i === li ? 'border-slate-900 bg-slate-900 text-white' : 'border-border hover:border-slate-900'}`}
            >
              {i + 1}. {l[lang].title}
            </button>
          ))}
        </nav>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-border bg-surface p-6">
            <h2 className="font-heading text-2xl font-bold">{text.title}</h2>
            <p className="mt-2">{text.intro}</p>
            <h3 className="mt-5 font-mono text-[12px] font-bold uppercase text-accent">{t.walk}</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              {text.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </section>

          <section className="rounded-lg border border-border p-6">
            <h2 className="font-mono text-[12px] font-bold uppercase text-accent">{t.circuit}</h2>
            <div className="mt-3 overflow-x-auto font-mono text-sm">
              {Array.from({ length: lesson.qubits }, (_, q) => (
                <div key={q} className="flex h-11 items-center">
                  <span className="w-8 text-slate-500">q{q}</span>
                  <div className="flex items-center border-t border-slate-400">
                    {gates.map((g, k) => {
                      const hit = g.q.includes(q)
                      const isCtl = g.q.length === 2 && g.q[0] === q
                      return (
                        <span key={k} className="flex w-12 justify-center">
                          {hit && (
                            <button
                              onClick={() => setGates(gates.filter((_, j) => j !== k))}
                              aria-label={`${label(g)} on q${g.q.join(',q')}: remove`}
                              className={`-mt-3.5 flex size-8 items-center justify-center rounded border ${isCtl ? 'rounded-full border-slate-900 bg-slate-900 text-white' : 'border-slate-900 bg-white hover:bg-orange-50'}`}
                            >
                              {isCtl ? '●' : g.q.length === 2 ? (g.g === 'cx' ? 'X' : 'Z') : label(g)}
                            </button>
                          )}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
              {gates.length === 0 && <p className="text-slate-500">{t.nogates}</p>}
            </div>
            <p className="mt-2 text-xs text-slate-500">{t.remove}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-sm">
              <span className="text-slate-600">{t.add}</span>
              {lesson.qubits > 1 && (
                <select aria-label="qubit" value={target} onChange={(e) => setTarget(+e.target.value)} className="rounded border border-border px-2 py-1">
                  {Array.from({ length: lesson.qubits }, (_, q) => <option key={q} value={q}>q{q}</option>)}
                </select>
              )}
              {(['h', 'x', 'z', ...(lesson.qubits > 1 ? ['cx', 'cz'] : [])] as Gate['g'][]).map((g) => (
                <button key={g} onClick={() => add(g)} className="rounded border border-slate-900 px-3 py-1 font-bold hover:bg-slate-900 hover:text-white">
                  {g.toUpperCase()}
                </button>
              ))}
              <button onClick={() => setGates(lesson.gates)} className="ml-auto text-slate-500 underline hover:text-slate-900">{t.reset}</button>
            </div>

            <h2 className="mt-6 font-mono text-[12px] font-bold uppercase text-accent">{t.hist}</h2>
            <ul className="mt-3 space-y-2 font-mono text-sm">
              {probs.map((p, i) => {
                const key = i.toString(2).padStart(lesson.qubits, '0')
                const pct = Math.round(p * 1000) / 10
                return (
                  <li key={key} className="flex items-center gap-3">
                    <span className="w-10">|{key}⟩</span>
                    <div className="h-5 flex-1 rounded bg-slate-100" role="meter" aria-label={`|${key}⟩`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                      <div className="h-5 rounded bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-14 text-right">{pct}%</span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <section className="mt-6 rounded-lg border border-border p-6">
          <h2 className="font-mono text-[12px] font-bold uppercase text-accent">{t.quiz} · {t.score} {score}/{text.quiz.length}</h2>
          <div className="mt-3 grid gap-6 md:grid-cols-3">
            {text.quiz.map((q, k) => {
              const id = `${lesson.id}-${k}`
              const sel = picked[id]
              return (
                <fieldset key={id}>
                  <legend className="font-semibold">{q.q}</legend>
                  <div className="mt-2 space-y-1">
                    {q.options.map((o, j) => (
                      <label key={o} className="flex cursor-pointer items-start gap-2">
                        <input type="radio" name={id} checked={sel === j} onChange={() => setPicked({ ...picked, [id]: j })} className="mt-1.5 accent-[#c2410c]" />
                        <span>{o}</span>
                      </label>
                    ))}
                  </div>
                  {sel !== undefined && (
                    <p role="status" className={`mt-2 text-sm ${sel === q.answer ? 'text-green-700' : 'text-red-700'}`}>
                      {sel === q.answer ? '✓ ' : '✗ '}{q.why}
                    </p>
                  )}
                </fieldset>
              )
            })}
          </div>
        </section>

        <footer className="mt-10 border-t border-border pt-6 font-mono text-[12px] text-slate-500">
          <a href="https://susinbinary.com" className="underline hover:text-slate-900">{t.site}</a>
          {' · '}
          <a href="https://github.com/harshit777/qiskit-fall-fest-26-quantumlab" className="underline hover:text-slate-900">GitHub</a>
          {' · MIT · Qiskit'}
        </footer>
      </main>
    </div>
  )
}
