import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, ShieldCheck, Smartphone, Zap } from 'lucide-react'
import { MODE, quickStart, requestCode, SOCIAL, socialLogin, useStore, verifyLink, verifyLogin } from '../../lib/store'
import { phone as fmtPhone } from '../../lib/format'
import { SITE } from '../../data/content'
import { AppPage } from '../../components/Layouts'

const CARRIERS = ['SKT', 'KT', 'LG U+', 'SKT 알뜰폰', 'KT 알뜰폰', 'LG U+ 알뜰폰']

/**
 * 휴대폰 본인인증 폼(통신사 → 이름·생년월일·번호 → 인증번호).
 * mode 'login': 이 번호로 인증한 계정으로 로그인(없으면 새로 가입)
 * mode 'link' : 지금 로그인한 계정에 본인인증을 붙임(계약·결제 전 1회)
 * 실제 서비스에서는 본인인증 대행사(PASS 등) 화면으로 바뀌어요.
 */
export function PhoneVerify({ mode, onDone, onBack }: { mode: 'login' | 'link'; onDone: () => void; onBack?: () => void }) {
  const [step, setStep] = useState<'carrier' | 'form'>('carrier')
  const [carrier, setCarrier] = useState('')
  const [name, setName] = useState('')
  const [birth, setBirth] = useState('')
  const [phone, setPhone] = useState('')
  const [sent, setSent] = useState(false)
  const [demoCode, setDemoCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const infoOk = name.trim() && birth.length === 8 && phone.length >= 10

  return (
    <>
      {(step === 'form' || onBack) && (
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: -12, marginBottom: 16 }} onClick={() => (step === 'form' ? setStep('carrier') : onBack?.())}>
          <ChevronLeft size={18} />이전
        </button>
      )}
      {step === 'carrier' && (
        <div className="enter">
          <p style={{ color: 'var(--primary)', fontWeight: 600, margin: '0 0 8px', fontSize: 14 }}>{mode === 'link' ? '본인인증 1회' : '휴대폰 번호로 로그인'}</p>
          <h1 className="step-title" style={{ fontWeight: 500 }}>이용 중인 통신사를<br />선택해 주세요</h1>
          <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 28 }}>
            {CARRIERS.map((c, i) => (
              <button key={c} className="choice" style={{ aspectRatio: '1', alignContent: 'center', fontSize: 17, fontWeight: 600, background: i > 2 ? 'var(--raised)' : undefined }}
                onClick={() => { setCarrier(c); setStep('form') }}>{c.replace(' 알뜰폰', '\n알뜰폰')}</button>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 16 }}>실제 서비스에서는 본인인증 기관(PASS 등) 연동 화면으로 바뀌어요</p>
        </div>
      )}
      {step === 'form' && (
        <form className="enter form-stack" onSubmit={(e) => {
          e.preventDefault()
          if (busy) return
          setBusy(true); setError('')
          const payload = { phone, code, expected: demoCode, name, birth, carrier }
          const run = sent
            ? (mode === 'link' ? verifyLink(payload) : verifyLogin(payload)).then(onDone)
            : requestCode(phone).then((c) => { setDemoCode(c); setSent(true) })
          run.catch((err: Error) => setError(err.message)).finally(() => setBusy(false))
        }}>
          <h1 className="step-title">본인 정보를<br />입력해 주세요</h1>
          <label className="field"><span>통신사</span><input className="input" value={carrier} readOnly tabIndex={-1} /></label>
          <label className="field"><span>이름</span><input className="input" value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} placeholder="홍길동" disabled={sent} autoComplete="name" /></label>
          <label className="field"><span>생년월일 8자리</span><input className="input num" inputMode="numeric" value={birth} onChange={(e) => setBirth(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="19900101" disabled={sent} /></label>
          <label className="field"><span>휴대폰 번호</span><input className="input num" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="01012345678" disabled={sent} autoComplete="tel" /></label>
          {sent && (
            <>
              <label className="field"><span>인증번호</span><input className="input num" inputMode="numeric" autoFocus value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }} placeholder="6자리 입력" autoComplete="one-time-code" /></label>
              {demoCode
                ? <div className="notice-box">체험판 인증번호: <strong className="num">{demoCode}</strong><br />{fmtPhone(phone)}로 보낸 것으로 가정해요. 실제 서비스에서는 문자로 받아요</div>
                : <div className="notice-box">{fmtPhone(phone)}로 인증번호를 보냈어요</div>}
              {MODE === 'remote' && <p className="hint" style={{ margin: 0 }}>인증한 번호로 로그인하면 안드로이드 앱과 다른 기기에서도 같은 계약과 송금 내역을 볼 수 있어요</p>}
              <button type="button" className="link" style={{ border: 0, background: 'none', justifySelf: 'start', padding: 0 }} onClick={() => { setCode(''); requestCode(phone).then(setDemoCode).catch((err: Error) => setError(err.message)) }}>인증번호 다시 받기</button>
            </>
          )}
          {error && <p className="hint error" style={{ margin: 0 }}>{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy || (sent ? code.length !== 6 : !infoOk)}>{busy ? '확인 중' : sent ? '확인' : '인증번호 받기'}</button>
        </form>
      )}
    </>
  )
}

