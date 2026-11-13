import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { ARTICLES, EVENTS, FAQ_CATEGORIES, FAQS, NOTICES, QUIZZES } from '../../data/content'
import { FaqList, Pager } from '../../components/ui'
import { answerQuiz, mileageBalance, quizIndex, useStore } from '../../lib/store'
import { mileage, today } from '../../lib/format'

const IMG = `${import.meta.env.BASE_URL}img/`
const PAGE = 10
const TABS = [
  { key: 'faq', label: '자주 묻는 질문' },
  { key: 'notice', label: '공지사항' },
  { key: 'event', label: '이벤트' },
]

function SearchBox({ value, onChange, placeholder = '검색어를 입력해 주세요' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="search">
      <span className="sr-only">검색</span>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <Search size={18} />
    </label>
  )
}

export function SupportPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'faq'
  return (
    <>
      <div className="page-head container"><h1>고객센터</h1><p>자주 묻는 질문, 공지사항, 이벤트를 확인하세요</p></div>
      <div className="container" style={{ maxWidth: 920 }}>
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'on' : ''} onClick={() => setParams({ tab: t.key })}>{t.label}</button>
          ))}
        </div>
        {tab === 'faq' && <FaqTab />}
        {tab === 'notice' && <NoticeTab />}
        {tab === 'event' && <EventTab />}
        <div className="card" style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div><strong style={{ fontWeight: 600 }}>찾는 답이 없나요</strong><div className="sub" style={{ fontSize: 14 }}>1:1 채팅으로 물어보시면 답변드려요</div></div>
          <Link className="btn btn-primary btn-sm" to="/app/chat">1:1 문의하기</Link>
        </div>
      </div>
    </>
  )
}

function FaqTab() {
  const [cat, setCat] = useState(FAQ_CATEGORIES[0])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const list = useMemo(() => FAQS.filter((f) => (cat === '전체보기' || f.category === cat) && (!q.trim() || f.question.includes(q.trim()) || f.answer.includes(q.trim()))), [cat, q])
  useEffect(() => setPage(0), [cat, q])
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="chips" role="group" aria-label="질문 분류">
        {FAQ_CATEGORIES.map((c) => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <SearchBox value={q} onChange={setQ} />
      <FaqList items={list.slice(page * PAGE, page * PAGE + PAGE)} />
      <Pager pages={Math.ceil(list.length / PAGE)} page={page} onPage={setPage} />
    </div>
  )
}

function NoticeTab() {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const list = NOTICES.filter((n) => !q.trim() || n.title.includes(q.trim()))
  useEffect(() => setPage(0), [q])
  return (
    <div>
      <div style={{ borderTop: '1px solid var(--line)' }}>
        {list.slice(page * PAGE, page * PAGE + PAGE).map((n) => (
          <Link key={n.id} to={`/notice/${n.id}`} className="list-row"><span className="t">{n.title}</span><span className="d">{n.date}</span></Link>
        ))}
        {!list.length && <p className="empty">검색 결과가 없어요</p>}
      </div>
      <Pager pages={Math.ceil(list.length / PAGE)} page={page} onPage={setPage} />
      <div style={{ maxWidth: 360, margin: '24px auto 0' }}><SearchBox value={q} onChange={setQ} placeholder="제목으로 검색" /></div>
    </div>
  )
}

function EventTab() {
  return (
    <div className="article-grid">
      {EVENTS.map((e) => (
        <Link key={e.id} to={`/event/${e.id}`} className="article-card">
          {e.id === 1
            ? <div className="thumb" style={{ background: 'var(--navy)', fontSize: 18, padding: 20, textAlign: 'center' }}>{e.subtitle}</div>
            : <img className="thumb-img" src={IMG + (e.id === 2 ? 'coins.webp' : 'banner-shop.webp')} alt="" loading="lazy" />}
          <span className="pill pill-neutral" style={{ justifySelf: 'start' }}>{e.tag}</span>
          <h3>{e.title}</h3>
          <span className="muted" style={{ fontSize: 13 }}>{e.period}</span>
        </Link>
      ))}
    </div>
  )
}

export function NoticePage() {
  const { id } = useParams()
  const idx = NOTICES.findIndex((n) => String(n.id) === id)
  const n = NOTICES[idx]
  if (!n) return <div className="container page-head"><h1>공지를 찾을 수 없어요</h1></div>
  const prev = NOTICES[idx + 1], next = NOTICES[idx - 1]
  return (
    <div className="container" style={{ maxWidth: 800 }}>
      <div className="page-head" style={{ paddingLeft: 0 }}><p className="muted" style={{ margin: '0 0 8px', fontSize: 14 }}>공지사항 · {n.date}</p><h1 style={{ fontSize: 28 }}>{n.title}</h1></div>
      <div className="prose" style={{ borderTop: '1px solid var(--line)', paddingTop: 24 }}>{n.body}</div>
      {n.title.includes('무이자') && <p><Link className="link" to="/installment">카드사별 무이자 혜택 보기</Link></p>}
      <div style={{ marginTop: 40, borderTop: '1px solid var(--line)' }}>
        {prev && <Link className="list-row" to={`/notice/${prev.id}`}><span className="d">이전글</span><span className="t">{prev.title}</span></Link>}
        {next && <Link className="list-row" to={`/notice/${next.id}`}><span className="d">다음글</span><span className="t">{next.title}</span></Link>}
      </div>
      <p><Link className="btn btn-secondary btn-sm" to="/support?tab=notice">목록</Link></p>
    </div>
  )
}

export function EventPage() {
  const { id } = useParams()
  const e = EVENTS.find((x) => String(x.id) === id)
  const s = useStore()
  const navigate = useNavigate()
  const [picked, setPicked] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState<{ correct: boolean; answer: number; explain: string } | null>(null)
  if (!e) return <div className="container page-head"><h1>이벤트를 찾을 수 없어요</h1></div>
  const quiz = QUIZZES[quizIndex()]
  const doneToday = s.quizDoneDate === today()

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="page-head" style={{ paddingLeft: 0 }}>
        <span className="pill pill-info">{e.tag}</span>
        <h1 style={{ marginTop: 12 }}>{e.title}</h1>
        <p>{e.period}</p>
      </div>
      <div className="prose">{e.body}</div>

      {e.isQuiz && (
        <div className="card" style={{ marginTop: 32 }}>
          {!s.user ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className="sub">로그인 후 참여할 수 있어요</span>
              <Link className="btn btn-primary btn-sm" to="/login">로그인</Link>
            </div>
          ) : (
            <>
              <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>내 마일리지 {mileage(mileageBalance(s))}</div>
              <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>Q. {quiz.question}</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {quiz.options.map((o, i) => {
                  const reveal = submitted || doneToday
                  const style = reveal && submitted
                    ? i === result?.answer ? { borderColor: 'var(--paid)', background: 'var(--paid-soft)' } : i === picked ? { borderColor: 'var(--danger)', background: '#fde8e8' } : {}
                    : {}
                  return (
                    <button key={o} className="choice" style={{ justifyItems: 'start', padding: '14px 16px', ...style }} aria-pressed={picked === i} disabled={reveal} onClick={() => setPicked(i)}>
                      {i + 1}. {o}
                    </button>
                  )
                })}
              </div>
              {submitted && <p style={{ margin: '16px 0 0' }}><strong className={result?.correct ? 'paid' : 'danger'}>{result?.correct ? '정답이에요. 10M이 적립됐어요' : '아쉬워요. 내일 다시 도전해 주세요'}</strong><br /><span className="sub">{result?.explain}</span></p>}
              {!submitted && doneToday && <p className="sub" style={{ margin: '16px 0 0' }}>오늘은 이미 참여했어요. 내일 새 문제가 열려요</p>}
              {!submitted && !doneToday && (
                <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={picked === null} onClick={() => { if (picked === null) return; answerQuiz(picked).then((r) => { setResult(r); setSubmitted(true) }).catch((e: Error) => alert(e.message)) }}>정답 제출</button>
              )}
            </>
          )}
        </div>
      )}
      {!e.isQuiz && (
        <button className="btn btn-primary" style={{ marginTop: 32 }} onClick={() => navigate(e.id === 2 ? '/app' : '/app/chat')}>
          {e.id === 2 ? '송금하러 가기' : '후기 남기기'}
        </button>
      )}
    </div>
  )
}

