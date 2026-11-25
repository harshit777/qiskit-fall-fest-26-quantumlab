'use client'

import { LANGS, useLang, useT } from '@/lib/i18n'

const TABS = [
  ['/', 'learn'],
  ['/code', 'code'],
] as const

export function Header({ active }: { active: '/' | '/code' }) {
  const t = useT()
  const { lang, setLang } = useLang()
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-6">
        <div className="flex items-center gap-4">
          <a href="https://susinbinary.com" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-slate-900 font-mono text-[11px] font-bold text-white">01</span>
            <span className="hidden font-mono text-[15px] font-bold tracking-tight sm:inline">SusinBinary</span>
          </a>
          <nav aria-label={t('sections')} className="flex gap-1 font-mono text-[12px]">
            {TABS.map(([href, key]) => (
              <a key={href} href={href} aria-current={active === href ? 'page' : undefined}
                className={`rounded px-3 py-1.5 ${active === href ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                {t(key)}
              </a>
            ))}
          </nav>
        </div>
        <div role="group" aria-label={t('language')} className="flex gap-1 font-mono text-[12px]">
          {LANGS.map(({ code, label }) => (
            <button key={code} onClick={() => setLang(code)} aria-pressed={lang === code}
              className={`rounded px-3 py-1.5 ${lang === code ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
