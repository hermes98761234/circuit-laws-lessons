const PREFIX: [string, number][] = [['G', 1e9], ['M', 1e6], ['k', 1e3], ['', 1], ['m', 1e-3], ['µ', 1e-6], ['n', 1e-9]]

/** Formats a value with an SI prefix, e.g. si(0.012, 'A') → "12 mA". */
export function si(x: number, unit: string, digits = 3): string {
  if (!Number.isFinite(x)) return '—'
  if (Math.abs(x) < 1e-12) return `0 ${unit}`
  const [p, f] = PREFIX.find(([, f]) => Math.abs(x) >= f * 0.9995) ?? PREFIX[PREFIX.length - 1]
  return `${Number((x / f).toPrecision(digits))} ${p}${unit}`
}

/** Parses a decimal typed by the user ("1,5" allowed). */
export function parseNum(s: string): number {
  const v = Number(s.trim().replace(',', '.'))
  return s.trim() === '' ? NaN : v
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
