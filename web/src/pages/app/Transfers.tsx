import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, CircleCheck, Clock, X, Zap } from 'lucide-react'
import { AppPage } from '../../components/Layouts'
import { Confirm, Kv, ListPicker, Spinner, toast } from '../../components/ui'
import {
  CARD_COMPANIES, fee, installmentText, maskAccount, MAX_AMOUNT, Method, METHODS, mileageOf, MIN_AMOUNT, rateText, total, Transfer,
  TRANSFER_STATUS_LABEL, CardCharge,
} from '../../lib/model'
import { cancel, complete, getTransferDraft, pay, setTransferDraft, useStore } from '../../lib/store'
import { addDays, date, dateTime, digits, mileage, num, today, won } from '../../lib/format'

/** 송금하기: 분할결제 여부, 송금액, 바로/예약 송금 */
export function TransferPage() {
  const { contractId } = useParams()
  const s = useStore()
  const navigate = useNavigate()
  const c = s.contracts.find((x) => x.id === contractId)
  const [amountText, setAmountText] = useState('')
  const [memo, setMemo] = useState('')
  const [split, setSplit] = useState(false)
  const [method, setMethod] = useState<Method>('SCHEDULED')
  const [day, setDay] = useState(addDays(today(), 1))
  if (!c) return <AppPage title="송금하기" back="/app"><p className="empty">계약을 찾을 수 없어요</p></AppPage>
  if (c.status !== 'APPROVED') return <Navigate to={`/app/contracts/${c.id}`} replace />

  const amount = Number(amountText || 0)
  const ok = amount >= MIN_AMOUNT && amount <= MAX_AMOUNT
  const preview = ok ? amount : 1_000_000
  const f = fee(amount, method)
  const hint = !amountText ? '1만 원부터 2,000만 원까지 보낼 수 있어요'
    : amount < MIN_AMOUNT ? '1만 원 이상 입력해 주세요'
      : amount > MAX_AMOUNT ? '1회 최대 2,000만 원까지 보낼 수 있어요'
        : `거래처에는 ${won(amount)}이 입금돼요`

  return (
    <AppPage title="송금하기" back narrow>
      <div className="navy-card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 18 }}>{c.title}</div>
        <div className="label" style={{ marginTop: 4 }}>[{c.senderName}] 이름으로 {c.bank} {maskAccount(c.account)}에 입금돼요</div>
      </div>
      <form onSubmit={(e) => {
        e.preventDefault()
        if (!ok) return
        setTransferDraft({ contractId: c.id, amount, method, scheduledDate: method === 'SCHEDULED' ? day : null, memo: memo.trim(), split })
        navigate('/app/pay')
      }}>
        <div className="card">
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>카드 분할결제 사용 여부</h3>
          <label className="check" style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 10 }}>
            <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />하나의 송금 건을 여러 카드로 나눠서 결제
          </label>
          <p className="hint" style={{ margin: '8px 0 0' }}>송금은 한 번에, 카드는 최대 3장까지 나눠 결제할 수 있어요</p>
        </div>
        <div className="card form-stack">
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>송금 내용</h3>
          <label className="field">
            <span>송금액</span>
            <div className="input-wrap">
              <input className="input num" inputMode="numeric" autoFocus value={amountText ? num(amount) : ''} onChange={(e) => setAmountText(digits(e.target.value, 9))} placeholder="송금할 금액" />
              <span className="suffix">원</span>
            </div>
            <span className={`hint${amountText && !ok ? ' error' : ''}`}>{hint}</span>
          </label>
          <label className="field"><span>메모 (선택)</span><input className="input" value={memo} onChange={(e) => setMemo(e.target.value.slice(0, 20))} placeholder="예) 11월 식자재" /></label>
        </div>
        <div className="card">
          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>결제 방식</h3>
          <p className="hint" style={{ margin: '0 0 12px' }}>{won(preview)} 이용 시</p>
          <div className="method-grid">
            {(['INSTANT', 'SCHEDULED'] as Method[]).map((k) => (
              <button type="button" key={k} className="method" aria-pressed={method === k} onClick={() => setMethod(k)}>
                {k === 'SCHEDULED' && <span className="pill pill-info rec">추천</span>}
                <span className="name">{k === 'INSTANT' ? <Zap size={16} /> : <Clock size={16} />}{METHODS[k].label}</span>
                <span className="muted" style={{ fontSize: 13 }}>{METHODS[k].short}</span>
                <span className="total">{won(total(preview, k))}</span>
                <span className="rate">이용료 {rateText(k)}</span>
              </button>
            ))}
          </div>
          <p className="hint" style={{ margin: '10px 0 0' }}>{METHODS[method].description}</p>
          {method === 'SCHEDULED' && (
            <label className="field" style={{ marginTop: 16 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CalendarDays size={16} />입금 날짜</span>
              <input className="input num" type="date" value={day} min={addDays(today(), 1)} max={addDays(today(), 90)} onChange={(e) => setDay(e.target.value)} required />
            </label>
          )}
        </div>
        {ok && (
          <dl className="card" style={{ margin: '12px 0 0' }}>
            <Kv k="거래처 입금액" v={won(amount)} />
            <Kv k={`이용료 ${rateText(method)}`} v={won(f)} />
            <Kv k="적립 예정 마일리지" v={<span className="paid">{mileage(mileageOf(f))}</span>} />
            <Kv k="카드 청구액" v={won(amount + f)} total />
          </dl>
        )}
        <div className="form-foot"><button className="btn btn-primary" disabled={!ok || (method === 'SCHEDULED' && !day)}>{ok ? `${won(amount + f)} 결제하기` : '결제하기'}</button></div>
      </form>
    </AppPage>
  )
}

