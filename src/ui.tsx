import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { tr, type Lang, type T } from './i18n'

export type Theme = 'auto' | 'light' | 'dark'
interface Prefs { lang: Lang; theme: Theme }
const KEY = 'app-prefs-v1:' + (document.title || 'app')

function load(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>
    return {
      lang: p.lang === 'uk' || p.lang === 'en' ? p.lang : navigator.language.toLowerCase().startsWith('uk') ? 'uk' : 'en',
      theme: p.theme === 'light' || p.theme === 'dark' ? p.theme : 'auto',
    }
  } catch {
    return { lang: 'en', theme: 'auto' }
  }
}

/** Language + theme, persisted in localStorage and applied to <html>. */
export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(load)
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch { /* private mode */ }
    const root = document.documentElement
    if (prefs.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = prefs.theme
    root.lang = prefs.lang
  }, [prefs])
  const t: T = useCallback((s, ...a) => tr(prefs.lang, s, ...a), [prefs.lang])
  return { ...prefs, t, setLang: (lang: Lang) => setPrefs((p) => ({ ...p, lang })), setTheme: (theme: Theme) => setPrefs((p) => ({ ...p, theme })) }
}

export function Toolbar(props: { title: string; hint: string; prefs: ReturnType<typeof usePrefs>; children?: ReactNode }) {
  const { prefs: p, t } = { prefs: props.prefs, t: props.prefs.t }
  return (
    <header className="toolbar">
      <span className="brand">{props.title}</span>
      <span className="hint grow">{props.hint}</span>
      {props.children}
      <select aria-label={t('Theme')} value={p.theme} onChange={(e) => p.setTheme(e.target.value as Theme)}>
        <option value="auto">{t('System')}</option>
        <option value="light">{t('Light')}</option>
        <option value="dark">{t('Dark')}</option>
      </select>
      <select aria-label={t('Language')} value={p.lang} onChange={(e) => p.setLang(e.target.value as Lang)}>
        <option value="en">English</option>
        <option value="uk">Українська</option>
      </select>
    </header>
  )
}

export function Footer(props: { repo: string; note: string; t: T }) {
  return (
    <p className="hint foot">
      {props.note}{' '}
      <a href={`https://github.com/hermes98761234/${props.repo}`}>{props.t('Source on GitHub')}</a>
    </p>
  )
}

/** Persistent state in localStorage. */
export function useStored<V>(key: string, init: V): [V, (v: V | ((p: V) => V)) => void] {
  const [v, setV] = useState<V>(() => {
    try {
      const s = localStorage.getItem(key)
      return s ? ({ ...(init as object), ...JSON.parse(s) } as V) : init
    } catch { return init }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* ignore */ } }, [key, v])
  return [v, setV]
}
