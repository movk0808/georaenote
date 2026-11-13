import { FormEvent, useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import {
  BadgeCheck, Banknote, FileCheck2, LayoutDashboard, LogOut, Megaphone, MessageSquareText, Settings2, Star, Users,
} from 'lucide-react'
import { adb, arpc, useStaff } from './api'
import Dashboard from './Dashboard'
import { ContractsPage, TransfersPage, UsersPage } from './Operations'
import { InquiriesPage, NoticesPage, ReviewsPage, SettingsPage } from './Support'
import '../admin.css'

const NAV = [
  { to: '/admin', label: '대시보드', icon: LayoutDashboard, end: true },
  { to: '/admin/contracts', label: '계약 심사', icon: FileCheck2 },
  { to: '/admin/transfers', label: '결제·송금', icon: Banknote },
  { to: '/admin/users', label: '회원', icon: Users },
  { to: '/admin/inquiries', label: '1:1 문의', icon: MessageSquareText },
  { to: '/admin/reviews', label: '후기', icon: Star },
  { to: '/admin/notices', label: '공지사항', icon: Megaphone },
  { to: '/admin/settings', label: '운영 설정', icon: Settings2 },
]

export default function AdminApp() {
  const { loading, email, staff, aal2, reload } = useStaff()
  if (!adb) return <AdminMessage title="서버가 연결되지 않았어요" body="web/.env.local 에 VITE_SUPABASE_URL 과 VITE_SUPABASE_ANON_KEY 를 넣으면 관리자 페이지를 쓸 수 있어요." />
  if (loading) return <div className="adm-center"><div className="spinner" /></div>
  if (!email) return <AdminLogin />
  if (!staff) return <ClaimAdmin email={email} onDone={reload} />
  // 직원은 OTP 2단계 로그인까지 마쳐야 관리자 화면을 쓸 수 있어요
  if (!aal2) return <AdminMfa email={email} onDone={reload} />

  return (
    <div className="adm-shell">
      <aside className="adm-side">
        <div className="adm-brand"><img src={`${import.meta.env.BASE_URL}icon-round.png`} alt="" />거래노트 <span>관리자</span></div>
        <nav>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}><Icon size={17} strokeWidth={1.75} />{label}</NavLink>
          ))}
        </nav>
        <div className="adm-me">
          <div><strong>{staff.name}</strong><span>{staff.role === 'ADMIN' ? '관리자' : staff.role === 'REVIEWER' ? '심사자' : '조회 전용'}</span></div>
          <button aria-label="로그아웃" onClick={() => adb!.auth.signOut()}><LogOut size={16} /></button>
        </div>
      </aside>
      <main className="adm-main">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="contracts" element={<ContractsPage staff={staff} />} />
          <Route path="transfers" element={<TransfersPage staff={staff} />} />
          <Route path="users" element={<UsersPage staff={staff} />} />
          <Route path="inquiries" element={<InquiriesPage />} />
          <Route path="reviews" element={<ReviewsPage />} />
          <Route path="notices" element={<NoticesPage />} />
          <Route path="settings" element={<SettingsPage staff={staff} />} />
        </Routes>
      </main>
    </div>
  )
}

function AdminMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="adm-center">
      <div className="adm-card" style={{ maxWidth: 420 }}>
        <h1>{title}</h1>
        <p className="sub">{body}</p>
      </div>
    </div>
  )
}

function AdminLogin() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    const fn = mode === 'in' ? adb!.auth.signInWithPassword({ email, password }) : adb!.auth.signUp({ email, password })
    const { error: err } = await fn
    if (err) setError(err.message === 'Invalid login credentials' ? '이메일이나 비밀번호가 맞지 않아요' : err.message)
    setBusy(false)
  }
  return (
    <div className="adm-center">
      <form className="adm-card form-stack" style={{ width: 380 }} onSubmit={submit}>
        <div className="adm-brand" style={{ padding: 0 }}><img src={`${import.meta.env.BASE_URL}icon-round.png`} alt="" />거래노트 <span>관리자</span></div>
        <h1>{mode === 'in' ? '관리자 로그인' : '관리자 계정 만들기'}</h1>
        <label className="field"><span>이메일</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label className="field"><span>비밀번호</span><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={8} required /></label>
        {error && <p className="hint error" style={{ margin: 0 }}>{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{mode === 'in' ? '로그인' : '계정 만들기'}</button>
        <button type="button" className="link" style={{ border: 0, background: 'none' }} onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? '처음이라면 계정 만들기' : '이미 계정이 있어요'}
        </button>
      </form>
    </div>
  )
}

