import { describe, expect, it } from 'vitest'
import { divider, parallelR, seriesR, solve, solveLinear, type Circuit } from './circuit'
import { si } from './format'
import { LESSONS, DEFAULTS } from './lessons'

describe('solveLinear', () => {
  it('solves a 2x2 system', () => {
    const x = solveLinear([[2, 1], [1, 3]], [5, 10])
    expect(x[0]).toBeCloseTo(1)
    expect(x[1]).toBeCloseTo(3)
  })
  it('detects singular matrices', () => {
    expect(() => solveLinear([[1, 1], [2, 2]], [1, 2])).toThrow()
  })
})

describe('equivalent resistance', () => {
  it('series and parallel', () => {
    expect(seriesR(100, 200, 300)).toBe(600)
    expect(parallelR(100, 100)).toBeCloseTo(50)
    expect(parallelR(100, 200, 300)).toBeCloseTo(54.5454545, 6)
    expect(divider(12, 100, 200)).toBeCloseTo(8)
  })
})

const simple: Circuit = {
  ground: 'D',
  nodes: [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 1, y: 0 }, { id: 'C', x: 1, y: 1 }, { id: 'D', x: 0, y: 1 }],
  elements: [
    { id: 'V', kind: 'V', a: 'A', b: 'D', value: 12 },
    { id: 'R1', kind: 'R', a: 'A', b: 'B', value: 100 },
    { id: 'R2', kind: 'R', a: 'B', b: 'C', value: 200 },
    { id: 'W', kind: 'W', a: 'C', b: 'D', value: 0 },
  ],
}

describe('solve', () => {
  it('series divider matches Ohm', () => {
    const s = solve(simple)
    expect(s.voltage.B).toBeCloseTo(8)
    expect(s.current.R1).toBeCloseTo(0.04)
    expect(s.current.R2).toBeCloseTo(0.04)
    // source delivers power: current through it from + to - is negative
    expect(s.current.V).toBeCloseTo(-0.04)
    expect(s.current.W).toBeCloseTo(0.04)
  })
})

describe('lessons', () => {
  it('conserve power and satisfy KCL for every lesson', () => {
    for (const l of LESSONS) {
      const c = l.build(DEFAULTS)
      const s = solve(c)
      const p = c.elements.reduce((sum, e) => sum + s.drop[e.id] * s.current[e.id], 0)
      expect(Math.abs(p), l.id).toBeLessThan(1e-9)
      for (const n of c.nodes) {
        const out = c.elements.reduce((sum, e) => sum + (e.a === n.id ? s.current[e.id] : 0) - (e.b === n.id ? s.current[e.id] : 0), 0)
        expect(Math.abs(out), `${l.id}:${n.id}`).toBeLessThan(1e-9)
      }
    }
  })
  it('Wheatstone bridge: balanced gives zero bridge current, unbalanced matches hand value', () => {
    const l = LESSONS.find((x) => x.id === 'nodal')!
    const bal = solve(l.build({ ...DEFAULTS, R1: 100, R2: 200, R3: 300, R4: 600, R5: 500 }))
    expect(bal.current.R5).toBeCloseTo(0, 12)
    // V=12, R1=100,R2=200,R3=100,R4=200 (balanced again), then unbalance: R4=100
    const un = solve(l.build({ ...DEFAULTS, V: 12, R1: 100, R2: 100, R3: 100, R4: 300, R5: 100 }))
    // hand nodal: Vt=12. L: (12-L)/100 = L/100 + (L-R)/100 ; R: (12-R)/100 + (L-R)/100 = R/300
    // => 12 = 3L - R ; 12 + L = R(2 + 1/3) ... solve: R = (12+L)*3/7; 12 = 3L - 3(12+L)/7 => 84 = 21L - 36 - 3L => L = 120/18
    const L = 120 / 18
    const R = ((12 + L) * 3) / 7
    expect(un.voltage.L).toBeCloseTo(L, 9)
    expect(un.voltage.Rt).toBeCloseTo(R, 9)
  })
  it('formats SI values', () => {
    expect(si(0.012, 'A')).toBe('12 mA')
    expect(si(4700, 'Ω')).toBe('4.7 kΩ')
    expect(si(0, 'V')).toBe('0 V')
  })
})
