'use client'

import { useEffect, useRef, useState } from 'react'
import { Header } from '@/components/header'
import { EXAMPLES } from '@/lib/examples'
import { useMsg, useT, type Msg } from '@/lib/i18n'

type Stage = {
  id: string
  p?: Record<string, string | number>
  chips?: Msg[]
  note?: Msg | null
  stats?: { depth: number; size: number; twoq: number }
  diagrams?: { label: string; text: string }[]
  table?: { head: string[]; rows: (string | number)[][]; highlight: number }
  histogram?: { key: string; ideal: number; measured: number; model?: number }[]
  tvd?: number
  tvdModel?: number
  hardware?: boolean
}
type Job = { status: string; phase: Msg | null; stages: (Stage | Report)[]; error: { k: string; v?: Record<string, string | number> } | null }
type Report = { id: 'report'; backend: string; job: string; [k: string]: unknown }

const ORDER = ['build', 'decompose', 'optimize', 'transpile', 'execute', 'post']
const first = Object.keys(EXAMPLES)[0]

export function CodeLab() {
  const t = useT()
  const msg = useMsg()
  const [ex, setEx] = useState(first)
  const [code, setCode] = useState(EXAMPLES[first])
  const [level, setLevel] = useState(1)
  const [shots, setShots] = useState(1024)
  const [backend, setBackend] = useState<'sim' | 'ibm'>('sim')
  const [serverKey, setServerKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then((d) => setServerKey(!!d.serverKey)).catch(() => setError('noServer'))
    return () => clearTimeout(timer.current)
  }, [])

  const poll = async (id: string) => {
    try {
      const j: Job = await (await fetch(`/api/jobs/${id}`)).json()
      setJob(j)
      if (j.status === 'running') timer.current = setTimeout(() => poll(id), 700)
      else setBusy(false)
    } catch {
      setError('lost')
      setBusy(false)
    }
  }

  const run = async () => {
    clearTimeout(timer.current)
    setBusy(true)
    setError(null)
    setJob(null)
    const r = await fetch('/api/run', { method: 'POST', body: JSON.stringify({ code, level, shots, backend, apiKey: backend === 'ibm' ? apiKey.trim() : undefined }) }).catch(() => null)
    const d = await r?.json().catch(() => null)
    if (!r || !r.ok) {
      setError(d?.error?.k ?? 'noServer')
      setBusy(false)
      return
    }
    setApiKey('')
    poll(d.id)
  }

  const done = new Set(job?.stages.map((s) => s.id))
  const showError = (e: string) => t(e)
  const jobError = (e: NonNullable<Job['error']>) => (e.k === 'raw' ? String(e.v) : t(e.k, e.v ?? {}))
  const current = ORDER.find((id) => !done.has(id))

  return (
    <div>
      <Header active="/code" />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="font-mono text-[12px] text-accent">{t('codeEyebrow')}</p>
        <h1 className="mt-2 font-heading text-4xl font-bold tracking-tight">{t('codeTitle')}</h1>
        <p className="mt-2 max-w-2xl text-slate-600">{t('codeIntro')}</p>

        <ol aria-label={t('lifecycle')} className="mt-6 flex flex-wrap gap-2 font-mono text-[12px]">
          {ORDER.map((id, i) => {
            const state = done.has(id) ? 'done' : busy && id === current ? 'now' : 'todo'
            return (
              <li key={id} className={`rounded-md border px-3 py-1.5 ${state === 'done' ? 'border-slate-900 bg-slate-900 text-white' : state === 'now' ? 'border-accent text-accent' : 'border-border text-slate-500'}`}>
                {i + 1} {t(`s${i + 1}`)}
              </li>
            )
          })}
        </ol>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <section className="self-start rounded-lg border border-border p-4">
            <label className="flex flex-wrap items-center gap-2 font-mono text-sm">
              <span className="text-slate-600">{t('example')}</span>
              <select value={ex} onChange={(e) => { setEx(e.target.value); setCode(EXAMPLES[e.target.value]) }} className="rounded border border-border px-2 py-1">
                {Object.keys(EXAMPLES).map((k) => <option key={k} value={k}>{t(k)}</option>)}
              </select>
            </label>
            <textarea
              aria-label={t('qiskitCode')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              rows={18}
              maxLength={6000}
              className="mt-3 w-full resize-y rounded border border-border bg-surface p-3 font-mono text-[13px] leading-relaxed"
            />
            <p className="mt-1 text-xs text-slate-500">{t('codeHelp')}</p>

            <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-sm">
              <label>{t('optLevel')}
                <select value={level} onChange={(e) => setLevel(+e.target.value)} className="mt-1 block w-full rounded border border-border px-2 py-1">
                  {[0, 1, 2, 3].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
              <label>{t('shots')}
                <select value={shots} onChange={(e) => setShots(+e.target.value)} className="mt-1 block w-full rounded border border-border px-2 py-1">
                  {[256, 1024, 4096].map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="col-span-2">{t('runOn')}
                <select value={backend} onChange={(e) => setBackend(e.target.value as 'sim' | 'ibm')} className="mt-1 block w-full rounded border border-border px-2 py-1">
                  <option value="sim">{t('simulator')}</option>
                  <option value="ibm">{t('ibm')}{t('ibmQueue')}</option>
                </select>
              </label>
            </div>
            {backend === 'ibm' && (
              <div className="mt-3 space-y-2">
                <p className="rounded border border-orange-200 bg-orange-50 p-2 text-xs text-orange-900">{t('hwWarn')}</p>
                <label className="block font-mono text-sm">{t('apiKey')}
                  <input type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                    placeholder={serverKey ? t('apiKeyServer') : t('apiKeyPlace')} className="mt-1 block w-full rounded border border-border px-2 py-1" />
                </label>
                <p className="text-xs text-slate-500">{t('apiKeyHelp')}</p>
              </div>
            )}
            <button onClick={run} disabled={busy || (backend === 'ibm' && !serverKey && apiKey.trim().length < 20)} className="mt-4 h-11 w-full rounded-md bg-slate-900 font-heading text-sm font-bold text-white disabled:opacity-50">
              {busy ? (job?.phase ? msg(job.phase) : t('running')) : t('runBtn')}
            </button>
            {error && <p role="alert" className="mt-3 whitespace-pre-wrap rounded border border-red-300 bg-red-50 p-3 font-mono text-sm text-red-800">{showError(error)}</p>}
          </section>

          <section aria-live="polite" className="min-w-0 space-y-4">
            {job?.error && <p role="alert" className="whitespace-pre-wrap rounded border border-red-300 bg-red-50 p-3 font-mono text-sm text-red-800">{jobError(job.error)}</p>}
            {!job && !error && <p className="rounded-lg border border-dashed border-border p-8 text-center text-slate-500">{t('empty')}</p>}
            {job?.stages.map((s) => (s.id === 'report' ? <ReportCard key="report" r={s as Report} /> : <StageCard key={s.id} s={s as Stage} />))}
          </section>
        </div>
      </main>
    </div>
  )
}

function StageCard({ s }: { s: Stage }) {
  const t = useT()
  const msg = useMsg()
  return (
    <article className="min-w-0 rounded-lg border border-border p-5">
      <h2 className="font-heading text-xl font-bold">{t(`${s.id}.title`, s.p)}</h2>
      <p className="mt-1 text-sm text-slate-600">{t(`${s.id}.why`)}</p>
      {s.chips && s.chips.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-2 font-mono text-[12px]">
          {s.chips.map((c) => <span key={msg(c)} className="rounded border border-border bg-surface px-2 py-1">{msg(c)}</span>)}
        </p>
      )}
      {s.stats && (
        <p className="mt-3 font-mono text-sm">{t('depth')} <b>{s.stats.depth}</b> · {t('gates')} <b>{s.stats.size}</b> · {t('twoq')} <b>{s.stats.twoq}</b></p>
      )}
      {s.note && <p className="mt-2 font-mono text-sm text-accent">{msg(s.note)}</p>}
      {s.diagrams?.map((d) => (
        <figure key={d.label} className="mt-3">
          <figcaption className="font-mono text-[12px] text-slate-500">{d.label}</figcaption>
          <pre className="mt-1 overflow-x-auto rounded bg-slate-900 p-3 font-mono text-[12px] leading-tight text-slate-100">{d.text}</pre>
        </figure>
      ))}
      {s.table && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full font-mono text-[12px]">
            <thead><tr className="border-b border-border text-left">{['hLevel', 'hDepth', 'hGates', 'hTwoq', 'hOps'].map((h) => <th key={h} className="py-1 pr-3">{t(h)}</th>)}</tr></thead>
            <tbody>
              {s.table.rows.map((r) => (
                <tr key={r[0]} className={`border-b border-border ${r[0] === s.table!.highlight ? 'bg-orange-50 font-bold' : ''}`}>
                  {r.map((c, i) => <td key={i} className="py-1 pr-3">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-slate-500">{t('tableNote')}</p>
        </div>
      )}
      {s.histogram && (
        <div className="mt-3">
          <ul className="space-y-1.5 font-mono text-[12px]">
            {s.histogram.map((h) => (
              <li key={h.key} className="flex items-center gap-2">
                <span className="w-14">{h.key}</span>
                <div className="flex-1 space-y-0.5" role="img" aria-label={`${h.key}: ${t('ideal')} ${(h.ideal * 100).toFixed(1)}%, ${t('measured')} ${(h.measured * 100).toFixed(1)}%${h.model !== undefined ? `, ${t('modelBars')} ${(h.model * 100).toFixed(1)}%` : ''}`}>
                  <div className="h-2 rounded bg-slate-900" style={{ width: `${h.ideal * 100}%` }} />
                  <div className="h-2 rounded bg-accent" style={{ width: `${h.measured * 100}%` }} />
                  {h.model !== undefined && <div className="h-2 rounded bg-sky-600" style={{ width: `${h.model * 100}%` }} />}
                </div>
                <span className="w-40 whitespace-nowrap text-right">{(h.ideal * 100).toFixed(1)} / {(h.measured * 100).toFixed(1)}{h.model !== undefined ? ` / ${(h.model * 100).toFixed(1)}` : ''}%</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[12px]"><span className="text-slate-900">■</span> {t('ideal')} · <span className="text-accent">■</span> {s.tvdModel !== undefined ? t('hwBars') : t('measured')}{s.tvdModel !== undefined && <> · <span className="text-sky-600">■</span> {t('modelBars')}</>} · {s.tvdModel !== undefined ? t('tvdHw') : t('tvdLabel')} <b>{s.tvd}</b>{s.tvdModel !== undefined && <> · {t('tvdModel')} <b>{s.tvdModel}</b></>}</p>
        </div>
      )}
    </article>
  )
}

function ReportCard({ r }: { r: Report }) {
  const t = useT()
  const hw = Number(r.tvd_hardware), model = Number(r.tvd_noise_model)
  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }))
    a.download = `quantumlab-${r.backend}-${r.job}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <article className="min-w-0 rounded-lg border border-accent p-5">
      <h2 className="font-heading text-xl font-bold">{t('report')}</h2>
      <p className="mt-2 font-mono text-sm">{r.backend} · job {r.job}</p>
      {!Number.isNaN(model) && <p className="mt-2 text-sm">{t('hwRead', { hw, model, rel: Math.abs(hw - model) <= 0.015 ? 'same' : hw < model ? 'closer' : 'further' })}</p>}
      <button onClick={download} className="mt-3 h-10 rounded-md border border-slate-900 px-4 font-heading text-sm font-bold hover:bg-slate-900 hover:text-white">{t('download')}</button>
    </article>
  )
}
