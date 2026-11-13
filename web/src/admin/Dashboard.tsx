import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { arpc, short, TYPE_LABEL, useQuery, won } from './api'

interface Dash {
  kpi: { gmv: number; fee: number; count: number; pg_cost: number; mileage: number; avg: number; users: number }
  prev: { gmv: number; fee: number; cnt: number }
  daily: { d: string; gmv: number; fee: number; count: number }[]
  by_type: { type: string; gmv: number; cnt: number }[]
  by_method: { method: 'INSTANT' | 'SCHEDULED'; gmv: number; cnt: number }[]
  by_amount: { label: string; cnt: number; gmv: number }[]
  status: Record<string, number>
  queue: { review: number; waiting_send: number; failed: number; inquiries: number; reviews: number }
  cashflow: { d: string; payout: number; settle: number }[]
  reviews: { avg: number | null; count: number; dist: Record<string, number> }
  settings: { pg_settlement_days: number; pg_fee_bps: number }
}

// 차트 색: 들어올 돈(카드대금 정산) = 파랑, 나갈 돈(거래처 지급) = 초록. dataviz 검증 통과(CVD ΔE 24.9)
const C_IN = '#2563EB'
const C_OUT = '#059669'
const GRID = '#E4E7EB'
const AXIS = { fontSize: 12, fill: '#64748B' }

const kst = (offset = 0) => {
  const d = new Date(Date.now() + 9 * 3600e3 + offset * 86400e3)
  return d.toISOString().slice(0, 10)
}
const md = (iso: string) => `${Number(iso.slice(5, 7))}.${Number(iso.slice(8, 10))}`

function Change({ now, prev, unit = '' }: { now: number; prev: number; unit?: string }) {
  if (!prev) return <span className="muted">이전 기간 기록 없음</span>
  const p = ((now - prev) / prev) * 100
  return <span className={p >= 0 ? 'paid' : 'danger'}>{p >= 0 ? '+' : ''}{p.toFixed(1)}%{unit} <span className="muted">지난 기간 대비</span></span>
}