interface Row { company: string; installment: number; amountText: string }

/** 결제: 카드사·할부 선택 (모의 승인). 실제 서비스에서는 PG 결제창으로 바뀝니다 */
export function PayPage() {
  const navigate = useNavigate()
  const d = getTransferDraft()
  const totalAmount = d ? total(d.amount, d.method) : 0
  const [rows, setRows] = useState<Row[]>([{ company: '', installment: 1, amountText: String(totalAmount) }])
  const [picker, setPicker] = useState<{ i: number; kind: 'company' | 'inst' } | null>(null)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!processing) return
    const t = setTimeout(() => {
      pay(rows.map<CardCharge>((r) => ({ company: r.company, installment: r.installment, amount: Number(r.amountText || 0) })))
        .then((res) => { if (res) navigate(`/app/transfers/${res.id}?paid=1`, { replace: true }) })
        .catch((e: Error) => { toast(e.message); setProcessing(false) })
    }, 1400)
    return () => clearTimeout(t)
  }, [processing, rows, navigate])

  if (!d) return <Navigate to="/app" replace />
  const sum = rows.reduce((a, r) => a + Number(r.amountText || 0), 0)
  const ok = rows.every((r) => r.company && Number(r.amountText) >= 1000) && sum === totalAmount
  const diff = totalAmount - sum
  const upd = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <AppPage title="결제" back narrow>
      <div className="card">
        <span className="sub" style={{ fontSize: 13 }}>결제할 금액</span>
        <div className="num" style={{ fontSize: 30, fontWeight: 600 }}>{won(totalAmount)}</div>
        <span className="hint">입금액 {won(d.amount)} + 이용료 {won(totalAmount - d.amount)} · {METHODS[d.method].label}{d.scheduledDate ? ` (${d.scheduledDate})` : ''}</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="card form-stack" style={{ gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong style={{ fontWeight: 600 }}>{d.split ? `카드 ${i + 1}` : '결제 카드'}</strong>
            {d.split && rows.length > 1 && <button className="btn btn-ghost btn-sm" aria-label="카드 빼기" onClick={() => setRows(rows.filter((_, j) => j !== i))}><X size={16} /></button>}
          </div>
          <button className="input" style={{ textAlign: 'left', color: r.company ? undefined : 'var(--muted)' }} onClick={() => setPicker({ i, kind: 'company' })}>{r.company || '카드사 선택'}</button>
          <button className="input" style={{ textAlign: 'left' }} onClick={() => setPicker({ i, kind: 'inst' })}>{r.installment <= 1 ? '일시불' : `${r.installment}개월 할부`}</button>
          {d.split && (
            <div className="input-wrap">
              <input className="input num" inputMode="numeric" aria-label={`카드 ${i + 1} 결제 금액`} value={r.amountText ? num(Number(r.amountText)) : ''} onChange={(e) => upd(i, { amountText: digits(e.target.value, 9) })} placeholder="이 카드로 결제할 금액" />
              <span className="suffix">원</span>
            </div>
          )}
        </div>
      ))}
      {d.split && (
        <>
          {rows.length < 3 && <button className="drop" style={{ width: '100%', marginTop: 12 }} onClick={() => setRows([...rows, { company: '', installment: 1, amountText: String(Math.max(diff, 0)) }])}>+ 카드 추가</button>}
          <p className={`hint${diff === 0 ? ' paid' : ' error'}`} style={{ marginTop: 10 }}>
            {diff === 0 ? '카드별 금액 합계가 결제 금액과 같아요' : diff > 0 ? `${won(diff)}이 더 필요해요` : `${won(-diff)}이 초과됐어요`}
          </p>
        </>
      )}
      <p className="hint" style={{ marginTop: 12 }}>체험판에서는 카드번호 입력 없이 모의 승인돼요. 실제 서비스에서는 제휴 PG사 결제창이 열리고, 본인 명의 카드만 쓸 수 있어요</p>
      <div className="form-foot"><button className="btn btn-primary" disabled={!ok || processing} onClick={() => setProcessing(true)}>{won(totalAmount)} 결제하기</button></div>

      {picker?.kind === 'company' && <ListPicker title="카드사 선택" options={CARD_COMPANIES} onClose={() => setPicker(null)} onPick={(v) => { upd(picker.i, { company: v }); setPicker(null) }} />}
      {picker?.kind === 'inst' && (
        <ListPicker title="할부 개월" options={['일시불', ...Array.from({ length: 11 }, (_, k) => `${k + 2}개월`)]} onClose={() => setPicker(null)}
          onPick={(v) => { upd(picker.i, { installment: v === '일시불' ? 1 : parseInt(v, 10) }); setPicker(null) }} />
      )}
      {processing && <Spinner label="카드 결제 승인 중이에요" />}
    </AppPage>
  )
}

