import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BadgeCheck, ChevronDown, FileText, Paperclip, X } from 'lucide-react'
import { AppPage } from '../../components/Layouts'
import { Confirm, Kv, ListPicker, StatusPill, TypeBadge } from '../../components/ui'
import { BANKS, CONTRACT_TYPES, ContractType, maskAccount } from '../../lib/model'
import { deleteContract, emptyDraft, submitContract, useStore } from '../../lib/store'
import { date, won } from '../../lib/format'

const STEPS = 4

function StepBar({ step }: { step: number }) {
  return <div className="stepbar" aria-label={`${step + 1}/${STEPS} 단계`}>{Array.from({ length: STEPS }, (_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
}

/** 계약 등록: 유형 → 거래처·계좌(·주소) → 송금자명 → 증빙 → 완료 */
export function ContractNew() {
  const { user } = useStore()
  const [step, setStep] = useState(0)
  const [d, setD] = useState(() => ({ ...emptyDraft(), senderName: user?.name ?? '' }))
  const [verified, setVerified] = useState(false)
  const [bankOpen, setBankOpen] = useState(false)
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const type = d.type ? CONTRACT_TYPES[d.type] : null
  const up = (patch: Partial<typeof d>) => setD({ ...d, ...patch })

  if (done) {
    return (
      <AppPage title="계약 등록" narrow>
        <div className="result-head">
          <div className="mark wait"><FileText size={30} strokeWidth={1.75} /></div>
          <h2>계약 등록 완료</h2>
          <p>검토 처리 이후 사용할 수 있어요. 검토에는 영업일 기준 최대 1일이 걸려요</p>
          <p style={{ marginTop: 12 }}><span className="pill pill-info">체험판: 약 10초 뒤 자동 승인돼요</span></p>
        </div>
        <Link className="btn btn-primary btn-block" to="/app">확인</Link>
      </AppPage>
    )
  }

  const payeeOk = d.payeeName.trim() && d.bank && d.account.length >= 8 && d.holder.trim() && (!type?.needsAddress || d.address.trim()) && verified
  const canNext = [!!d.type, !!payeeOk, !!d.senderName.trim(), d.proofs.length > 0][step]

  const next = () => {
    if (step < STEPS - 1) setStep(step + 1)
    else { submitContract(d); setDone(true) }
  }

  return (
    <AppPage title="계약 등록" back={step === 0 ? '/app' : undefined} narrow>
      <StepBar step={step} />
      <form onSubmit={(e) => { e.preventDefault(); if (canNext) next() }}>
        {step === 0 && (
          <>
            <h2 className="step-title">계약 유형을 선택해 주세요</h2>
            <p className="step-sub">거래 유형에 따라 필요한 증빙서류가 달라요</p>
            <div className="choice-grid">
              {(Object.keys(CONTRACT_TYPES) as ContractType[]).map((k) => (
                <button type="button" key={k} className="choice" aria-pressed={d.type === k} onClick={() => up({ type: k })}>
                  <TypeBadge type={k} size={44} />
                  {CONTRACT_TYPES[k].label}
                  <small>{CONTRACT_TYPES[k].hint}</small>
                </button>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 16 }}>주류 매입대금은 결제 요건 확인 후 열릴 예정이에요</p>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="step-title">{type?.needsAddress ? '거래처와 주소를 입력해 주세요' : '거래처 정보를 입력해 주세요'}</h2>
            <p className="step-sub">대금이 입금될 거래처 계좌예요</p>
            <div className="form-stack">
              <label className="field"><span>거래처명(상호)</span><input className="input" value={d.payeeName} onChange={(e) => up({ payeeName: e.target.value.slice(0, 30) })} placeholder="예) 한빛식자재" /></label>
              <div className="field">
                <span>은행</span>
                <button type="button" className="input" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: d.bank ? undefined : 'var(--muted)' }} onClick={() => setBankOpen(true)}>
                  {d.bank || '은행 선택'}<ChevronDown size={18} />
                </button>
              </div>
              <label className="field"><span>계좌번호</span><input className="input num" inputMode="numeric" value={d.account} onChange={(e) => { up({ account: e.target.value.replace(/\D/g, '').slice(0, 16) }); setVerified(false) }} placeholder="'-' 없이 숫자만" /></label>
              <div className="field">
                <span>예금주</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" value={d.holder} onChange={(e) => { up({ holder: e.target.value.slice(0, 20) }); setVerified(false) }} placeholder="예금주명" />
                  <button type="button" className={`btn ${verified ? 'btn-secondary' : 'btn-primary'}`} disabled={!d.bank || d.account.length < 8 || !d.holder.trim()} onClick={() => setVerified(true)}>
                    {verified ? <><BadgeCheck size={18} color="var(--paid)" />확인됨</> : '계좌 확인'}
                  </button>
                </div>
                {verified && <span className="hint paid">체험판: 예금주 조회를 통과한 것으로 처리했어요</span>}
              </div>
              {type?.needsAddress && (
                <>
                  <label className="field"><span>사업장 주소</span><input className="input" value={d.address} onChange={(e) => up({ address: e.target.value.slice(0, 60) })} placeholder="예) 서울시 중구 세종대로 1" /></label>
                  <input className="input" aria-label="상세주소" value={d.addressDetail} onChange={(e) => up({ addressDetail: e.target.value.slice(0, 40) })} placeholder="상세주소" />
                </>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="step-title">송금자명을 입력해 주세요</h2>
            <p className="step-sub">거래 상대 계좌에 찍힐 이름이에요</p>
            <label className="field"><span>송금자명</span><input className="input" value={d.senderName} onChange={(e) => up({ senderName: e.target.value.slice(0, 10) })} placeholder="예) 바다횟집" /></label>
            <p className="hint">상호명이나 대표자명처럼 거래처가 알아볼 수 있는 이름이 좋아요. 최대 10자</p>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="step-title">증빙서류를 첨부해 주세요</h2>
            <p className="step-sub">{type?.label} 계약은 {type?.proof}가 필요해요</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {d.proofs.map((p) => (
                <div key={p} className="file-row"><FileText size={18} color="var(--navy)" /><span>{p}</span>
                  <button type="button" aria-label={`${p} 삭제`} onClick={() => up({ proofs: d.proofs.filter((x) => x !== p) })}><X size={16} /></button>
                </div>
              ))}
              {d.proofs.length < 5 && (
                <>
                  <label className="drop">
                    <Paperclip size={18} />사진 또는 PDF 첨부
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => {
                      const names = Array.from(e.target.files ?? []).map((f) => f.name)
                      up({ proofs: Array.from(new Set([...d.proofs, ...names])).slice(0, 5) })
                      if (fileRef.current) fileRef.current.value = ''
                    }} />
                  </label>
                  <button type="button" className="link" style={{ border: 0, background: 'none', justifySelf: 'start', padding: '4px 0' }}
                    onClick={() => up({ proofs: Array.from(new Set([...d.proofs, `샘플_${type?.proof.split(' ')[0]}.pdf`])) })}>
                    체험용 샘플 서류로 진행하기
                  </button>
                </>
              )}
              <p className="hint">최대 5개까지 첨부할 수 있어요. 체험판에서는 파일 이름만 이 브라우저에 저장되고 외부로 전송되지 않아요</p>
            </div>
          </>
        )}

        <div className="form-foot">
          {step > 0 && <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)}>이전</button>}
          <button className="btn btn-primary" disabled={!canNext}>{step === STEPS - 1 ? '등록하기' : '다음'}</button>
        </div>
      </form>
      {bankOpen && <ListPicker title="은행 선택" options={BANKS} onClose={() => setBankOpen(false)} onPick={(b) => { up({ bank: b }); setVerified(false); setBankOpen(false) }} />}
    </AppPage>
  )
}

export function ContractDetail() {
  const { id } = useParams()
  const s = useStore()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const c = s.contracts.find((x) => x.id === id)
  if (!c) return <AppPage title="계약 정보" back="/app"><p className="empty">계약을 찾을 수 없어요</p></AppPage>
  const used = s.transfers.filter((t) => t.contractId === c.id && t.status !== 'CANCELED')
  return (
    <AppPage title="계약 정보" back="/app" narrow>
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <TypeBadge type={c.type} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}><small className="muted">{CONTRACT_TYPES[c.type].label}</small><div style={{ fontWeight: 600, fontSize: 18 }}>{c.title}</div></div>
        <StatusPill status={c.status} />
      </div>
      <dl className="card" style={{ margin: '12px 0 0' }}>
        <Kv k="거래처" v={c.payeeName} />
        <Kv k="입금 계좌" v={`${c.bank} ${maskAccount(c.account)}`} />
        <Kv k="예금주" v={c.holder} />
        <Kv k="송금자명" v={c.senderName} />
        {c.address && <Kv k="주소" v={c.address} />}
        <Kv k="등록일" v={date(c.createdAt)} />
      </dl>
      <div className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>증빙서류</h3>
        {c.proofs.map((p) => <div key={p} className="sub" style={{ fontSize: 14, padding: '2px 0' }}>{p}</div>)}
      </div>
      <div className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600 }}>이 계약으로 보낸 송금 {used.length}건</h3>
        {used.slice(0, 5).map((t) => (
          <Link key={t.id} to={`/app/transfers/${t.id}`} className="list-row" style={{ padding: '10px 0' }}><span className="d">{date(t.createdAt)}</span><span className="t" style={{ textAlign: 'right' }}>{won(t.amount)}</span></Link>
        ))}
      </div>
      <div className="form-foot">
        <button className="btn btn-secondary" onClick={() => setConfirm(true)}>삭제</button>
        <button className="btn btn-primary" disabled={c.status !== 'APPROVED'} onClick={() => navigate(`/app/transfer/${c.id}`)}>송금하기</button>
      </div>
      {confirm && <Confirm title="계약을 삭제할까요" body="삭제한 계약은 되돌릴 수 없어요. 송금 내역은 그대로 남아요." confirmLabel="삭제" danger onClose={() => setConfirm(false)} onConfirm={() => { deleteContract(c.id); navigate('/app') }} />}
    </AppPage>
  )
}
