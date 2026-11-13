import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { MODE, requestCode, useStore, verifyLogin } from '../../lib/store'
import { phone as fmtPhone } from '../../lib/format'
import { SITE } from '../../data/content'

const CARRIERS = ['SKT', 'KT', 'LG U+', 'SKT 알뜰폰', 'KT 알뜰폰', 'LG U+ 알뜰폰']

/** 약관 동의 → 통신사 선택 → 본인 정보·인증번호. 실제 서비스에서는 본인인증 기관(PASS 등) 연동으로 바뀝니다. */
export default function LoginPage() {
  const { user } = useStore()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/app'
  const [step, setStep] = useState<'terms' | 'carrier' | 'verify'>('terms')
  const [agree, setAgree] = useState({ service: false, privacy: false, marketing: false })
  const [carrier, setCarrier] = useState('')
  const [name, setName] = useState('')
  const [birth, setBirth] = useState('')
  const [phone, setPhone] = useState('')
  const [sent, setSent] = useState(false)
  const [demoCode, setDemoCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  if (user && step === 'terms') return <Navigate to={from} replace />

  const all = agree.service && agree.privacy && agree.marketing
  const infoOk = name.trim() && birth.length === 8 && phone.length >= 10

  return (
    <div className="container" style={{ maxWidth: 480, padding: '48px 16px 32px' }}>
      {step !== 'terms' && (
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: -12, marginBottom: 16 }} onClick={() => setStep(step === 'verify' ? 'carrier' : 'terms')}>
          <ChevronLeft size={18} />이전
        </button>
      )}

      {step === 'terms' && (
        <div className="enter">
          <h1 className="step-title">휴대폰 번호로<br />본인인증을 해 주세요</h1>
          <p className="step-sub">{SITE.name}는 휴대폰 본인인증 한 번으로 회원가입이 끝나요</p>
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
          <button className="btn btn-primary btn-block" style={{ marginTop: 32 }} disabled={!agree.service || !agree.privacy} onClick={() => setStep('carrier')}>휴대폰 본인인증</button>
        </div>
      )}

      {step === 'carrier' && (
        <div className="enter">
          <p style={{ color: 'var(--primary)', fontWeight: 600, margin: '0 0 8px', fontSize: 14 }}>본인인증</p>
          <h1 className="step-title" style={{ fontWeight: 500 }}>이용 중인 통신사를<br />선택해 주세요</h1>
          <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 28 }}>
            {CARRIERS.map((c, i) => (
              <button key={c} className="choice" style={{ aspectRatio: '1', alignContent: 'center', fontSize: 17, fontWeight: 600, background: i > 2 ? 'var(--raised)' : undefined }}
                onClick={() => { setCarrier(c); setStep('verify') }}>{c.replace(' 알뜰폰', '\n알뜰폰')}</button>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 16 }}>실제 서비스에서는 본인인증 기관(PASS 등) 연동 화면으로 바뀌어요</p>
        </div>
      )}

      {step === 'verify' && (
        <form className="enter form-stack" onSubmit={(e) => {
          e.preventDefault()
          if (busy) return
          setBusy(true); setError('')
          const run = sent
            ? verifyLogin({ phone, code, expected: demoCode, name, birth, carrier }).then(() => navigate(from, { replace: true }))
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
              {MODE === 'remote' && <p className="hint" style={{ margin: 0 }}>같은 번호로 로그인하면 안드로이드 앱에서도 같은 계약과 송금 내역을 볼 수 있어요</p>}
              <button type="button" className="link" style={{ border: 0, background: 'none', justifySelf: 'start', padding: 0 }} onClick={() => { setCode(''); requestCode(phone).then(setDemoCode).catch((err: Error) => setError(err.message)) }}>인증번호 다시 받기</button>
            </>
          )}
          {error && <p className="hint error" style={{ margin: 0 }}>{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy || (sent ? code.length !== 6 : !infoOk)}>{busy ? '확인 중' : sent ? '확인' : '인증번호 받기'}</button>
        </form>
      )}
    </div>
  )
}
