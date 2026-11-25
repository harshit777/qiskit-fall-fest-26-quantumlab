'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { en, hi, kn, type Dict, type Lang } from './dicts'
export { LANGS, type Lang } from './dicts'

const DICTS: Record<Lang, Dict> = { en, hi, kn }
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => {} })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('en')
  // Read the saved choice after mount (not in the initial state) so server and client HTML match.
  useEffect(() => {
    const s = localStorage.getItem('lang')
    if (s === 'hi' || s === 'kn') setLang(s)
  }, [])
  useEffect(() => {
    document.documentElement.lang = lang
    localStorage.setItem('lang', lang)
  }, [lang])
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>
}

export const useLang = () => useContext(Ctx)

/** t('key') or t('key', {a: 1}). Missing keys fall back to English, then to the key itself. */
export function useT() {
  const { lang } = useLang()
  return (key: string, p: Record<string, string | number> = {}): string => {
    const v = DICTS[lang][key] ?? en[key] ?? key
    return typeof v === 'function' ? v(p) : v
  }
}

/** Server messages look like {k: 'delta', v: {...}} (or v: a plain value). */
export type Msg = { k: string; v?: string | number | Record<string, string | number> }
export function useMsg() {
  const t = useT()
  return (m: Msg): string => {
    const k = m.k === 'shots' ? 'shotsChip' : m.k
    return t(k, typeof m.v === 'object' ? m.v : { v: m.v ?? '' })
  }
}
