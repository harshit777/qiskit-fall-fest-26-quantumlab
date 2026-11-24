import type { ReactNode } from 'react'

const TABS = [
  ['/', './learn'],
  ['/code', './code'],
] as const

export function Header({ active, right }: { active: '/' | '/code'; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <a href="https://susinbinary.com" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-slate-900 font-mono text-[11px] font-bold text-white">01</span>
            <span className="font-mono text-[15px] font-bold tracking-tight">SusinBinary</span>
          </a>
          <nav aria-label="Sections" className="flex gap-1 font-mono text-[12px]">
            {TABS.map(([href, name]) => (
              <a key={href} href={href} aria-current={active === href ? 'page' : undefined}
                className={`rounded px-3 py-1.5 ${active === href ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                {name}
              </a>
            ))}
          </nav>
        </div>
        {right}
      </div>
    </header>
  )
}
