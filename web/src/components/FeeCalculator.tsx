import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fee, Method, METHODS, mileageOf, rateText, MAX_AMOUNT } from '../lib/model'
import { digits, mileage, num, won } from '../lib/format'
import { Kv } from './ui'

/** 이체 수수료 계산기: 이체금액과 방식을 고르면 카드 청구액·적립 마일리지·실제 부담 이용료를 보여줍니다. */
export default function FeeCalculator() {
  const [amountText, setAmountText] = useState('1000000')
  const [method, setMethod] = useState<Method>('SCHEDULED')
  const amount = Math.min(Number(amountText || 0), MAX_AMOUNT)
  const f = fee(amount, method)
  const m = mileageOf(f)

  return (
    <div className="calc">
      <div className="calc-input">
        <h3>이체 조건</h3>
        <label className="field">
          <span>이체금액</span>
          <div className="input-wrap">
            <input
              className="input num"
              inputMode="numeric"
              value={amountText ? num(Number(amountText)) : ''}
              onChange={(e) => setAmountText(digits(e.target.value, 8))}
              placeholder="보낼 금액"
              aria-label="이체금액"
            />
            <span className="suffix">원</span>
          </div>
        </label>
        <div className="quick-amounts">
          {[100000, 500000, 1000000, 5000000].map((v) => (
            <button key={v} onClick={() => setAmountText(String(v))}>{v >= 10000 ? `${v / 10000}만원` : won(v)}</button>
          ))}
        </div>
        <div className="field">
          <span>이체방법</span>
          <div className="seg">
            {(['INSTANT', 'SCHEDULED'] as Method[]).map((k) => (
              <button key={k} aria-pressed={method === k} onClick={() => setMethod(k)}>
                {METHODS[k].label} {rateText(k)}
                <small>{METHODS[k].short}</small>
              </button>
            ))}
          </div>
        </div>
        {Number(amountText) > MAX_AMOUNT && <p className="hint error" style={{ margin: 0 }}>1회 최대 2,000만 원까지 보낼 수 있어요</p>}
      </div>
      <div className="calc-out" aria-live="polite">
        <h3>카드 청구액</h3>
        <div className="big">{won(amount + f)}</div>
        <dl style={{ margin: 0 }}>
          <Kv k="거래처 입금액" v={won(amount)} />
          <Kv k={`이용료 ${rateText(method)}`} v={won(f)} />
          <Kv k="마일리지 적립 · 이용료의 2%" v={<span className="paid">{mileage(m)}</span>} />
          <Kv k="실제 부담 이용료" v={won(f - m)} total />
        </dl>
        <p className="hint" style={{ margin: '12px 0 16px' }}>마일리지는 카드 청구액에서 바로 빠지지 않고, 송금 완료 후 적립돼요</p>
        <Link className="btn btn-primary" to="/app">이 조건으로 결제 시작</Link>
      </div>
    </div>
  )
}