/**
 * 관리자 2단계 로그인(OTP). 처음이면 인증 앱(Google Authenticator 등)에 등록하고,
 * 다음부터는 앱에 뜨는 6자리만 입력해요.
 */
function AdminMfa({ email, onDone }: { email: string; onDone: () => void }) {
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const start = async () => {
    setError('')
    const { data, error: e } = await adb!.auth.mfa.listFactors()
    if (e) { setError(e.message); return }
    const verified = data.totp.find((f) => f.status === 'verified')
    if (verified) { setFactorId(verified.id); return }
    // 등록하다 그만둔 기록은 지우고 새로 등록
    for (const f of data.all.filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) await adb!.auth.mfa.unenroll({ factorId: f.id })
    const { data: en, error: e2 } = await adb!.auth.mfa.enroll({ factorType: 'totp', friendlyName: `거래노트 관리자 ${Date.now()}` })
    if (e2 || !en) { setError(e2?.message ?? 'OTP 등록을 시작하지 못했어요'); return }
    setFactorId(en.id); setQr(en.totp.qr_code); setSecret(en.totp.secret)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void start() }, [])

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    if (!factorId) return
    setBusy(true); setError('')
    const { error: err } = await adb!.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\D/g, '') })
    setBusy(false)
    if (err) { setError(err.message.includes('Invalid') ? '번호가 맞지 않아요. 앱에 새로 뜬 6자리를 넣어 주세요' : err.message); return }
    onDone()
  }

  return (
    <div className="adm-center">
      <form className="adm-card form-stack" style={{ width: 400 }} onSubmit={verify}>
        <h1>2단계 로그인</h1>
        <p className="sub" style={{ margin: 0 }}>{email}</p>
        {qr ? (
          <>
            <p className="sub" style={{ margin: 0 }}>처음 한 번만 등록해요. 휴대폰의 인증 앱(Google Authenticator, Microsoft Authenticator 등)으로 아래 QR을 찍어 주세요.</p>
            <img src={qr} alt="OTP 등록 QR 코드" style={{ width: 180, height: 180, alignSelf: 'center', background: '#fff', borderRadius: 8 }} />
            {secret && <p className="hint" style={{ margin: 0 }}>QR을 못 찍으면 앱에 이 키를 직접 넣어요: <span className="num">{secret}</span></p>}
          </>
        ) : (
          <p className="sub" style={{ margin: 0 }}>인증 앱에 뜨는 거래노트 6자리 번호를 넣어 주세요.</p>
        )}
        <label className="field"><span>인증 번호 6자리</span>
          <input className="input num" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
        </label>
        {error && <p className="hint error" style={{ margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => adb!.auth.signOut()}>로그아웃</button>
          <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy || code.length !== 6 || !factorId}>확인</button>
        </div>
      </form>
    </div>
  )
}

function ClaimAdmin({ email, onDone }: { email: string; onDone: () => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  return (
    <div className="adm-center">
      <div className="adm-card form-stack" style={{ width: 420 }}>
        <h1>관리자 권한이 없는 계정이에요</h1>
        <p className="sub" style={{ margin: 0 }}>{email}</p>
        <p className="sub" style={{ margin: 0 }}>아직 관리자가 한 명도 없다면 이 계정을 첫 관리자로 등록할 수 있어요. 이미 관리자가 있다면 그분께 '운영 설정 → 직원'에서 추가해 달라고 요청하세요.</p>
        <label className="field"><span>이름</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예) 운영팀 김대표" /></label>
        {error && <p className="hint error" style={{ margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => adb!.auth.signOut()}>로그아웃</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => arpc('claim_first_admin', { p_name: name }).then(onDone).catch((e: Error) => setError(e.message))}>
            <BadgeCheck size={18} />첫 관리자로 등록
          </button>
        </div>
      </div>
    </div>
  )
}
