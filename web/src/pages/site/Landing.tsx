import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CreditCard, FileCheck2, Landmark, ShieldCheck } from 'lucide-react'
import FeeCalculator from '../../components/FeeCalculator'
import { FaqList } from '../../components/ui'
import { FAQS } from '../../data/content'

/** 히어로 오른쪽 제품 미리보기: 내 카드 → 거래처 계좌 입금 영수증 */
function FlowPreview() {
  return (
    <div className="flow-panel" aria-label="카드로 결제하고 거래처 계좌로 입금되는 예시">
      <div className="label">내 카드로 결제 · 3개월 할부</div>
      <div className="paycard">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div className="chip" />
          <span style={{ fontSize: 13, color: '#dbe5f2', fontWeight: 600 }}>BUSINESS</span>
        </div>
        <div className="pan">5412 •••• •••• 3021</div>
        <div className="meta"><span>사장님 카드</span><span>결제일 25일</span></div>
      </div>
      <div className="flow-arrow">거래노트가 거래처 계좌로 송금</div>
      <div className="receipt">
        <span className="stamp">입금완료</span>
        <div className="to">한빛식자재 · 신한은행 ****6789</div>
        <div className="amount num">1,280,000<small>원</small></div>
        <div className="rows">
          <div><span>송금자명</span><span>바다횟집</span></div>
          <div><span>송금 방식</span><span>예약송금 · 11월 15일</span></div>
          <div><span>카드 청구액</span><span className="num">1,324,800원</span></div>
        </div>
      </div>
    </div>
  )
}

const USES = [
  { title: '매출 정산은 아직인데\n거래처 입금일이 먼저 왔을 때', body: '사업대금은 카드로 결제하고, 카드 결제일까지 현금을 쥐고 있을 수 있어요.' },
  { title: '큰 대금을 한 번에\n내기 부담스러울 때', body: '최대 12개월 할부로 나눠 내고, 여러 장의 카드로 나눠 결제할 수도 있어요.' },
  { title: '거래처는 계좌이체만 받는데\n카드로 내고 싶을 때', body: '나는 카드로 결제하고, 거래처는 평소처럼 계좌로 입금받아요.' },
]

const FACTS = [
  { v: '최대 12개월', l: '할부 결제' },
  { v: '카드 3장', l: '나눠서 결제' },
  { v: '영업일 1일', l: '안에 계약 검토' },
  { v: '바로송금', l: '누르는 즉시 입금' },
]

const DOCS = [
  { title: '물품·식자재·음료', body: '도매 사입, 식자재, 포장재, 비주류 음료 매입대금', proof: '거래명세서 또는 세금계산서' },
  { title: '임대료·보증금·관리비', body: '매장·사무실·창고 월세와 보증금, 상가 관리비', proof: '임대차계약서 또는 고지서' },
  { title: '수리·인테리어', body: '시공, 설비 수리, 간판 제작 같은 사업장 공사비', proof: '견적서 또는 공사계약서' },
]

