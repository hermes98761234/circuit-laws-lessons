export type Kind = 'R' | 'V' | 'W'
export interface CNode { id: string; x: number; y: number }
/** R: resistor (ohms). V: ideal source, `a` is the + terminal. W: ideal wire. */
export interface Element { id: string; kind: Kind; a: string; b: string; value: number }
export interface Circuit { nodes: CNode[]; elements: Element[]; ground: string; probes?: Record<string, string> }
export interface Solution {
  /** Node voltages relative to ground. */
  voltage: Record<string, number>
  /** Current through each element, flowing from `a` to `b` through the element. */
  current: Record<string, number>
  /** Voltage drop V(a) - V(b) across each element. */
  drop: Record<string, number>
}

export const seriesR = (...r: number[]) => r.reduce((s, x) => s + x, 0)
export const parallelR = (...r: number[]) => 1 / r.reduce((s, x) => s + 1 / x, 0)
export const divider = (vin: number, r1: number, r2: number) => (vin * r2) / (r1 + r2)

/** Solves A x = b by Gaussian elimination with partial pivoting. */
export function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    if (Math.abs(M[p][c]) < 1e-12) throw new Error('Singular circuit')
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c]
      if (f !== 0) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n]
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]
    x[r] = s / M[r][r]
  }
  return x
}

/** Modified nodal analysis: unknowns are node voltages (ground = 0) and the current of every V/W element. */
export function solve(c: Circuit): Solution {
  const ids = c.nodes.map((n) => n.id).filter((id) => id !== c.ground)
  const idx = new Map(ids.map((id, i) => [id, i]))
  const src = c.elements.filter((e) => e.kind !== 'R')
  const n = ids.length + src.length
  const A = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  const z = new Array<number>(n).fill(0)
  const at = (id: string) => idx.get(id)
  for (const e of c.elements) {
    const ia = at(e.a)
    const ib = at(e.b)
    if (e.kind === 'R') {
      const g = 1 / e.value
      if (ia !== undefined) A[ia][ia] += g
      if (ib !== undefined) A[ib][ib] += g
      if (ia !== undefined && ib !== undefined) { A[ia][ib] -= g; A[ib][ia] -= g }
    }
  }
  src.forEach((e, k) => {
    const row = ids.length + k
    const ia = at(e.a)
    const ib = at(e.b)
    if (ia !== undefined) { A[ia][row] += 1; A[row][ia] += 1 }
    if (ib !== undefined) { A[ib][row] -= 1; A[row][ib] -= 1 }
    z[row] = e.kind === 'V' ? e.value : 0
  })
  const x = solveLinear(A, z)
  const voltage: Record<string, number> = { [c.ground]: 0 }
  ids.forEach((id, i) => (voltage[id] = x[i]))
  const current: Record<string, number> = {}
  const drop: Record<string, number> = {}
  for (const e of c.elements) {
    drop[e.id] = voltage[e.a] - voltage[e.b]
    if (e.kind === 'R') current[e.id] = drop[e.id] / e.value
  }
  src.forEach((e, k) => (current[e.id] = x[ids.length + k]))
  return { voltage, current, drop }
}