const KakaoMark = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path fill="#191919" d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7l-1 3.6c-.1.3.3.6.6.4l4.2-2.8c.5.1 1 .1 1.5.1 5.5 0 10-3.6 10-8S17.5 3 12 3z" /></svg>
)
const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.4 24 12 24z" />
    <path fill="#FBBC05" d="M5.3 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l4-3.1z" />
    <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
  </svg>
)

/** 약관 동의 → 시작 방법 선택(바로 시작·카카오·구글·휴대폰 번호 로그인) */
export default function LoginPage() {
  const { user } = useStore()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/app'
  const [step, setStep] = useState<'terms' | 'method' | 'phone'>('terms')
  const [agree, setAgree] = useState({ service: false, privacy: false, marketing: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (user && step !== 'phone') return <Navigate to={from} replace />
  const all = agree.service && agree.privacy && agree.marketing
  const run = (p: Promise<unknown>, after?: () => void) => {
    setBusy(true); setError('')
    p.then(() => after?.()).catch((e: Error) => setError(e.message)).finally(() => setBusy(false))
  }

  return (
    <div className="container" style={{ maxWidth: 480, padding: '48px 16px 32px' }}>
      {step === 'terms' && (
        <div className="enter">
          <h1 className="step-title">{SITE.name} 시작하기</h1>
          <p className="step-sub">약관에 동의하면 바로 둘러볼 수 있어요. 계약 등록과 결제 전에만 본인인증을 한 번 받아요</p>
          <button className="check" style={{ width: '100%', padding: '16px 18px', borderRadius: 12, background: 'var(--raised)', border: 0, fontWeight: 600, fontSize: 16 }}
            onClick={() => setAgree({ service: !all, privacy: !all, marketing: !all })}>
            <Check size={20} color={all ? 'var(--primary)' : '#cbd5e1'} strokeWidth={2.5} />전체 동의
          </button>
          <div style={{ marginTop: 8 }}>
            {([['service', '필수', '서비스 이용약관'], ['privacy', '필수', '개인정보 수집·이용 동의'], ['marketing', '선택', '마케팅 정보 수신 동의']] as const).map(([k, req, label]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                <button aria-pressed={agree[k]} aria-label={`${label} 동의`} style={{ border: 0, background: 'none', padding: 0, display: 'flex', gap: 10, alignItems: 'center', flex: 1, textAlign: 'left' }}
                  onClick={() => setAgree({ ...agree, [k]: !agree[k] })}>
                  <Check size={20} color={agree[k] ? 'var(--primary)' : '#cbd5e1'} strokeWidth={2.5} />
                  <span style={{ color: req === '필수' ? 'var(--primary)' : 'var(--muted)', fontWeight: 600, fontSize: 13 }}>{req}</span>
                  <span style={{ fontSize: 14 }}>{label}</span>
                </button>
                <Link to={`/terms/${k}`} aria-label={`${label} 보기`} className="muted"><ChevronRight size={18} /></Link>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 32 }} disabled={!agree.service || !agree.privacy} onClick={() => setStep('method')}>동의하고 계속</button>
        </div>
      )}

      {step === 'method' && (
        <div className="enter">
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: -12, marginBottom: 16 }} onClick={() => setStep('terms')}><ChevronLeft size={18} />이전</button>
          <h1 className="step-title">어떻게 시작할까요</h1>
          <p className="step-sub">처음이라면 바로 시작해 보세요. 닉네임은 자동으로 정해지고 나중에 바꿀 수 있어요</p>
          <div className="form-stack" style={{ gap: 10 }}>
            <button className="btn btn-primary btn-block" disabled={busy} onClick={() => run(quickStart(), () => navigate(from, { replace: true }))}>
              <Zap size={18} />바로 시작하기
            </button>
            {SOCIAL.includes('kakao') && (
              <button className="btn btn-block" style={{ background: '#FEE500', color: '#191919' }} disabled={busy} onClick={() => run(socialLogin('kakao'))}>
                <KakaoMark />카카오로 시작하기
              </button>
            )}
            {SOCIAL.includes('google') && (
              <button className="btn btn-secondary btn-block" disabled={busy} onClick={() => run(socialLogin('google'))}>
                <GoogleMark />구글로 시작하기
              </button>
            )}
            <button className="btn btn-secondary btn-block" disabled={busy} onClick={() => setStep('phone')}>
              <Smartphone size={18} />휴대폰 번호로 로그인
            </button>
          </div>
          <p className="hint" style={{ marginTop: 12 }}>이미 본인인증을 한 분은 휴대폰 번호로 로그인하면 앱과 같은 계정으로 이어져요</p>
          {error && <p className="hint error">{error}</p>}
        </div>
      )}

      {step === 'phone' && <PhoneVerify mode="login" onBack={() => setStep('method')} onDone={() => navigate(from, { replace: true })} />}
    </div>
  )
}

/** 계약 등록·결제 전에 본인인증을 붙이는 화면 */
export function VerifyPage() {
  const { user } = useStore()
  const navigate = useNavigate()
  const next = useSearchParams()[0].get('next') ?? '/app'
  if (user?.verified) return <Navigate to={next} replace />
  return (
    <AppPage title="본인인증" back narrow>
      <div className="notice-box" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 24 }}>
        <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>카드는 본인 명의만 쓸 수 있어서, 계약 등록과 결제 전에 한 번만 본인인증을 받아요. 인증한 번호로 앱에서도 같은 계정으로 로그인할 수 있어요</span>
      </div>
      <PhoneVerify mode="link" onDone={() => navigate(next, { replace: true })} />
    </AppPage>
  )
}