function StatusHead({ t }: { t: Transfer }) {
  const map = {
    WAITING_SEND: { cls: 'wait', icon: <CircleCheck size={30} />, title: '카드 결제가 완료됐어요', sub: "아래 '송금하기'를 누르면 바로 입금돼요" },
    SCHEDULED: { cls: 'wait', icon: <Clock size={30} />, title: '예약 완료', sub: `${t.scheduledDate}에 거래처 계좌로 입금돼요` },
    COMPLETED: { cls: '', icon: <CircleCheck size={30} />, title: '송금 완료', sub: `${t.payeeName}에 ${won(t.amount)}을 보냈어요` },
    CANCELED: { cls: 'cancel', icon: <X size={30} />, title: '취소된 송금이에요', sub: '카드 결제가 취소되었어요' },
    FAILED: { cls: 'cancel', icon: <X size={30} />, title: '송금에 실패했어요', sub: '고객센터에서 확인 후 다시 처리해 드릴게요' },
  }[t.status]
  return (
    <div className="result-head">
      <div className={`mark ${map.cls}`}>{map.icon}</div>
      <h2>{map.title}</h2>
      <p>{map.sub}</p>
    </div>
  )
}

/** 결제 직후 화면이자 송금 영수증 */
export function TransferResult() {
  const { id } = useParams()
  const s = useStore()
  const navigate = useNavigate()
  const [sending, setSending] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const t = s.transfers.find((x) => x.id === id)
  useEffect(() => {
    if (!sending || !t) return
    const timer = setTimeout(() => { complete(t.id).catch((e: Error) => toast(e.message)).finally(() => setSending(false)) }, 800)
    return () => clearTimeout(timer)
  }, [sending, t])
  if (!t) return <AppPage title="송금 내역" back="/app/transfers"><p className="empty">송금 내역을 찾을 수 없어요</p></AppPage>

  return (
    <AppPage title={t.status === 'WAITING_SEND' ? '송금하기' : '송금 내역'} back="/app/transfers" narrow>
      <StatusHead t={t} />
      <dl className="receipt-card" style={{ margin: 0 }}>
        <Kv k="송금 금액" v={won(t.amount)} total className="first" />
        <Kv k="송금 일시" v={t.completedAt ? dateTime(t.completedAt) : t.scheduledDate ? `${t.scheduledDate} 예정` : '송금 대기'} />
        <Kv k="받는 분" v={t.payeeName} />
        <Kv k="입금 계좌" v={`${t.bank} ${t.maskedAccount}`} />
        <Kv k="예금주" v={t.holder} />
        <Kv k="송금자명" v={t.senderName} />
        {t.memo && <Kv k="메모" v={t.memo} />}
        <hr className="hr" />
        <Kv k="이용료" v={`${won(t.fee)} (${METHODS[t.method].label} ${rateText(t.method)})`} />
        <Kv k="카드 청구액" v={won(t.amount + t.fee)} />
        {t.cards.map((c, i) => <Kv key={i} k="결제 카드" v={`${c.company} ${installmentText(c.installment)} ${won(c.amount)}`} />)}
        <Kv k="결제 일시" v={dateTime(t.createdAt)} />
        <Kv k={t.status === 'COMPLETED' ? '적립 마일리지' : '적립 예정'} v={<span className="paid">{mileage(t.mileage)}</span>} />
      </dl>
      {t.status === 'WAITING_SEND' && <p className="hint" style={{ textAlign: 'center', marginTop: 12 }}>바로송금은 결제 후 반드시 '송금하기'를 눌러야 송금이 완료돼요</p>}
      <div className="form-foot">
        {t.status === 'WAITING_SEND' && <>
          <button className="btn btn-secondary" disabled={sending} onClick={() => setConfirm(true)}>결제 취소</button>
          <button className="btn btn-primary" disabled={sending} onClick={() => setSending(true)}>{sending ? '송금 중' : '송금하기'}</button>
        </>}
        {t.status === 'SCHEDULED' && <>
          <button className="btn btn-secondary" onClick={() => setConfirm(true)}>예약 취소</button>
          <button className="btn btn-primary" onClick={() => navigate('/app')}>확인</button>
        </>}
        {(t.status === 'COMPLETED' || t.status === 'CANCELED') && <button className="btn btn-primary" onClick={() => navigate('/app')}>확인</button>}
      </div>
      {confirm && (
        <Confirm title={t.status === 'SCHEDULED' ? '예약을 취소할까요' : '결제를 취소할까요'} body={`카드 결제 ${won(t.amount + t.fee)}이 취소되고 송금되지 않아요.`}
          confirmLabel="취소하기" danger onClose={() => setConfirm(false)} onConfirm={() => { cancel(t.id).catch((e: Error) => toast(e.message)) }} />
      )}
      {sending && <Spinner label="거래처 계좌로 송금 중이에요" />}
    </AppPage>
  )
}

