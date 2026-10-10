import { N } from '../i18n'
import { parallelR, seriesR, type CNode, type Circuit, type Element, type Solution } from './circuit'

export type ParamKey = 'V' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5'
export type Params = Record<ParamKey, number>
export const DEFAULTS: Params = { V: 12, R1: 100, R2: 200, R3: 300, R4: 400, R5: 500 }

export interface ParamSpec { key: ParamKey; min: number; max: number; step: number; unit: 'V' | 'Ω' }
export interface Readout { label: string; value: number; unit: 'V' | 'A' | 'Ω' | 'W' | ''; formula?: string }
export interface Question { text: string; args: (string | number)[]; answer: number; unit: string }
export interface Lesson {
  id: string
  title: string
  intro: string[]
  params: ParamKey[]
  build: (p: Params) => Circuit
  readouts: (p: Params, s: Solution) => Readout[]
  quiz: (rnd: () => number) => Question[]
}

const nd = (id: string, x: number, y: number): CNode => ({ id, x, y })
const R = (id: string, a: string, b: string, value: number): Element => ({ id, kind: 'R', a, b, value })
const W = (id: string, a: string, b: string): Element => ({ id, kind: 'W', a, b, value: 0 })
const VS = (a: string, b: string, value: number): Element => ({ id: 'V', kind: 'V', a, b, value })

const f = (x: number) => String(Number(x.toPrecision(4)))
const pick = <T,>(rnd: () => number, a: T[]): T => a[Math.floor(rnd() * a.length)]
const RS = [100, 120, 150, 200, 220, 300, 330, 400, 470, 500, 600, 1000]

function loop(p: Params): Circuit {
  return {
    ground: 'D', probes: {},
    nodes: [nd('A', 110, 60), nd('B', 510, 60), nd('C', 510, 290), nd('D', 110, 290)],
    elements: [VS('A', 'D', p.V), W('W1', 'A', 'B'), R('R1', 'B', 'C', p.R1), W('W2', 'C', 'D')],
  }
}
function series(p: Params): Circuit {
  return {
    ground: 'F',
    nodes: [nd('A', 110, 60), nd('B', 310, 60), nd('C', 510, 60), nd('D', 510, 290), nd('E', 310, 290), nd('F', 110, 290)],
    elements: [VS('A', 'F', p.V), R('R1', 'A', 'B', p.R1), R('R2', 'B', 'C', p.R2), R('R3', 'C', 'D', p.R3), W('W1', 'D', 'E'), W('W2', 'E', 'F')],
  }
}
function parallel(p: Params, n: number): Circuit {
  const xs = n === 3 ? [270, 390, 510] : [330, 510]
  const nodes = [nd('A', 110, 60), nd('G', 110, 290)]
  const elements: Element[] = [VS('A', 'G', p.V)]
  xs.forEach((x, i) => {
    nodes.push(nd(`T${i}`, x, 60), nd(`B${i}`, x, 290))
    elements.push(W(`WT${i}`, i ? `T${i - 1}` : 'A', `T${i}`), W(`WB${i}`, i ? `B${i - 1}` : 'G', `B${i}`))
    elements.push(R(`R${i + 1}`, `T${i}`, `B${i}`, p[`R${i + 1}` as ParamKey]))
  })
  return { ground: 'G', nodes, elements }
}
function divider(p: Params): Circuit {
  return {
    ground: 'G', probes: { B: 'Vout' },
    nodes: [nd('A', 110, 60), nd('B', 510, 60), nd('C', 510, 290), nd('G', 110, 290)],
    elements: [VS('A', 'G', p.V), R('R1', 'A', 'B', p.R1), R('R2', 'B', 'C', p.R2), W('W1', 'C', 'G')],
  }
}
function seriesParallel(p: Params, probe: boolean): Circuit {
  return {
    ground: 'F', probes: probe ? { B: 'node', C: 'node' } : {},
    nodes: [nd('A', 110, 60), nd('B', 310, 60), nd('C', 510, 60), nd('D', 510, 290), nd('E', 310, 290), nd('F', 110, 290)],
    elements: [VS('A', 'F', p.V), R('R1', 'A', 'B', p.R1), W('W0', 'B', 'C'), R('R2', 'B', 'E', p.R2), R('R3', 'C', 'D', p.R3), W('W1', 'D', 'E'), W('W2', 'E', 'F')],
  }
}
function bridge(p: Params): Circuit {
  return {
    ground: 'B', probes: { T: 'T', L: 'L', Rt: 'R' },
    nodes: [nd('A', 110, 50), nd('G', 110, 300), nd('T', 330, 50), nd('B', 330, 300), nd('L', 210, 175), nd('Rt', 450, 175)],
    elements: [VS('A', 'G', p.V), W('W1', 'A', 'T'), W('W2', 'G', 'B'), R('R1', 'T', 'L', p.R1), R('R2', 'T', 'Rt', p.R2), R('R3', 'L', 'B', p.R3), R('R4', 'Rt', 'B', p.R4), R('R5', 'L', 'Rt', p.R5)],
  }
}

