import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Phone, Send } from 'lucide-react'
import { AppPage } from '../../components/Layouts'
import { Confirm } from '../../components/ui'
import { logout, mileageBalance, setNotifications, useStore, withdraw } from '../../lib/store'
import { dateTime, mileage, phone } from '../../lib/format'
import { FAQS, SITE } from '../../data/content'

export function MileagePage() {
  const s = useStore()
  return (
    <AppPage title="마일리지" narrow>
      <div className="navy-card">
        <div className="label">내 마일리지</div>
        <div className="num" style={{ fontSize: 32, fontWeight: 600, margin: '4px 0 8px' }}>{mileage(mileageBalance(s))}</div>
        <div className="label">송금이 완료되면 이용료의 2%가 적립돼요</div>
      </div>
      <Link to="/event/1" className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <div><strong style={{ fontWeight: 600 }}>오늘의 퀴즈로 10M 더 받기</strong><div className="sub" style={{ fontSize: 13 }}>하루 한 문제, 맞히면 바로 적립돼요</div></div>
        <ChevronRight size={18} className="muted" />
      </Link>
      <div className="card">
        <strong style={{ fontWeight: 600 }}>마일리지 샵</strong>
        <div className="sub" style={{ fontSize: 13 }}>쿠폰 교환은 준비 중이에요. 열리면 공지로 알려드릴게요</div>
      </div>
      <h3 style={{ margin: '28px 0 8px', fontSize: 15, fontWeight: 600 }}>적립 내역</h3>
      <div className="card" style={{ padding: '4px 20px' }}>
        {!s.mileageLogs.length && <p className="empty">아직 적립 내역이 없어요</p>}
        {s.mileageLogs.map((m, i) => (
          <div key={i} className="contract-row">
            <div className="info"><div style={{ fontWeight: 500 }}>{m.title}</div><small>{dateTime(m.at)}</small></div>
            <strong className="paid num" style={{ fontWeight: 600 }}>+{mileage(m.amount)}</strong>
          </div>
        ))}
      </div>
    </AppPage>
  )
}

export function SettingsPage() {
  const s = useStore()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<'logout' | 'withdraw' | null>(null)
  const u = s.user!
  return (
    <AppPage title="설정" narrow>
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: 18 }}>{u.name} 사장님</div>
        <div className="sub" style={{ fontSize: 14 }}>{phone(u.phone)} · {u.carrier}</div>
      </div>
      <div className="card">
        <label className="check" style={{ justifyContent: 'space-between' }}>
          알림 받기
          <input type="checkbox" checked={s.notificationsOn} onChange={(e) => setNotifications(e.target.checked)} />
        </label>
      </div>
      <div className="card menu-list" style={{ padding: '4px 20px' }}>
        <Link to="/support?tab=notice">공지사항<ChevronRight size={16} /></Link>
        <Link to="/support?tab=faq">자주 묻는 질문<ChevronRight size={16} /></Link>
        <Link to="/terms/service">서비스 이용약관<ChevronRight size={16} /></Link>
        <Link to="/terms/privacy">개인정보 처리 안내<ChevronRight size={16} /></Link>
        <Link to="/install">안드로이드 · 아이폰 설치<ChevronRight size={16} /></Link>
      </div>
      <div className="card" style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" onClick={() => setDialog('logout')}>로그아웃</button>
        <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setDialog('withdraw')}>회원 탈퇴</button>
      </div>
      {dialog === 'logout' && <Confirm title="로그아웃할까요" body="계약과 송금 기록은 이 브라우저에 그대로 남아요." confirmLabel="로그아웃" onClose={() => setDialog(null)} onConfirm={() => { logout(); navigate('/') }} />}
      {dialog === 'withdraw' && <Confirm title="회원 탈퇴할까요" body="이 브라우저에 저장된 계정, 계약, 송금 기록, 마일리지가 모두 지워지고 되돌릴 수 없어요." confirmLabel="탈퇴하기" danger onClose={() => setDialog(null)} onConfirm={() => { withdraw(); navigate('/') }} />}
    </AppPage>
  )
}

interface Msg { mine: boolean; text: string }

/** 고객센터 채팅(체험판 자동 답변). 실제 상담은 채팅 상담 SDK 연동 자리입니다 */
export function ChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>([{ mine: false, text: `안녕하세요, ${SITE.name} 고객센터예요.\n궁금한 점을 남겨 주시면 빠르게 답변드릴게요.\n\n운영 시간: ${SITE.csHours}` }])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, pending])
  useEffect(() => {
    if (!pending) return
    const t = setTimeout(() => {
      // 같은 뜻의 말을 FAQ에 쓰인 말로 바꿔서 찾습니다(예: 수수료 → 이용료)
      const SYN: Record<string, string> = { 수수료: '이용료', 서류: '서류', 증빙: '서류', 환불: '취소', 승인: '승인', 한도: '한도', 할부: '할부', 마일리지: '마일리지', 예약: '예약송금', 분할: '나눠' }
      const words = pending.split(/\s+/).map((w) => w.replace(/(은|는|이|가|을|를|요|예요|이에요|인가요|나요|얼마)$/g, ''))
        .flatMap((w) => [w, ...Object.entries(SYN).filter(([k]) => w.includes(k)).map(([, v]) => v)])
        .filter((w) => w.length >= 2)
      const score = (f: (typeof FAQS)[number]) => words.reduce((a, w) => a + (f.question.includes(w) ? 2 : 0) + (f.answer.includes(w) ? 1 : 0), 0)
      const best = [...FAQS].sort((a, b) => score(b) - score(a))[0]
      const hit = best && score(best) > 0 ? best : undefined
      setMsgs((m) => [...m, { mine: false, text: hit ? `관련 안내를 찾았어요.\n\nQ. ${hit.question}\n${hit.answer}\n\n더 궁금한 점은 상담원이 이어서 답변드릴게요.` : `문의가 접수됐어요. 상담원이 확인 후 답변드릴게요. 급한 문의는 ${SITE.csPhone}로 전화 주세요.` }])
      setPending(null)
    }, 700)
    return () => clearTimeout(t)
  }, [pending])

  return (
    <AppPage title="고객센터" narrow actions={<a className="btn btn-ghost btn-sm" href={`tel:${SITE.csPhone}`}><Phone size={16} />전화</a>}>
      <div className="chat">
        {msgs.map((m, i) => <div key={i} className={`bubble${m.mine ? ' me' : ''}`}>{m.text}</div>)}
        {pending && <span className="muted" style={{ fontSize: 13 }}>답변 작성 중</span>}
        <div ref={endRef} />
      </div>
      <form className="chat-input" onSubmit={(e) => {
        e.preventDefault()
        const q = input.trim()
        if (!q || pending) return
        setMsgs((m) => [...m, { mine: true, text: q }]); setInput(''); setPending(q)
      }}>
        <input className="input" value={input} onChange={(e) => setInput(e.target.value.slice(0, 300))} placeholder="메시지를 입력해 주세요" aria-label="메시지" />
        <button className="btn btn-primary" aria-label="보내기" disabled={!input.trim()}><Send size={18} /></button>
      </form>
    </AppPage>
  )
}
