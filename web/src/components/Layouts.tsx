import { ReactNode, useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, Coins, Headphones, History, House, Menu, Settings, X, FilePlus2 } from 'lucide-react'
import { refresh, useStore } from '../lib/store'
import InstallHint from './InstallHint'
import { SITE } from '../data/content'

const logoSrc = `${import.meta.env.BASE_URL}icon-round.png`

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label={`${SITE.name} 홈`}>
      <img src={logoSrc} alt="" />
      {SITE.name}
    </Link>
  )
}

const SITE_LINKS = [
  { to: '/guide', label: '이용방법' },
  { to: '/fees', label: '수수료안내' },
  { to: '/magazine', label: '매거진' },
  { to: '/support', label: '고객센터' },
  { to: '/install', label: '앱 설치' },
]

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export function SiteLayout() {
  const { user } = useStore()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4)
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  return (
    <>
      <ScrollTop />
      <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
        <div className="container bar">
          <Logo />
          <nav className="site-nav" aria-label="주 메뉴">
            {SITE_LINKS.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
          </nav>
          <div className="site-actions">
            {user
              ? <Link className="btn btn-ghost btn-sm hide-m" to="/app/settings">{user.nickname}님</Link>
              : <Link className="btn btn-ghost btn-sm hide-m" to="/login">로그인</Link>}
            <Link className="btn btn-primary btn-sm" to="/app">결제 시작하기</Link>
            <button className="menu-btn" aria-label="메뉴" aria-expanded={open} onClick={() => setOpen(!open)}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        <nav className={`mobile-menu${open ? ' open' : ''}`} aria-label="모바일 메뉴">
          {SITE_LINKS.map((l) => <Link key={l.to} to={l.to}>{l.label}</Link>)}
          <Link to={user ? '/app/settings' : '/login'}>{user ? '내 정보' : '로그인'}</Link>
        </nav>
      </header>
      <main><Outlet /></main>
      <SiteFooter />
      <InstallHint />
    </>
  )
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Logo />
            <p style={{ margin: '12px 0 0', maxWidth: 280 }}>사업대금은 카드로, 거래처에는 계좌로. 소상공인을 위한 사업대금 카드결제 서비스예요.</p>
          </div>
          <div>
            <h4>서비스</h4>
            <ul>
              <li><Link to="/app">사업대금 카드결제</Link></li>
              <li><Link to="/fees">수수료 안내</Link></li>
              <li><Link to="/guide">이용방법</Link></li>
              <li><Link to="/installment">카드 할부 정보</Link></li>
            </ul>
          </div>
          <div>
            <h4>고객센터</h4>
            <ul>
              <li><Link to="/support?tab=faq">자주 묻는 질문</Link></li>
              <li><Link to="/support?tab=notice">공지사항</Link></li>
              <li><Link to="/support?tab=event">이벤트</Link></li>
              <li><Link to="/app/chat">1:1 문의</Link></li>
            </ul>
          </div>
          <div>
            <h4>앱</h4>
            <ul>
              <li><Link to="/install">안드로이드 앱 내려받기</Link></li>
              <li><Link to="/install">아이폰에 설치하기</Link></li>
              <li><Link to="/terms/service">서비스 이용약관</Link></li>
              <li><Link to="/terms/privacy">개인정보 처리 안내</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-legal">
          <span>고객센터 {SITE.csPhone} · {SITE.csHours}</span>
          <span>이 사이트는 체험판입니다. 실제 카드결제·본인인증·송금은 제휴 PG사 연동 후 제공되며, 입력한 정보는 이 브라우저에만 저장돼요.</span>
          <span>© 2026 {SITE.name}</span>
        </div>
      </div>
    </footer>
  )
}

const APP_LINKS = [
  { to: '/app', label: '홈', icon: House, end: true },
  { to: '/app/contracts/new', label: '계약 등록', icon: FilePlus2 },
  { to: '/app/transfers', label: '송금 내역', icon: History },
  { to: '/app/mileage', label: '마일리지', icon: Coins },
  { to: '/app/chat', label: '고객센터', icon: Headphones },
  { to: '/app/settings', label: '설정', icon: Settings },
]
const TAB_LINKS = APP_LINKS.filter((l) => l.to !== '/app/chat')

/** 로그인한 사람만 들어올 수 있는 웹앱 영역 */
export function AppLayout() {
  const { user } = useStore()
  const location = useLocation()
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 3000)
    return () => clearInterval(t)
  }, [])
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return (
    <div className="app-shell">
      <ScrollTop />
      <aside className="sidebar">
        <Logo />
        <nav className="side-nav" aria-label="웹앱 메뉴">
          {APP_LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}><Icon size={18} strokeWidth={1.75} />{label}</NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <Link to="/" className="link">사이트로 돌아가기</Link>
          <span>{user.nickname}님{user.verified ? '' : ' · 본인인증 전'}</span>
        </div>
      </aside>
      <div className="app-main">
        <Outlet />
      </div>
      <InstallHint />
      <nav className="tabbar" aria-label="하단 메뉴">
        {TAB_LINKS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}><Icon size={20} strokeWidth={1.75} />{label}</NavLink>
        ))}
      </nav>
    </div>
  )
}

/** 웹앱 화면 상단: 제목 + 뒤로가기 */
export function AppPage({ title, back, narrow, actions, children }: {
  title: string; back?: boolean | string; narrow?: boolean; actions?: ReactNode; children: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <>
      <div className="app-top">
        <h1>
          {back && (
            <button className="back" aria-label="뒤로" onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}>
              <ChevronLeft size={22} />
            </button>
          )}
          {title}
        </h1>
        <div>{actions}</div>
      </div>
      <div className="demo-banner">체험판이에요. 카드결제·송금은 모의로 처리되고 실제 돈은 오가지 않아요</div>
      <div className={`app-content enter${narrow ? ' narrow' : ''}`}>{children}</div>
    </>
  )
}