const q = (text: string, args: (string | number)[], answer: number, unit: string): Question => ({ text, args, answer, unit })
const abs = (x: number) => Math.abs(x)

export const LESSONS: Lesson[] = [
  {
    id: 'ohm', title: N("Ohm's law"),
    intro: [
      N("Voltage V pushes charge round the loop; resistance R opposes it. Ohm's law ties them together: I = V / R."),
      N('Drag the sliders: doubling the voltage doubles the current, doubling the resistance halves it. The moving dots show the direction (conventional current, from + round to -) and relative size of the current.'),
    ],
    params: ['V', 'R1'], build: loop,
    readouts: (p, s) => [
      { label: N('Current'), value: abs(s.current.R1), unit: 'A', formula: `I = V / R = ${f(p.V)} / ${f(p.R1)}` },
      { label: N('Power in the resistor'), value: abs(s.current.R1 * s.drop.R1), unit: 'W', formula: 'P = V · I' },
    ],
    quiz: (r) => {
      const v = pick(r, [3, 5, 9, 12, 24]), r1 = pick(r, RS), i = pick(r, [10, 20, 25, 40, 50]), r2 = pick(r, RS), i3 = pick(r, [5, 10, 20, 50]), r3 = pick(r, RS)
      return [
        q(N('A {0} V source is connected to a {1} Ω resistor. What current flows?'), [v, r1], (v / r1) * 1000, 'mA'),
        q(N('A resistor carries {0} mA when {1} V is across it. What is its resistance?'), [i, f((i * r2) / 1000)], r2, 'Ω'),
        q(N('What voltage is needed to push {0} mA through {1} Ω?'), [i3, r3], (i3 * r3) / 1000, 'V'),
      ]
    },
  },
  {
    id: 'series', title: N('Resistors in series'),
    intro: [
      N('In series the same current flows through every resistor, so the resistances add: R = R1 + R2 + R3.'),
      N('The source voltage is shared out between the resistors in proportion to their resistance.'),
    ],
    params: ['V', 'R1', 'R2', 'R3'], build: series,
    readouts: (p, s) => [
      { label: N('Total resistance'), value: seriesR(p.R1, p.R2, p.R3), unit: 'Ω', formula: `R = ${f(p.R1)} + ${f(p.R2)} + ${f(p.R3)}` },
      { label: N('Current (same everywhere)'), value: abs(s.current.R1), unit: 'A', formula: 'I = V / R' },
      { label: N('Drop across R1'), value: abs(s.drop.R1), unit: 'V' },
      { label: N('Drop across R2'), value: abs(s.drop.R2), unit: 'V' },
      { label: N('Drop across R3'), value: abs(s.drop.R3), unit: 'V' },
    ],
    quiz: (r) => {
      const a = pick(r, RS), b = pick(r, RS), c = pick(r, RS), v = pick(r, [5, 9, 12, 24])
      return [
        q(N('Resistors of {0} Ω, {1} Ω and {2} Ω are connected in series. What is the total resistance?'), [a, b, c], a + b + c, 'Ω'),
        q(N('{0} V is applied across {1} Ω and {2} Ω in series. What current flows?'), [v, a, b], (v / (a + b)) * 1000, 'mA'),
        q(N('A {0} V supply feeds {1} Ω (R1) in series with {2} Ω (R2). What is the voltage across R2?'), [v, a, b], (v * b) / (a + b), 'V'),
      ]
    },
  },
  {
    id: 'parallel', title: N('Resistors in parallel'),
    intro: [
      N('In parallel every resistor has the same voltage across it, and the currents add: 1/R = 1/R1 + 1/R2 + 1/R3.'),
      N('Adding another branch always lowers the total resistance, because the charge has one more path to take.'),
    ],
    params: ['V', 'R1', 'R2', 'R3'], build: (p) => parallel(p, 3),
    readouts: (p, s) => [
      { label: N('Equivalent resistance'), value: parallelR(p.R1, p.R2, p.R3), unit: 'Ω', formula: '1/R = 1/R1 + 1/R2 + 1/R3' },
      { label: N('Total current'), value: abs(s.current.V), unit: 'A', formula: 'I = V / R' },
      { label: N('Current in R1'), value: abs(s.current.R1), unit: 'A' },
      { label: N('Current in R2'), value: abs(s.current.R2), unit: 'A' },
      { label: N('Current in R3'), value: abs(s.current.R3), unit: 'A' },
    ],
    quiz: (r) => {
      const pairs = [[100, 100], [100, 300], [200, 200], [300, 600], [600, 300], [120, 120]]
      const [a, b] = pick(r, pairs), e = pick(r, [90, 120, 300, 600]), v = pick(r, [5, 9, 12]), c = pick(r, [200, 400, 600]), d = pick(r, [300, 600, 1200])
      return [
        q(N('Two resistors of {0} Ω and {1} Ω are in parallel. What is the equivalent resistance?'), [a, b], (a * b) / (a + b), 'Ω'),
        q(N('Three equal {0} Ω resistors are in parallel. What is the equivalent resistance?'), [e], e / 3, 'Ω'),
        q(N('{0} V is across {1} Ω in parallel with {2} Ω. What total current does the source supply?'), [v, c, d], (v / c + v / d) * 1000, 'mA'),
      ]
    },
  },
  {
    id: 'divider', title: N('Voltage divider'),
    intro: [
      N('Two resistors in series split the supply: Vout = V · R2 / (R1 + R2), measured across R2.'),
      N('This is the basis of potentiometers and sensor circuits. Make R2 bigger and Vout rises towards V.'),
    ],
    params: ['V', 'R1', 'R2'], build: divider,
    readouts: (p, s) => [
      { label: N('Output voltage'), value: s.voltage.B, unit: 'V', formula: `Vout = ${f(p.V)} · ${f(p.R2)} / (${f(p.R1)} + ${f(p.R2)})` },
      { label: N('Ratio Vout / V'), value: s.voltage.B / p.V, unit: '', formula: 'R2 / (R1 + R2)' },
      { label: N('Current'), value: abs(s.current.R1), unit: 'A' },
    ],
    quiz: (r) => {
      const v = pick(r, [5, 9, 12, 24]), a = pick(r, RS), b = pick(r, RS), c = pick(r, RS)
      return [
        q(N('A divider has Vin = {0} V, R1 = {1} Ω and R2 = {2} Ω. What is Vout across R2?'), [v, a, b], (v * b) / (a + b), 'V'),
        q(N('Two equal resistors divide a {0} V supply. What is Vout?'), [v], v / 2, 'V'),
        q(N('A divider with R1 = {1} Ω and R2 = {2} Ω is fed by {0} V. What current does it draw?'), [v, a, c], (v / (a + c)) * 1000, 'mA'),
      ]
    },
  },
  {
    id: 'cdivider', title: N('Current divider'),
    intro: [
      N('Two parallel branches share a total current in inverse proportion to their resistance: I1 = I · R2 / (R1 + R2).'),
      N('The smaller resistor takes the larger share of the current.'),
    ],
    params: ['V', 'R1', 'R2'], build: (p) => parallel(p, 2),
    readouts: (p, s) => {
      const it = abs(s.current.V)
      return [
        { label: N('Total current'), value: it, unit: 'A' },
        { label: N('Current in R1'), value: abs(s.current.R1), unit: 'A', formula: `I1 = I · R2 / (R1 + R2) = ${f(it * 1000)} mA · ${f(p.R2)} / ${f(p.R1 + p.R2)}` },
        { label: N('Current in R2'), value: abs(s.current.R2), unit: 'A', formula: 'I2 = I · R1 / (R1 + R2)' },
      ]
    },
    quiz: (r) => {
      const i = pick(r, [10, 20, 30, 60, 100]), a = pick(r, [100, 200, 300]), b = pick(r, [100, 200, 600]), v = pick(r, [5, 9, 12])
      return [
        q(N('A total current of {0} mA splits between {1} Ω and {2} Ω in parallel. What current flows in the {1} Ω resistor?'), [i, a, b], (i * b) / (a + b), 'mA'),
        q(N('A total current of {0} mA splits between two equal resistors. What current is in each?'), [i], i / 2, 'mA'),
        q(N('A {0} V source feeds {1} Ω in parallel with {2} Ω. What current flows in the {2} Ω branch?'), [v, a, b], (v / b) * 1000, 'mA'),
      ]
    },
  },
  {
    id: 'kvl', title: N("Kirchhoff's voltage law"),
    intro: [
      N('KVL: going once round any closed loop, the voltage rises and drops add up to zero.'),
      N('Here the source rises by V, then we drop across R1 and R2 (loop 1) or across R1 and R3 (loop 2). Check the sums below.'),
    ],
    params: ['V', 'R1', 'R2', 'R3'], build: (p) => seriesParallel(p, false),
    readouts: (p, s) => [
      { label: N('Loop 1: V - V(R1) - V(R2)'), value: p.V - s.drop.R1 - s.drop.R2, unit: 'V', formula: `${f(p.V)} - ${f(s.drop.R1)} - ${f(s.drop.R2)}` },
      { label: N('Loop 2: V - V(R1) - V(R3)'), value: p.V - s.drop.R1 - s.drop.R3, unit: 'V', formula: `${f(p.V)} - ${f(s.drop.R1)} - ${f(s.drop.R3)}` },
      { label: N('Drop across R1'), value: s.drop.R1, unit: 'V' },
      { label: N('Drop across R2 (= R3)'), value: s.drop.R2, unit: 'V' },
    ],
    quiz: (r) => {
      const v = pick(r, [9, 12, 24]), x = pick(r, [2, 3, 4, 5]), y = pick(r, [1, 2, 3]), a = pick(r, RS), b = pick(r, RS)
      return [
        q(N('A {0} V source drives two resistors in a loop. One drops {1} V. What does the other drop?'), [v, x], v - x, 'V'),
        q(N('In a {0} V series loop the drops across R1 and R2 are {1} V and {2} V. What is the drop across R3?'), [v, x, y], v - x - y, 'V'),
        q(N('R1 = {1} Ω and R2 = {2} Ω are in series with {0} V. What is the drop across R1?'), [v, a, b], (v * a) / (a + b), 'V'),
      ]
    },
  },
  {
    id: 'kcl', title: N("Kirchhoff's current law"),
    intro: [
      N('KCL: the currents into a node equal the currents out of it. Charge does not pile up.'),
      N('At the highlighted junction the current through R1 splits into the R2 and R3 branches.'),
    ],
    params: ['V', 'R1', 'R2', 'R3'], build: (p) => seriesParallel(p, true),
    readouts: (_p, s) => {
      const i1 = abs(s.current.R1), i2 = abs(s.current.R2), i3 = abs(s.current.R3)
      return [
        { label: N('Current in (R1)'), value: i1, unit: 'A' },
        { label: N('Current out (R2)'), value: i2, unit: 'A' },
        { label: N('Current out (R3)'), value: i3, unit: 'A' },
        { label: N('In - out'), value: i1 - i2 - i3, unit: 'A', formula: 'I1 - I2 - I3' },
      ]
    },
    quiz: (r) => {
      const a = pick(r, [10, 20, 30]), b = pick(r, [5, 15, 25]), c = pick(r, [5, 10]), d = pick(r, [40, 60, 90]), e = pick(r, [10, 20]), a1 = pick(r, [100, 200]), b1 = pick(r, [100, 300])
      return [
        q(N('Currents of {0} mA and {1} mA flow into a node. {2} mA leaves along one wire. What leaves along the other?'), [a, b, c], a + b - c, 'mA'),
        q(N('A current of {0} mA enters a node and leaves through three wires: {1} mA, {2} mA and one more. How much is the third?'), [d, e, a], d - e - a, 'mA'),
        q(N('A 12 V source feeds {0} Ω and {1} Ω in parallel. By KCL, what total current does the source supply?'), [a1, b1], (12 / a1 + 12 / b1) * 1000, 'mA'),
      ]
    },
  },
  {
    id: 'nodal', title: N('Nodal analysis'),
    intro: [
      N('Pick a reference (ground) node, then write KCL at every other node with currents expressed as (Va - Vb) / R. Solving the linear equations gives every node voltage.'),
      N('This bridge has three unknown nodes, T, L and R (the bottom node is ground). It is solved here with the same method. When R1/R3 = R2/R4 the bridge is balanced and no current flows through R5.'),
    ],
    params: ['V', 'R1', 'R2', 'R3', 'R4', 'R5'], build: bridge,
    readouts: (p, s) => [
      { label: N('Voltage at T'), value: s.voltage.T, unit: 'V' },
      { label: N('Voltage at L'), value: s.voltage.L, unit: 'V', formula: `(${f(p.V)} - VL)/R1 = VL/R3 + (VL - VR)/R5` },
      { label: N('Voltage at R'), value: s.voltage.Rt, unit: 'V', formula: '(V - VR)/R2 + (VL - VR)/R5 = VR/R4' },
      { label: N('Current in R5'), value: s.current.R5, unit: 'A', formula: 'I5 = (VL - VR) / R5' },
      { label: N('Source current'), value: abs(s.current.V), unit: 'A' },
    ],
    quiz: (r) => {
      const a = pick(r, [100, 200]), b = pick(r, [200, 300, 400]), c = pick(r, [300, 600]), v = pick(r, [6, 12, 24]), x = pick(r, [100, 200, 300]), y = pick(r, [100, 200, 600])
      return [
        q(N('A Wheatstone bridge has R1 = {0} Ω, R2 = {1} Ω and R3 = {2} Ω (R1 over R3 on the left, R2 over R4 on the right). What R4 balances it?'), [a, b, c], (b * c) / a, 'Ω'),
        q(N('Node X is joined to a {0} V source through {1} Ω and to ground through {2} Ω, with nothing else attached. What is the voltage at X?'), [v, x, y], (v * y) / (x + y), 'V'),
        q(N('In a balanced bridge, what current flows through the middle resistor R5?'), [], 0, 'mA'),
      ]
    },
  },
]
