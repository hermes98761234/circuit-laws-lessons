import { useEffect, useMemo, useState } from 'react'
import { Footer, Toolbar, usePrefs, useStored } from './ui'
import { N, type T } from './i18n'
import { solve } from './lib/circuit'
import { mulberry32, parseNum, si } from './lib/format'
import { DEFAULTS, LESSONS, type ParamKey, type Params, type ParamSpec } from './lib/lessons'
import CircuitView from './components/CircuitView'

const SPECS: Record<ParamKey, ParamSpec> = {
  V: { key: 'V', min: 1, max: 24, step: 1, unit: 'V' },
  R1: { key: 'R1', min: 10, max: 1000, step: 10, unit: 'Ω' },
  R2: { key: 'R2', min: 10, max: 1000, step: 10, unit: 'Ω' },
  R3: { key: 'R3', min: 10, max: 1000, step: 10, unit: 'Ω' },
  R4: { key: 'R4', min: 10, max: 1000, step: 10, unit: 'Ω' },
  R5: { key: 'R5', min: 10, max: 1000, step: 10, unit: 'Ω' },
}
const SLIDER_LABEL: Record<ParamKey, string> = { V: N('Source voltage'), R1: 'R1', R2: 'R2', R3: 'R3', R4: 'R4', R5: 'R5' }

function fromHash(): number {
  const m = /lesson=(\d+)/.exec(location.hash)
  const i = m ? Number(m[1]) - 1 : 0
  return i >= 0 && i < LESSONS.length ? i : 0
}

function Quiz({ lessonIdx, t, onScore }: { lessonIdx: number; t: T; onScore: (n: number) => void }) {
  const lesson = LESSONS[lessonIdx]
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9))
  const qs = useMemo(() => lesson.quiz(mulberry32(seed)), [lesson, seed])
  const [ans, setAns] = useState<string[]>([])
  const [checked, setChecked] = useState(false)
  const ok = (i: number) => {
    const v = parseNum(ans[i] ?? '')
    const a = qs[i].answer
    return Number.isFinite(v) && Math.abs(v - a) <= Math.max(0.02 * Math.abs(a), 0.005)
  }
  const score = checked ? qs.filter((_, i) => ok(i)).length : 0
  return (
    <div className="box">
      <h3>{t('Quiz')}</h3>
      {qs.map((q, i) => (
        <div className="q" key={i}>
          <div>{i + 1}. {t(q.text, ...q.args)}</div>
          <div className="row" style={{ marginTop: 4 }}>
            <input type="text" inputMode="decimal" aria-label={t('Your answer')} value={ans[i] ?? ''} disabled={checked}
              onChange={(e) => setAns((a) => { const n = [...a]; n[i] = e.target.value; return n })} />
            <span>{q.unit}</span>
            {checked && (ok(i)
              ? <span className="ok-text">{t('Correct')}</span>
              : <span className="err-text">{t('Answer: {0}', `${Number(q.answer.toPrecision(4))} ${q.unit}`)}</span>)}
          </div>
        </div>
      ))}
      <div className="row" style={{ marginTop: 8 }}>
        {!checked
          ? <button className="primary" onClick={() => { setChecked(true); onScore(qs.filter((_, i) => ok(i)).length) }}>{t('Check answers')}</button>
          : <><strong>{t('Score: {0} / {1}', score, qs.length)}</strong><button onClick={() => { setSeed(Math.floor(Math.random() * 1e9)); setAns([]); setChecked(false) }}>{t('New questions')}</button></>}
      </div>
    </div>
  )
}

export default function App() {
  const prefs = usePrefs()
  const { t } = prefs
  const [idx, setIdx] = useState(fromHash)
  const [progress, setProgress] = useStored<Record<string, number>>('circuit-laws-progress-v1', {})
  const [params, setParams] = useState<Params>(DEFAULTS)
  const [animate, setAnimate] = useState(true)
  const lesson = LESSONS[idx]
  useEffect(() => { document.title = `${t(lesson.title)} · Circuit Laws Lessons` }, [lesson, t])
  useEffect(() => {
    const on = () => { setIdx(fromHash()); setParams(DEFAULTS) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = (i: number) => { history.replaceState(null, '', `#lesson=${i + 1}`); setIdx(i); setParams(DEFAULTS) }
  const circuit = useMemo(() => lesson.build(params), [lesson, params])
  const sol = useMemo(() => solve(circuit), [circuit])
  const readouts = lesson.readouts(params, sol)

  return (
    <div className="app">
      <Toolbar title={t('Circuit Laws Lessons')} hint={t("Ohm's and Kirchhoff's laws with live circuits.")} prefs={prefs} />
      <main className="main">
        <div className="cols">
          <nav className="box" aria-label={t('Lessons')}>
            <h3>{t('Lessons')}</h3>
            <div className="lessons">
              {LESSONS.map((l, i) => (
                <button key={l.id} className={i === idx ? 'active' : ''} onClick={() => go(i)}>
                  <span className="num">{i + 1}</span><span>{t(l.title)}</span>
                  {progress[l.id] !== undefined && <span className="spacer" />}
                  {progress[l.id] !== undefined && <span title={t('Best quiz score')}>{progress[l.id] >= 3 ? '★' : `${progress[l.id]}/3`}</span>}
                </button>
              ))}
            </div>
          </nav>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <div className="box lesson-intro">
              <h3>{t('Lesson {0}', idx + 1)}: {t(lesson.title)}</h3>
              {lesson.intro.map((p) => <p key={p}>{t(p)}</p>)}
            </div>
            <div className="box">
              <div className="canvas-wrap"><CircuitView circuit={circuit} sol={sol} animate={animate} t={t} /></div>
              <div className="sliders">
                {lesson.params.map((k) => {
                  const s = SPECS[k]
                  return (
                    <label key={k}>
                      <span>{t(SLIDER_LABEL[k])}: <span className="val">{si(params[k], s.unit)}</span></span>
                      <input type="range" min={s.min} max={s.max} step={s.step} value={params[k]}
                        onChange={(e) => setParams((p) => ({ ...p, [k]: Number(e.target.value) }))} />
                    </label>
                  )
                })}
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                <button onClick={() => setAnimate((a) => !a)}>{animate ? t('Pause flow') : t('Play flow')}</button>
                <button onClick={() => setParams(DEFAULTS)}>{t('Reset values')}</button>
                <span className="hint">{t('Dots show conventional current; faster means more current.')}</span>
              </div>
            </div>
            <div className="box">
              <h3>{t('Measurements')}</h3>
              <table className="data readouts"><tbody>
                {readouts.map((r) => (
                  <tr key={r.label}><td>{t(r.label)}</td><td>{si(r.value, r.unit)}</td><td>{r.formula}</td></tr>
                ))}
              </tbody></table>
            </div>
            <Quiz key={idx} lessonIdx={idx} t={t} onScore={(n) => setProgress((p) => ({ ...p, [lesson.id]: Math.max(p[lesson.id] ?? 0, n) }))} />
            <div className="row">
              <button disabled={idx === 0} onClick={() => go(idx - 1)}>{t('Previous lesson')}</button>
              <button disabled={idx === LESSONS.length - 1} onClick={() => go(idx + 1)}>{t('Next lesson')}</button>
            </div>
          </div>
        </div>
      </main>
      <Footer repo="circuit-laws-lessons" note={t('Ideal components, DC only. All maths runs in your browser.')} t={t} />
    </div>
  )
}