function Tip({ active, payload, label, rows }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string; rows: Record<string, { name: string; color: string }> }) {
  if (!active || !payload?.length) return null
  return (
    <div className="adm-tip">
      <div className="t">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="r"><i style={{ background: rows[p.dataKey]?.color }} />{rows[p.dataKey]?.name}<b>{won(p.value)}</b></div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [days, setDays] = useState(30)
  const { data, error, loading } = useQuery(() => arpc<Dash>('admin_dashboard', { p_from: kst(-(days - 1)), p_to: kst(0) }), [days])

  if (error) return <div className="adm-page"><p className="hint error">{error}</p></div>
  const k = data?.kpi
  const profit = k ? k.fee - k.pg_cost - k.mileage : 0
  const methodTotal = (data?.by_method ?? []).reduce((a, m) => a + m.gmv, 0) || 1
  const typeMax = Math.max(1, ...(data?.by_type ?? []).map((t) => t.gmv))
  const amountMax = Math.max(1, ...(data?.by_amount ?? []).map((t) => t.cnt))
  const cashIn = (data?.cashflow ?? []).reduce((a, c) => a + c.settle, 0)
  const cashOut = (data?.cashflow ?? []).reduce((a, c) => a + c.payout, 0)

  return (
    <div className="adm-page">
      <header className="adm-head">
        <div><h1>대시보드</h1><p className="sub">결제가 접수된 날짜 기준 · 취소 건 제외</p></div>
        <div className="seg-sm" role="group" aria-label="기간">
          {[7, 30, 90].map((d) => <button key={d} aria-pressed={days === d} onClick={() => setDays(d)}>{d}일</button>)}
        </div>
      </header>

      {data && (
        <div className="adm-queue">
          <Link to="/admin/contracts?status=REVIEW"><b>{data.queue.review}</b>심사 대기 계약</Link>
          <Link to="/admin/transfers?status=WAITING_SEND"><b>{data.queue.waiting_send}</b>송금 대기</Link>
          <Link to="/admin/transfers?status=FAILED" className={data.queue.failed ? 'warn' : ''}><b>{data.queue.failed}</b>송금 실패</Link>
          <Link to="/admin/inquiries"><b>{data.queue.inquiries}</b>답변 대기 문의</Link>
          <Link to="/admin/reviews"><b>{data.queue.reviews}</b>검토 대기 후기</Link>
        </div>
      )}

      <section className="adm-kpis">
        <div className="adm-stat"><span>결제액</span><strong className="num">{k ? won(k.gmv) : '-'}</strong>{k && <Change now={k.gmv} prev={data!.prev.gmv} />}</div>
        <div className="adm-stat"><span>이용료 매출</span><strong className="num">{k ? won(k.fee) : '-'}</strong>{k && <Change now={k.fee} prev={data!.prev.fee} />}</div>
        <div className="adm-stat"><span>추정 순이익</span><strong className="num">{k ? won(profit) : '-'}</strong><span className="muted">이용료 − PG 수수료({((data?.settings.pg_fee_bps ?? 0) / 100).toFixed(1)}%) − 마일리지</span></div>
        <div className="adm-stat"><span>결제 건수</span><strong className="num">{k ? `${k.count.toLocaleString('ko-KR')}건` : '-'}</strong>{k && <span className="muted">평균 {won(k.avg)} · 사장님 {k.users}명</span>}</div>
      </section>

      <section className="adm-card adm-main-chart">
        <div className="adm-card-head"><h2>일별 결제액</h2><span className="muted">{loading ? '불러오는 중' : `최근 ${days}일`}</span></div>
        <div style={{ height: 300 }}>
          <ResponsiveContainer>
            <AreaChart data={data?.daily ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C_IN} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={C_IN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="d" tickFormatter={md} tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tickFormatter={short} tick={AXIS} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<Tip rows={{ gmv: { name: '결제액', color: C_IN } }} />} cursor={{ stroke: '#94A3B8', strokeDasharray: '3 3' }} />
              <Area type="monotone" dataKey="gmv" stroke={C_IN} strokeWidth={2} fill="url(#gmvFill)" activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="adm-grid2">
        <section className="adm-card">
          <div className="adm-card-head"><h2>앞으로 14일 자금 흐름</h2></div>
          <p className="sub" style={{ margin: '0 0 12px', fontSize: 13 }}>
            카드대금 정산 예정 <b className="num" style={{ color: 'var(--ink)' }}>{won(cashIn)}</b> · 예약송금 지급 예정 <b className="num" style={{ color: 'var(--ink)' }}>{won(cashOut)}</b>
          </p>
          <div className="adm-legend"><span><i style={{ background: C_IN }} />정산 예정(들어올 돈)</span><span><i style={{ background: C_OUT }} />지급 예정(나갈 돈)</span></div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={data?.cashflow ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="d" tickFormatter={md} tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={short} tick={AXIS} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<Tip rows={{ settle: { name: '정산 예정', color: C_IN }, payout: { name: '지급 예정', color: C_OUT } }} />} cursor={{ fill: 'rgba(15,23,42,0.04)' }} />
                <Bar dataKey="settle" fill={C_IN} radius={[4, 4, 0, 0]} maxBarSize={14} />
                <Bar dataKey="payout" fill={C_OUT} radius={[4, 4, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="hint" style={{ margin: '8px 0 0' }}>정산 예정은 결제일 + {data?.settings.pg_settlement_days ?? 3}일 기준 단순 추정이에요. 실제 정산일은 PG 계약 후 정산 내역으로 바꿔요.</p>
        </section>

        <section className="adm-card">
          <div className="adm-card-head"><h2>계약 유형별 결제액</h2></div>
          <ul className="adm-bars">
            {(data?.by_type ?? []).map((t) => (
              <li key={t.type}>
                <span className="l">{TYPE_LABEL[t.type] ?? t.type}</span>
                <span className="b"><i style={{ width: `${(t.gmv / typeMax) * 100}%` }} /></span>
                <span className="v num">{short(t.gmv)}<small>{t.cnt}건</small></span>
              </li>
            ))}
          </ul>
          <h3 className="adm-sub">송금 방식</h3>
          <div className="adm-stack" role="img" aria-label="송금 방식 비율">
            {(data?.by_method ?? []).map((m) => (
              <i key={m.method} style={{ width: `${(m.gmv / methodTotal) * 100}%`, background: m.method === 'INSTANT' ? C_IN : C_OUT }} />
            ))}
          </div>
          <div className="adm-legend" style={{ marginTop: 8 }}>
            {(data?.by_method ?? []).map((m) => (
              <span key={m.method}><i style={{ background: m.method === 'INSTANT' ? C_IN : C_OUT }} />{m.method === 'INSTANT' ? '바로송금' : '예약송금'} {Math.round((m.gmv / methodTotal) * 100)}% · {m.cnt}건</span>
            ))}
          </div>
        </section>
      </div>

      <div className="adm-grid2">
        <section className="adm-card">
          <div className="adm-card-head"><h2>금액대별 건수</h2></div>
          <ul className="adm-bars">
            {(data?.by_amount ?? []).map((a) => (
              <li key={a.label}>
                <span className="l">{a.label}</span>
                <span className="b"><i style={{ width: `${(a.cnt / amountMax) * 100}%`, background: '#94A3B8' }} /></span>
                <span className="v num">{a.cnt}건<small>{short(a.gmv)}</small></span>
              </li>
            ))}
          </ul>
        </section>
        <section className="adm-card">
          <div className="adm-card-head"><h2>후기</h2><Link className="link" to="/admin/reviews" style={{ fontSize: 13 }}>전체 보기</Link></div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            <strong className="num" style={{ fontSize: 30, fontWeight: 600 }}>{data?.reviews.avg?.toFixed(1) ?? '-'}</strong>
            <span className="muted">/ 5 · {data?.reviews.count ?? 0}개</span>
          </div>
          <ul className="adm-bars">
            {[5, 4, 3, 2, 1].map((r) => {
              const n = data?.reviews.dist?.[r] ?? 0
              const total = data?.reviews.count || 1
              return (
                <li key={r}>
                  <span className="l">{r}점</span>
                  <span className="b"><i style={{ width: `${(n / total) * 100}%`, background: '#F59E0B' }} /></span>
                  <span className="v num">{n}</span>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