export default function Landing() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="enter">
            <p className="eyebrow">소상공인 사업대금 카드결제</p>
            <h1>거래처에 보낼 현금이<br />부족할 땐 <em>카드로</em></h1>
            <p className="lead">
              물품대금, 식자재, 월세처럼 계좌이체로만 내던 사업대금을 카드로 결제하세요.
              거래노트가 거래처 계좌로 대신 입금해 드려요.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/app">사업대금 카드결제 시작 <ArrowRight size={18} /></Link>
              <a className="btn btn-secondary" href="#calc">수수료 계산해보기</a>
            </div>
            <p className="hero-note">본인·자사 계좌로는 송금할 수 없어요</p>
          </div>
          <FlowPreview />
        </div>
      </section>

      <section className="section alt">
        <div className="container">
          <div className="split-head">
            <div className="section-head">
              <p className="kicker">이럴 때 쓰세요</p>
              <h2>통장에 현금이 없는데<br />거래처에는 당장 보내야 한다면</h2>
              <p>여기저기 돈 빌리지 말고, 카드 결제일까지 여유를 만드세요.</p>
            </div>
            <img className="split-photo" src={`${import.meta.env.BASE_URL}img/banner-shop.webp`} alt="아침에 식자재 납품을 확인하는 식당 사장님" loading="lazy" />
          </div>
          <div className="use-grid">
            {USES.map((u, i) => (
              <Link key={i} to="/guide" className="use-card">
                <span className="no">0{i + 1}</span>
                <h3 style={{ whiteSpace: 'pre-line' }}>{u.title}</h3>
                <p>{u.body}</p>
              </Link>
            ))}
          </div>
          <div className="facts" style={{ marginTop: 24 }}>
            {FACTS.map((f) => <div key={f.l} className="fact"><strong>{f.v}</strong><span>{f.l}</span></div>)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <p className="kicker">결제 방식</p>
            <h2>나는 카드로 결제하고<br />거래처는 계좌로 입금받고</h2>
            <p>거래처에 입금일을 늦춰 달라고 부탁하지 않아도 돼요.</p>
          </div>
          <div className="steps3">
            <div className="step3"><span className="icon"><CreditCard size={20} strokeWidth={1.75} /></span><h3>내 카드로 결제</h3><p>원하는 카드와 할부 개월을 골라 결제해요. 여러 카드로 나눌 수도 있어요.</p></div>
            <div className="step3"><span className="icon"><ShieldCheck size={20} strokeWidth={1.75} /></span><h3>제휴 PG사가 결제 처리</h3><p>등록된 전자지급결제대행사를 통해 결제와 정산이 이뤄져요.</p></div>
            <div className="step3"><span className="icon"><Landmark size={20} strokeWidth={1.75} /></span><h3>거래처 계좌로 입금</h3><p>바로송금은 즉시, 예약송금은 정한 날짜에 거래처 계좌로 들어가요.</p></div>
          </div>
        </div>
      </section>

      <section className="section alt" id="documents">
        <div className="container">
          <div className="section-head">
            <p className="kicker">결제할 수 있는 대금</p>
            <h2>거래 증빙서류만 있으면<br />사업대금 대부분을 카드로</h2>
            <p>실제 거래인지 서류로 한 번 확인되면 반복해서 보낼 수 있어요.</p>
          </div>
          <div className="doc-grid">
            {DOCS.map((d) => (
              <div key={d.title} className="doc-card">
                <h3>{d.title}</h3>
                <p>{d.body}</p>
                <span className="proof"><FileCheck2 size={16} strokeWidth={1.75} />{d.proof}</span>
              </div>
            ))}
          </div>
          <p className="not-allowed">이용할 수 없는 거래: 본인·자사 계좌 송금, 증빙 없는 거래, 상품권·카드대금, 허위 거래. 주류 매입대금은 결제 요건 확인 후 열 예정이에요.</p>
        </div>
      </section>

      <section className="section" id="calc">
        <div className="container">
          <div className="section-head">
            <p className="kicker">이용료 계산</p>
            <h2>실제로 부담하는 이용료는 얼마일까</h2>
            <p>바로송금 4%, 예약송금 3.5%. 이용료의 2%는 마일리지로 돌려드려요.</p>
          </div>
          <FeeCalculator />
        </div>
      </section>

      <section className="section alt">
        <div className="container">
          <div className="section-head">
            <p className="kicker">이용 순서</p>
            <h2>가입하고 계약만 등록하면 준비 끝</h2>
          </div>
          <ol className="howto">
            {[
              ['본인인증', '휴대폰 본인인증 한 번으로 가입해요.'],
              ['계약 등록', '거래처 계좌와 거래명세서·임대차계약서 같은 증빙을 올려요.'],
              ['검토·승인', '영업일 기준 1일 안에 검토가 끝나요.'],
              ['카드 결제·송금', '금액과 송금 방식을 고르고 카드로 결제하면 거래처에 입금돼요.'],
            ].map(([t, b], i) => (
              <li key={t}><span className="n">{i + 1}</span><h3>{t}</h3><p>{b}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 860 }}>
          <div className="section-head center">
            <p className="kicker">자주 묻는 질문</p>
            <h2>사장님들이 많이 물어보세요</h2>
          </div>
          <FaqList items={FAQS.filter((f) => ['거래노트는 누가 이용할 수 있나요?', '계약 등록 후 승인까지 얼마나 걸리나요?', '어떤 서류를 내야 하나요?', '이용료는 얼마인가요?', '여러 건을 한 번에 결제할 수 있나요?', '여러 카드로 나눠 결제할 수 있나요?'].includes(f.question))} />
          <p style={{ textAlign: 'center', marginTop: 24 }}>
            <Link className="link" to="/support?tab=faq">더 궁금한 점 전체보기 <ArrowUpRight size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /></Link>
          </p>
        </div>
      </section>

      <section className="container">
        <div className="cta-band">
          <div>
            <h2>사업대금 결제부터 내역 관리까지</h2>
            <p>웹에서 바로 시작하거나, 안드로이드 앱이나 아이폰 홈 화면에 설치해서 쓰세요.</p>
          </div>
          <div className="actions">
            <Link className="btn btn-on-dark" to="/app">웹에서 시작하기</Link>
            <Link className="btn btn-outline-light" to="/install">앱 설치 (안드로이드 · 아이폰)</Link>
          </div>
        </div>
      </section>
    </>
  )
}