export function MagazinePage() {
  const [cat, setCat] = useState('전체')
  const [q, setQ] = useState('')
  const cats = ['전체', ...Array.from(new Set(ARTICLES.map((a) => a.category)))]
  const list = ARTICLES.filter((a) => (cat === '전체' || a.category === cat) && (!q.trim() || a.title.includes(q.trim())))
  return (
    <>
      <div className="page-head container"><h1>사장님들의 비밀 지식인</h1><p>사업 운영부터 카드 활용까지, 거래노트 매거진에서 함께 알아보세요</p></div>
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
          <div className="chips">{cats.map((c) => <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}</div>
          <div style={{ minWidth: 260, flex: '0 1 320px' }}><SearchBox value={q} onChange={setQ} /></div>
        </div>
        <div className="article-grid">
          {list.map((a) => (
            <Link key={a.id} to={`/magazine/${a.id}`} className="article-card">
              <img className="thumb-img" src={`${IMG}mag${a.id}.webp`} alt="" loading="lazy" />
              <span className="muted" style={{ fontSize: 13 }}>{a.category} · {a.date}</span>
              <h3>{a.title}</h3>
              <p className="sub" style={{ margin: 0, fontSize: 14 }}>{a.summary}</p>
            </Link>
          ))}
        </div>
        {!list.length && <p className="empty">검색 결과가 없어요</p>}
      </div>
    </>
  )
}

export function ArticlePage() {
  const { id } = useParams()
  const a = ARTICLES.find((x) => String(x.id) === id)
  if (!a) return <div className="container page-head"><h1>글을 찾을 수 없어요</h1></div>
  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <div className="page-head" style={{ paddingLeft: 0 }}>
        <p className="muted" style={{ margin: '0 0 8px', fontSize: 14 }}>{a.category} · {a.date}</p>
        <h1 style={{ fontSize: 30, lineHeight: 1.35 }}>{a.title}</h1>
        <p style={{ marginTop: 12 }}>{a.summary}</p>
      </div>
      <img className="thumb-img" style={{ aspectRatio: '16 / 9', marginBottom: 32 }} src={`${IMG}mag${a.id}.webp`} alt="" />
      <div className="prose">{a.body}</div>
      <p style={{ marginTop: 40 }}><Link className="btn btn-secondary btn-sm" to="/magazine">목록으로</Link></p>
    </div>
  )
}
