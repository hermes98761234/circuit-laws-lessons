import type { Circuit, Element, Solution } from '../lib/circuit'
import { si } from '../lib/format'
import type { T } from '../i18n'

interface Props { circuit: Circuit; sol: Solution; animate: boolean; t: T }

function geom(c: Circuit, e: Element) {
  const na = c.nodes.find((n) => n.id === e.a)!
  const nb = c.nodes.find((n) => n.id === e.b)!
  const dx = nb.x - na.x, dy = nb.y - na.y
  const len = Math.hypot(dx, dy)
  const u = { x: dx / len, y: dy / len }
  return { na, nb, len, u, n: { x: -u.y, y: u.x }, mid: { x: (na.x + nb.x) / 2, y: (na.y + nb.y) / 2 } }
}

export default function CircuitView({ circuit: c, sol, animate, t }: Props) {
  const cx = c.nodes.reduce((s, n) => s + n.x, 0) / c.nodes.length
  const cy = c.nodes.reduce((s, n) => s + n.y, 0) / c.nodes.length
  const imax = Math.max(1e-12, ...c.elements.map((e) => Math.abs(sol.current[e.id])))
  return (
    <svg viewBox="0 0 620 350" role="img" aria-label={t('Circuit diagram')} className="circuit">
      {c.elements.map((e) => {
        const { na, nb, len, u, n, mid } = geom(c, e)
        const h = e.kind === 'R' ? 30 : e.kind === 'V' ? 6 : 0
        const p = (k: number, s = 0) => ({ x: mid.x + u.x * k + n.x * s, y: mid.y + u.y * k + n.y * s })
        const i = sol.current[e.id]
        const flowing = Math.abs(i) > imax * 1e-6 && Math.abs(i) > 1e-12
        const speed = 18 + 90 * Math.sqrt(Math.abs(i) / imax)
        const dur = `${(16 / speed).toFixed(3)}s`
        const s1 = p(-h), s2 = p(h)
        const segs: [number, number, number, number][] = h
          ? [[na.x, na.y, s1.x, s1.y], [s2.x, s2.y, nb.x, nb.y]]
          : [[na.x, na.y, nb.x, nb.y]]
        let o = { x: n.x, y: n.y }
        if (o.x * (mid.x - cx) + o.y * (mid.y - cy) < 0) o = { x: -o.x, y: -o.y }
        const P = { x: mid.x + o.x * 26, y: mid.y + o.y * 26 }
        const anchor = o.x > 0.4 ? 'start' : o.x < -0.4 ? 'end' : 'middle'
        const [y1, y2] = o.y < -0.5 ? [P.y - 14, P.y] : o.y > 0.5 ? [P.y + 10, P.y + 24] : [P.y - 2, P.y + 12]
        let body = null
        if (e.kind === 'R') {
          const pts = [p(-h)]
          for (let k = 1; k <= 6; k++) pts.push(p(-h + (2 * h * k) / 7, k % 2 ? 8 : -8))
          pts.push(p(h))
          body = <polyline points={pts.map((q) => `${q.x},${q.y}`).join(' ')} fill="none" className="wire" />
        } else if (e.kind === 'V') {
          const a = p(-4, 0)
          const b = p(4, 0)
          body = (
            <g className="wire">
              <line x1={a.x + n.x * 18} y1={a.y + n.y * 18} x2={a.x - n.x * 18} y2={a.y - n.y * 18} />
              <line x1={b.x + n.x * 9} y1={b.y + n.y * 9} x2={b.x - n.x * 9} y2={b.y - n.y * 9} />
              <text x={p(-14, 20).x} y={p(-14, 20).y + 4} className="sym" textAnchor="middle">+</text>
            </g>
          )
        }
        const label = e.kind === 'R' ? `${e.id} = ${si(e.value, 'Ω')}` : e.kind === 'V' ? si(e.value, 'V') : ''
        const vals = e.kind === 'W' ? '' : `${si(Math.abs(sol.drop[e.id]), 'V')} · ${si(Math.abs(i), 'A')}`
        return (
          <g key={e.id}>
            {segs.map((s, k) => (
              <g key={k}>
                <line x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} className="wire" />
                {flowing && (
                  <line x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} className="flow"
                    style={{ animationDuration: dur, animationDirection: i < 0 ? 'reverse' : 'normal', animationPlayState: animate ? 'running' : 'paused' }} />
                )}
              </g>
            ))}
            {body}
            {e.kind !== 'W' && (
              <text textAnchor={anchor} className="lbl">
                <tspan x={P.x} y={y1} fontWeight="700">{label}</tspan>
                <tspan x={P.x} y={y2} className="val">{vals}</tspan>
              </text>
            )}
            <title>{`${e.id}: ${si(Math.abs(i), 'A')}`}</title>
            {len < 0 && null}
          </g>
        )
      })}
      {c.nodes.map((n) => (
        <circle key={n.id} cx={n.x} cy={n.y} r={3.5} className="node" />
      ))}
      {Object.entries(c.probes ?? {}).map(([id, name]) => {
        const n = c.nodes.find((x) => x.id === id)!
        const left = n.x < cx
        return (
          <g key={id}>
            <circle cx={n.x} cy={n.y} r={9} className="ring" />
            <text x={n.x + (left ? -14 : 14)} y={n.y + 22} textAnchor={left ? 'end' : 'start'} className="probe">
              {name === 'node' ? '' : `${name} = `}{si(sol.voltage[id], 'V')}
            </text>
          </g>
        )
      })}
      <g className="gnd" transform={`translate(${c.nodes.find((n) => n.id === c.ground)!.x},${c.nodes.find((n) => n.id === c.ground)!.y + 4})`}>
        <line x1="0" y1="0" x2="0" y2="10" /><line x1="-12" y1="10" x2="12" y2="10" /><line x1="-7" y1="15" x2="7" y2="15" /><line x1="-3" y1="20" x2="3" y2="20" />
      </g>
    </svg>
  )
}