export function HistoryPage() {
  const s = useStore()
  const [filter, setFilter] = useState(0)
  const filters = ['전체', '진행 중', '완료', '취소']
  const list = s.transfers.filter((t) => [true, t.status === 'WAITING_SEND' || t.status === 'SCHEDULED', t.status === 'COMPLETED', t.status === 'CANCELED'][filter])
  return (
    <AppPage title="송금 내역">
      <div className="chips" style={{ marginBottom: 16 }}>
        {filters.map((f, i) => <button key={f} className="chip" aria-pressed={filter === i} onClick={() => setFilter(i)}>{f}</button>)}
      </div>
      <div className="card" style={{ padding: '4px 20px' }}>
        {!list.length && <p className="empty">송금 내역이 없어요</p>}
        {list.map((t) => (
          <Link key={t.id} to={`/app/transfers/${t.id}`} className="contract-row">
            <div className="info"><div>{t.payeeName}</div><small>{date(t.createdAt)} · {METHODS[t.method].label}{t.memo ? ` · ${t.memo}` : ''}</small></div>
            <div style={{ textAlign: 'right' }}>
              <div className="num" style={{ fontWeight: 600, color: t.status === 'CANCELED' ? 'var(--muted)' : undefined }}>{won(t.amount)}</div>
              <small style={{ fontSize: 12, color: t.status === 'COMPLETED' ? 'var(--paid)' : t.status === 'CANCELED' ? 'var(--muted)' : 'var(--primary)' }}>{TRANSFER_STATUS_LABEL[t.status]}</small>
            </div>
          </Link>
        ))}
      </div>
    </AppPage>
  )
}
