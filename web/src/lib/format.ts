const nf = new Intl.NumberFormat('ko-KR')

export const won = (v: number) => `${nf.format(v)}원`
export const num = (v: number) => nf.format(v)
export const mileage = (v: number) => `${nf.format(v)}M`

const pad = (n: number) => String(n).padStart(2, '0')

/** 한국 시간 기준 날짜/시간 */
function seoulParts(ms: number) {
  const d = new Date(ms + 9 * 3600 * 1000)
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() }
}
export const date = (ms: number) => {
  const p = seoulParts(ms)
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`
}
export const dateTime = (ms: number) => {
  const p = seoulParts(ms)
  return `${p.y}-${pad(p.m)}-${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`
}
export const today = () => date(Date.now())
export const addDays = (isoDate: string, days: number) => {
  const t = Date.parse(`${isoDate}T00:00:00Z`) + days * 86400000
  const d = new Date(t)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export const phone = (p: string) => {
  const d = p.replace(/\D/g, '')
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  return p
}

export const digits = (s: string, max: number) => s.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, max)
