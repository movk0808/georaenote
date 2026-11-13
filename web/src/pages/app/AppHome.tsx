import { Link } from 'react-router-dom'
import { ChevronRight, CreditCard, Headphones, HelpCircle, Newspaper, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import { AppPage } from '../../components/Layouts'
import { StatusPill, TypeBadge } from '../../components/ui'
import { mileageBalance, useStore } from '../../lib/store'
import { CONTRACT_TYPES, TRANSFER_STATUS_LABEL } from '../../lib/model'
import { date, mileage, won } from '../../lib/format'

export default function AppHome() {
  const s = useStore()
  const inProgress = s.transfers.filter((t) => t.status === 'WAITING_SEND' || t.status === 'SCHEDULED')
  const paidThisMonth = s.transfers
    .filter((t) => t.status === 'COMPLETED' && t.completedAt && date(t.completedAt).slice(0, 7) === date(Date.now()).slice(0, 7))
    .reduce((a, t) => a + t.amount, 0)

  return (
    <AppPage title={`${s.user?.nickname ?? ''}님`}>
      {s.user && !s.user.verified && (
        <Link to="/app/verify?next=/app" className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, borderColor: 'var(--primary)' }}>
          <ShieldCheck size={22} color="var(--primary)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}><strong style={{ fontWeight: 600 }}>본인인증 한 번이면 계약 등록과 결제를 할 수 있어요</strong><div className="sub" style={{ fontSize: 13 }}>인증한 번호로 안드로이드 앱에서도 같은 계정으로 로그인돼요</div></div>
          <ChevronRight size={18} className="muted" />
        </Link>
      )}
      <div className="dash">
        <div style={{ display: 'grid', gap: 20 }}>
          <section className="card" aria-labelledby="contracts-h">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 id="contracts-h" style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>내 계약</h2>
              <span className="muted" style={{ fontSize: 13 }}>승인된 계약으로 송금할 수 있어요</span>
            </div>
            {s.contracts.map((c) => (
              <div key={c.id} className="contract-row">
                <TypeBadge type={c.type} />
                <Link to={`/app/contracts/${c.id}`} className="info">
                  <small>{CONTRACT_TYPES[c.type].label}</small>
                  <div>{c.title}</div>
                </Link>
                {c.status === 'APPROVED'
                  ? <Link className="btn btn-secondary btn-sm" to={`/app/transfer/${c.id}`}>송금</Link>
                  : <StatusPill status={c.status} />}
              </div>
            ))}
            <Link to="/app/contracts/new" className="add-row">
              <span className="type-badge"><Plus size={18} /></span>
              계약을 등록해 주세요
            </Link>
          </section>

          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>최근 송금</h2>
              <Link className="link" style={{ fontSize: 14 }} to="/app/transfers">전체 보기</Link>
            </div>
            {s.transfers.length === 0 && <p className="empty" style={{ padding: '24px 0 8px' }}>아직 송금 내역이 없어요</p>}
            {s.transfers.slice(0, 4).map((t) => (
              <Link key={t.id} to={`/app/transfers/${t.id}`} className="contract-row">
                <div className="info"><div>{t.payeeName}</div><small>{date(t.createdAt)} · {t.method === 'INSTANT' ? '바로송금' : '예약송금'}</small></div>
                <div style={{ textAlign: 'right' }}>
                  <div className="num" style={{ fontWeight: 600 }}>{won(t.amount)}</div>
                  <small className={t.status === 'COMPLETED' ? 'paid' : t.status === 'CANCELED' ? 'muted' : ''} style={{ fontSize: 12, color: t.status === 'WAITING_SEND' || t.status === 'SCHEDULED' ? 'var(--primary)' : undefined }}>{TRANSFER_STATUS_LABEL[t.status]}</small>
                </div>
              </Link>
            ))}
          </section>
        </div>

        <div style={{ display: 'grid', gap: 20 }}>
          <div className="navy-card">
            <div className="label">이번 달 거래처에 보낸 금액</div>
            <div className="num" style={{ fontSize: 28, fontWeight: 600, margin: '4px 0 12px' }}>{won(paidThisMonth)}</div>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#c3d0e2' }}>
              <span>진행 중 {inProgress.length}건</span>
              <span>전체 {s.transfers.length}건</span>
            </div>
          </div>
          <div className="stat-grid">
            <Link to="/app/mileage" className="stat"><span>마일리지</span><strong className="paid">{mileage(mileageBalance(s))}</strong></Link>
            <Link to="/event/1" className="stat"><span>오늘의 퀴즈</span><strong style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles size={16} />10M 받기</strong></Link>
          </div>
          <div className="card menu-list" style={{ padding: '4px 20px' }}>
            <Link to="/installment"><CreditCard size={18} strokeWidth={1.75} />카드 할부 정보<ChevronRight size={16} /></Link>
            <Link to="/support?tab=faq"><HelpCircle size={18} strokeWidth={1.75} />자주 묻는 질문<ChevronRight size={16} /></Link>
            <Link to="/magazine"><Newspaper size={18} strokeWidth={1.75} />거래노트 매거진<ChevronRight size={16} /></Link>
            <Link to="/app/chat"><Headphones size={18} strokeWidth={1.75} />고객센터 채팅<ChevronRight size={16} /></Link>
          </div>
        </div>
      </div>
    </AppPage>
  )
}
