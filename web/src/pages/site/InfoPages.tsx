import { Link, useParams } from 'react-router-dom'
import { Download, MonitorSmartphone, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import FeeCalculator from '../../components/FeeCalculator'
import { GUIDE_POINTS, INSTALLMENT_MONTH, INSTALLMENT_PERIOD, INSTALLMENTS, SITE } from '../../data/content'
import { CONTRACT_TYPES, ContractType } from '../../lib/model'
import { TypeBadge } from '../../components/ui'

function PageHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="page-head container">
      <h1>{title}</h1>
      {sub && <p>{sub}</p>}
    </div>
  )
}

export function GuidePage() {
  return (
    <>
      <PageHead title="이용방법" sub="현금이 필요할 때, 카드를 쓰세요. 계약 등록부터 송금까지 순서대로 안내해 드려요" />
      <div className="container">
        <img className="page-visual" style={{ marginBottom: 40 }} src={`${import.meta.env.BASE_URL}img/hero-3d.webp`} alt="카드로 결제하고 입금 완료 영수증을 받는 모습" />
        <div className="use-grid">
          {GUIDE_POINTS.map((p) => (
            <div key={p.title} className="use-card"><h3>{p.title}</h3><p>{p.body}</p></div>
          ))}
        </div>

        <div className="section-head" style={{ marginTop: 72 }}>
          <p className="kicker" style={{ color: 'var(--paid)', fontWeight: 600, margin: '0 0 12px' }}>계약 유형과 필요한 서류</p>
          <h2 style={{ fontSize: 28, margin: 0, fontWeight: 600 }}>어떤 대금을 보내시나요</h2>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead><tr><th>계약 유형</th><th>예시</th><th>필요한 서류</th></tr></thead>
            <tbody>
              {(Object.keys(CONTRACT_TYPES) as ContractType[]).map((k) => (
                <tr key={k}>
                  <td><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><TypeBadge type={k} size={32} />{CONTRACT_TYPES[k].label}</span></td>
                  <td className="sub">{CONTRACT_TYPES[k].hint}</td>
                  <td>{CONTRACT_TYPES[k].proof}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="section-head" style={{ marginTop: 72 }}>
          <h2 style={{ fontSize: 28, margin: 0, fontWeight: 600 }}>이렇게 이용해요</h2>
        </div>
        <ol className="howto">
          {[
            ['계약 등록', '거래 유형 선택 → 거래처·계좌 입력 → 송금자명 → 증빙서류 첨부'],
            ['검토·승인', '영업일 기준 최대 1일 안에 검토가 끝나요. 승인된 계약은 반복해서 쓸 수 있어요'],
            ['결제하기', '바로송금(4%) 또는 예약송금(3.5%)을 고르고 카드로 결제해요'],
            ['송금 완료', "바로송금은 결제 후 '송금하기'를 누르면 즉시, 예약송금은 정한 날짜에 입금돼요"],
          ].map(([t, b], i) => <li key={t}><span className="n">{i + 1}</span><h3>{t}</h3><p>{b}</p></li>)}
        </ol>
        <div style={{ marginTop: 40 }}><Link className="btn btn-primary" to="/app">계약 등록하러 가기</Link></div>
      </div>
    </>
  )
}

export function FeesPage() {
  return (
    <>
      <PageHead title="수수료 안내" sub="바로송금 4%, 예약송금 3.5%(부가세 포함). 이용료의 2%는 마일리지로 돌려드려요" />
      <div className="container">
        <FeeCalculator />
        <div className="steps3" style={{ marginTop: 48 }}>
          <div className="step3"><h3>현금이 없어도 돼요</h3><p>통장에 현금이 부족해도 거래처 입금일은 지킬 수 있어요.</p></div>
          <div className="step3"><h3>최대 12개월 할부</h3><p>큰 사업 대금도 나눠서 내고, 통장 잔고는 만일에 대비할 수 있어요.</p></div>
          <div className="step3"><h3>카드 혜택은 그대로</h3><p>카드 포인트와 실적 혜택을 그대로 챙길 수 있어요. 실적 인정 기준은 카드사마다 달라요.</p></div>
        </div>
        <div className="card" style={{ marginTop: 32 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 600 }}>계산 기준</h3>
          <ul className="sub" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
            <li>카드 청구액 = 거래처 입금액 + 이용료 (이용료는 원 단위 반올림)</li>
            <li>마일리지 = 이용료의 2% (1M 단위 내림), 송금이 완료되면 적립</li>
            <li>1회 1만 원부터 2,000만 원까지, 실제 한도는 보유 카드의 잔여 한도를 따라요</li>
            <li>할부 이자는 카드사가 부과해요. 무이자 혜택은 <Link className="link" to="/installment">카드 할부 정보</Link>에서 확인하세요</li>
          </ul>
        </div>
      </div>
    </>
  )
}

export function InstallmentPage() {
  return (
    <>
      <PageHead title={`${INSTALLMENT_MONTH} 무이자 할부 안내`} sub={INSTALLMENT_PERIOD} />
      <div className="container">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead><tr><th>카드사</th><th>무이자 할부</th><th>부분무이자 (고객부담 회차)</th></tr></thead>
            <tbody>
              {INSTALLMENTS.map((r) => (
                <tr key={r.card}><td>{r.card}</td><td className="em">{r.free}</td><td className="sub">{r.partial}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 12 }}>표의 혜택은 예시이며 카드사 사정에 따라 바뀌거나 중단될 수 있어요. 결제 전 카드사에서 꼭 확인해 주세요.</p>
      </div>
    </>
  )
}

interface InstallPromptEvent extends Event { prompt: () => Promise<void> }

export function DownloadPage() {
  const [installEvt, setInstallEvt] = useState<InstallPromptEvent | null>(null)
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setInstallEvt(e as InstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', on)
    return () => window.removeEventListener('beforeinstallprompt', on)
  }, [])
  const base = import.meta.env.BASE_URL
  return (
    <>
      <PageHead title="앱 다운로드" sub="안드로이드 앱으로 쓰거나, 웹앱으로 홈 화면에 추가해서 쓸 수 있어요" />
      <div className="container">
        <div className="split-head" style={{ alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 26, fontWeight: 600, margin: '0 0 12px', letterSpacing: '-0.02em' }}>계약 등록부터 송금 완료까지<br />앱에서는 이렇게 동작해요</h2>
            <p className="sub" style={{ margin: 0 }}>거래 유형을 고르고 거래처와 증빙을 등록한 뒤, 승인된 계약으로 카드 결제하고 송금하는 실제 안드로이드 화면이에요.</p>
          </div>
          <video className="demo-gif" style={{ justifySelf: 'center' }} src={`${base}img/app-demo.mp4`} poster={`${base}img/app-demo-poster.webp`}
            autoPlay muted loop playsInline aria-label="안드로이드 앱 사용 장면: 가입, 계약 등록, 송금, 결제, 송금 완료" />
        </div>
        <div className="steps3">
          <div className="step3">
            <span className="icon"><Smartphone size={20} strokeWidth={1.75} /></span>
            <h3>안드로이드 앱</h3>
            <p>APK 파일을 내려받아 설치해요. 설치할 때 '출처를 알 수 없는 앱' 허용이 필요할 수 있어요. Play 스토어 출시 전 체험판이에요.</p>
            <a className="btn btn-primary" href={SITE.apkUrl}><Download size={18} />APK 내려받기</a>
          </div>
          <div className="step3" id="pwa">
            <span className="icon"><MonitorSmartphone size={20} strokeWidth={1.75} /></span>
            <h3>웹앱 (모든 기기)</h3>
            <p>브라우저 메뉴에서 '홈 화면에 추가' 또는 '앱 설치'를 누르면 앱처럼 쓸 수 있어요. 아이폰은 Safari 공유 버튼 → 홈 화면에 추가.</p>
            {installEvt
              ? <button className="btn btn-primary" onClick={() => installEvt.prompt()}>이 기기에 설치하기</button>
              : <Link className="btn btn-secondary" to="/app">웹앱 열기</Link>}
          </div>
          <div className="step3">
            <span className="icon"><img src={`${base}icon.svg`} alt="" width={28} height={28} /></span>
            <h3>로고·아이콘</h3>
            <p>거래노트 로고와 앱 아이콘 파일이에요.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a className="btn btn-secondary btn-sm" href={`${base}icon-512.png`} download="georaenote-icon-512.png">아이콘 PNG</a>
              <a className="btn btn-secondary btn-sm" href={`${base}icon.svg`} download="georaenote-icon.svg">아이콘 SVG</a>
              <a className="btn btn-secondary btn-sm" href={`${base}logo.svg`} download="georaenote-logo.svg">로고 SVG</a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const TERMS: Record<string, [string, string]> = {
  service: ['서비스 이용약관', `제1조 (목적)\n이 약관은 ${SITE.name}(이하 '회사')가 제공하는 사업대금 카드결제 대행 서비스의 이용 조건과 절차를 정합니다.\n\n제2조 (서비스 내용)\n회사는 회원이 등록한 실제 거래의 대금을 회원의 신용카드로 결제받고, 제휴 전자지급결제대행사를 통해 회원이 지정한 거래처 계좌로 지급합니다.\n\n제3조 (이용료)\n이용료는 송금 방식에 따라 송금액의 일정 비율로 부과되며, 결제 금액에 포함됩니다.\n\n※ 이 문서는 체험판용 초안입니다. 출시 전 법무 검토를 거친 정식 약관으로 바꿔야 합니다.`],
  privacy: ['개인정보 처리 안내', '1. 수집 항목: 이름, 생년월일, 휴대폰 번호, 통신사, 거래처 계좌 정보, 증빙서류\n2. 이용 목적: 본인 확인, 계약 심사, 결제 및 송금 처리, 고객 상담\n3. 보유 기간: 회원 탈퇴 시까지(관계 법령에 따라 보존이 필요한 정보는 해당 기간까지)\n\n※ 체험판에서는 입력한 정보가 이 브라우저에만 저장되고 외부로 전송되지 않습니다.'],
  marketing: ['마케팅 정보 수신 동의', '이벤트, 혜택, 무이자 할부 소식을 앱 알림과 문자로 받아볼 수 있어요. 동의하지 않아도 서비스는 그대로 이용할 수 있어요.'],
}

export function TermsPage() {
  const { kind = 'service' } = useParams()
  const [title, body] = TERMS[kind] ?? TERMS.service
  return (
    <>
      <PageHead title={title} />
      <div className="container"><div className="prose">{body}</div></div>
    </>
  )
}
