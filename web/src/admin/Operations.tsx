import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileText, Search, X } from 'lucide-react'
import { adb, arpc, CONTRACT_STATUS, dt, Staff, TRANSFER_STATUS, TYPE_LABEL, useQuery, won } from './api'
import { toast } from '../components/ui'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

function Head({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return <header className="adm-head"><div><h1>{title}</h1>{sub && <p className="sub">{sub}</p>}</div>{children}</header>
}

function Filters({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="chips" role="group">
      {options.map(([v, l]) => <button key={v} className="chip" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  )
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="search" style={{ minWidth: 240 }}>
      <span className="sr-only">검색</span>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ height: 40 }} />
      <Search size={16} />
    </label>
  )
}

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="adm-drawer-bg" onClick={onClose}>
      <aside className="adm-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <header><h2>{title}</h2><button aria-label="닫기" onClick={onClose}><X size={18} /></button></header>
        <div className="body">{children}</div>
      </aside>
    </div>
  )
}

const Kv = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="kv"><dt>{k}</dt><dd>{v}</dd></div>

// ---------------- 계약 심사 ----------------
export function ContractsPage({ staff }: { staff: Staff }) {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'REVIEW'
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Row | null>(null)
  const list = useQuery(async () => {
    let query = adb!.from('contracts').select('*, profiles(name, nickname, phone, business_name), contract_documents(id, file_name, storage_path)').order('created_at', { ascending: status === 'REVIEW' }).limit(300)
    if (status !== 'ALL') query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    return data as Row[]
  }, [status])
  const rows = (list.data ?? []).filter((r) => !q || `${r.title} ${r.profiles?.name} ${r.profiles?.business_name} ${r.holder}`.includes(q))

  return (
    <div className="adm-page">
      <Head title="계약 심사" sub="증빙서류를 확인하고 승인하거나 반려해요. 승인된 계약만 송금할 수 있어요">
        <SearchBox value={q} onChange={setQ} placeholder="거래처, 상호, 예금주" />
      </Head>
      <Filters value={status} onChange={(v) => setParams({ status: v })} options={[['REVIEW', '검토중'], ['APPROVED', '승인'], ['REJECTED', '반려'], ['SUSPENDED', '정지'], ['ALL', '전체']]} />
      <div className="adm-card adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>등록일</th><th>사장님</th><th>계약</th><th>입금 계좌</th><th>증빙</th><th>상태</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => setOpen(r)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(r)}>
                <td className="num muted">{dt(r.created_at)}</td>
                <td>{r.profiles?.business_name ?? r.profiles?.nickname ?? '-'}<small>{r.profiles?.name ?? '본인인증 전'}</small></td>
                <td>{r.title}<small>{TYPE_LABEL[r.type]}</small></td>
                <td>{r.bank}<small className="num">{r.account} · {r.holder}</small></td>
                <td className="num">{r.contract_documents?.length ?? 0}개</td>
                <td><span className={`pill ${CONTRACT_STATUS[r.status].cls}`}>{CONTRACT_STATUS[r.status].label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.loading && !rows.length && <p className="empty">해당하는 계약이 없어요</p>}
      </div>
      {open && <ContractDrawer row={open} staff={staff} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); list.reload() }} />}
    </div>
  )
}

function ContractDrawer({ row, staff, onClose, onChanged }: { row: Row; staff: Staff; onClose: () => void; onChanged: () => void }) {
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const history = useQuery(async () => {
    const { data } = await adb!.from('contract_reviews').select('*').eq('contract_id', row.id).order('created_at')
    return (data ?? []) as Row[]
  }, [row.id])
  const canReview = staff.role !== 'VIEWER'
  // 계좌번호는 암호화돼 있어 평소엔 가린 번호만 보여요. 전체 번호를 보면 감사 기록이 남아요
  const [full, setFull] = useState<string | null>(null)
  const openDoc = async (path: string | null, name: string) => {
    if (!path) { toast(`${name}은(는) 체험용 샘플 서류예요`); return }
    const { data, error } = await adb!.storage.from('proofs').createSignedUrl(path, 120)
    if (error || !data) { toast('파일을 열지 못했어요'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }
  const act = (fn: string, args: Record<string, unknown>) => {
    setBusy(true)
    arpc(fn, args).then(() => { toast('처리했어요'); onChanged() }).catch((e: Error) => toast(e.message)).finally(() => setBusy(false))
  }
  return (
    <Drawer title={row.title} onClose={onClose}>
      <span className={`pill ${CONTRACT_STATUS[row.status].cls}`}>{CONTRACT_STATUS[row.status].label}</span>
      <dl>
        <Kv k="사장님" v={`${row.profiles?.name ?? '-'} · ${row.profiles?.business_name ?? ''}`} />
        <Kv k="연락처" v={row.profiles?.phone} />
        <Kv k="계약 유형" v={TYPE_LABEL[row.type]} />
        <Kv k="거래처" v={row.payee_name} />
        <Kv k="입금 계좌" v={<>{row.bank} {full ?? row.account}{!full && canReview && <button type="button" className="link" style={{ border: 0, background: 'none', marginLeft: 8 }} onClick={() => arpc<string>('admin_reveal_account', { p_contract_id: row.id }).then(setFull).catch((e: Error) => toast(e.message))}>전체 번호 보기</button>}</>} />
        <Kv k="예금주" v={row.holder} />
        <Kv k="송금자명" v={row.sender_name} />
        {row.address && <Kv k="주소" v={row.address} />}
        <Kv k="등록" v={dt(row.created_at)} />
        {row.reject_reason && <Kv k="반려·정지 사유" v={row.reject_reason} />}
      </dl>
      <h3 className="adm-sub">증빙서류</h3>
      <div style={{ display: 'grid', gap: 6 }}>
        {(row.contract_documents ?? []).map((d: Row) => (
          <button key={d.id} className="file-row" style={{ border: 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => openDoc(d.storage_path, d.file_name)}>
            <FileText size={16} /><span>{d.file_name}</span><small className="muted">{d.storage_path ? '열기' : '샘플'}</small>
          </button>
        ))}
      </div>
      <p className="hint">예금주와 증빙서류의 상호·금액이 맞는지, 본인·가족 계좌가 아닌지 확인하세요.</p>
      {canReview && row.status === 'REVIEW' && (
        <>
          <label className="field"><span>메모 · 반려 사유</span><textarea className="input" style={{ height: 80, paddingTop: 10 }} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="반려할 때 사장님께 보일 사유" /></label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" disabled={busy} onClick={() => act('admin_review_contract', { p_id: row.id, p_approve: false, p_memo: memo })}>반려</button>
            <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={() => act('admin_review_contract', { p_id: row.id, p_approve: true, p_memo: memo || null })}>승인</button>
          </div>
        </>
      )}
      {canReview && row.status === 'APPROVED' && (
        <button className="btn btn-secondary" disabled={busy} onClick={() => { const m = prompt('정지 사유'); if (m) act('admin_suspend_contract', { p_id: row.id, p_memo: m }) }}>이 계약 정지</button>
      )}
      <h3 className="adm-sub">심사 이력</h3>
      {(history.data ?? []).map((h) => <div key={h.id} className="adm-log"><span className="num muted">{dt(h.created_at)}</span>{CONTRACT_STATUS[h.action]?.label}{h.memo ? ` · ${h.memo}` : ''}</div>)}
      {!history.data?.length && <p className="muted" style={{ fontSize: 13 }}>아직 이력이 없어요</p>}
    </Drawer>
  )
}

// ---------------- 결제·송금 ----------------
export function TransfersPage({ staff }: { staff: Staff }) {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'ALL'
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Row | null>(null)
  const list = useQuery(async () => {
    let query = adb!.from('transfers').select('*, profiles(name, nickname, business_name), card_charges(*)').order('created_at', { ascending: false }).limit(300)
    if (status !== 'ALL') query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    return data as Row[]
  }, [status])
  const rows = (list.data ?? []).filter((r) => !q || `${r.payee_name} ${r.profiles?.name} ${r.profiles?.business_name} ${r.memo}`.includes(q))
  const sum = rows.reduce((a, r) => a + Number(r.amount), 0)

  return (
    <div className="adm-page">
      <Head title="결제·송금" sub={`표시된 ${rows.length}건 · 송금액 합계 ${won(sum)}`}>
        <SearchBox value={q} onChange={setQ} placeholder="거래처, 상호, 메모" />
      </Head>
      <Filters value={status} onChange={(v) => setParams({ status: v })} options={[['ALL', '전체'], ['WAITING_SEND', '송금 대기'], ['SCHEDULED', '예약됨'], ['COMPLETED', '완료'], ['FAILED', '실패'], ['CANCELED', '취소']]} />
      <div className="adm-card adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>결제 일시</th><th>사장님</th><th>받는 곳</th><th>방식</th><th className="r">송금액</th><th className="r">이용료</th><th>상태</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => setOpen(r)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(r)}>
                <td className="num muted">{dt(r.paid_at)}</td>
                <td>{r.profiles?.business_name ?? r.profiles?.nickname ?? '-'}<small>{r.profiles?.name ?? '본인인증 전'}</small></td>
                <td>{r.payee_name}<small>{r.bank} {r.masked_account}</small></td>
                <td>{r.method === 'INSTANT' ? '바로' : `예약 ${r.scheduled_date?.slice(5) ?? ''}`}</td>
                <td className="r num">{won(r.amount)}</td>
                <td className="r num muted">{won(r.fee)}</td>
                <td><span className={`pill ${TRANSFER_STATUS[r.status].cls}`}>{TRANSFER_STATUS[r.status].label}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.loading && !rows.length && <p className="empty">해당하는 송금이 없어요</p>}
      </div>
      {open && <TransferDrawer row={open} staff={staff} onClose={() => setOpen(null)} onChanged={() => { setOpen(null); list.reload() }} />}
    </div>
  )
}

function TransferDrawer({ row, staff, onClose, onChanged }: { row: Row; staff: Staff; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const events = useQuery(async () => {
    const { data } = await adb!.from('transfer_events').select('*').eq('transfer_id', row.id).order('created_at')
    return (data ?? []) as Row[]
  }, [row.id])
  const act = (fn: string, args: Record<string, unknown>) => {
    setBusy(true)
    arpc(fn, args).then(() => { toast('처리했어요'); onChanged() }).catch((e: Error) => toast(e.message)).finally(() => setBusy(false))
  }
  const open = ['WAITING_SEND', 'SCHEDULED', 'FAILED', 'PAID', 'SENDING'].includes(row.status)
  return (
    <Drawer title={`${row.payee_name} · ${won(row.amount)}`} onClose={onClose}>
      <span className={`pill ${TRANSFER_STATUS[row.status].cls}`}>{TRANSFER_STATUS[row.status].label}</span>
      {row.needs_review && <span className={`pill ${row.review_approved_at ? 'pill-ok' : 'pill-review'}`} style={{ marginLeft: 6 }}>{row.review_approved_at ? '고액 확인됨' : '고액 · 관리자 확인 필요'}</span>}
      <dl>
        <Kv k="사장님" v={`${row.profiles?.name ?? '-'} · ${row.profiles?.business_name ?? ''}`} />
        <Kv k="받는 곳" v={`${row.bank} ${row.masked_account} (${row.holder})`} />
        <Kv k="송금자명" v={row.sender_name} />
        <Kv k="송금 방식" v={row.method === 'INSTANT' ? '바로송금' : `예약송금 · ${row.scheduled_date}`} />
        <Kv k="송금액" v={won(row.amount)} />
        <Kv k="이용료" v={`${won(row.fee)} (${row.fee_bps / 100}%)`} />
        <Kv k="카드 청구액" v={won(Number(row.amount) + Number(row.fee))} />
        <Kv k="적립 마일리지" v={`${Number(row.mileage).toLocaleString('ko-KR')}M`} />
        {row.memo && <Kv k="메모" v={row.memo} />}
        <Kv k="PG" v={`${row.pg_provider}${row.pg_payment_key ? ` · ${row.pg_payment_key}` : ''}`} />
        {row.payout_ref && <Kv k="송금 거래번호" v={row.payout_ref} />}
        {row.fail_reason && <Kv k="실패 사유" v={row.fail_reason} />}
      </dl>
      <h3 className="adm-sub">결제 카드</h3>
      {(row.card_charges ?? []).map((c: Row) => (
        <div key={c.id} className="adm-log"><span>{c.company}</span>{c.installment > 1 ? `${c.installment}개월` : '일시불'} · <b className="num">{won(c.amount)}</b><span className="muted num">{c.approval_no}</span></div>
      ))}
      {staff.role !== 'VIEWER' && open && row.needs_review && !row.review_approved_at && (
        <button className="btn btn-primary btn-sm" style={{ marginBottom: 8 }} disabled={busy} onClick={() => confirm('고액 송금을 확인했어요. 바로송금은 지금 지급되고, 예약송금은 입금일에 지급돼요') && act('admin_approve_transfer', { p_id: row.id })}>고액 송금 확인</button>
      )}
      {staff.role === 'ADMIN' && open && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { const m = prompt('실패 사유'); if (m) act('admin_mark_transfer', { p_id: row.id, p_status: 'FAILED', p_note: m }) }}>실패로 표시</button>
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => confirm('카드 결제를 취소할까요?') && act('cancel_transfer', { p_id: row.id })}>결제 취소</button>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => confirm('거래처에 지급을 마친 것으로 처리할까요?') && act('admin_mark_transfer', { p_id: row.id, p_status: 'COMPLETED', p_note: '관리자 수동 지급 처리' })}>지급 완료로 처리</button>
        </div>
      )}
      <h3 className="adm-sub">처리 이력</h3>
      {(events.data ?? []).map((e) => <div key={e.id} className="adm-log"><span className="num muted">{dt(e.created_at)}</span>{TRANSFER_STATUS[e.status]?.label}{e.note ? ` · ${e.note}` : ''}</div>)}
    </Drawer>
  )
}

// ---------------- 회원 ----------------
export function UsersPage({ staff }: { staff: Staff }) {
  const [q, setQ] = useState('')
  const list = useQuery(async () => {
    const { data, error } = await adb!.from('profiles').select('*, transfers(amount, status, paid_at), contracts(id)').order('created_at', { ascending: false }).limit(500)
    if (error) throw error
    return data as Row[]
  })
  const rows = useMemo(() => (list.data ?? [])
    .map((p) => {
      const done = (p.transfers ?? []).filter((t: Row) => t.status !== 'CANCELED')
      return { ...p, gmv: done.reduce((a: number, t: Row) => a + Number(t.amount), 0), cnt: done.length, last: done.map((t: Row) => t.paid_at).sort().pop() as string | undefined } as Row
    })
    .filter((p) => !q || `${p.name} ${p.phone} ${p.business_name}`.includes(q)), [list.data, q])

  const toggle = (p: Row) => {
    arpc('admin_set_user_suspended', { p_user: p.id, p_suspended: !p.suspended }).then(() => { toast('처리했어요'); list.reload() }).catch((e: Error) => toast(e.message))
  }
  return (
    <div className="adm-page">
      <Head title="회원" sub={`${rows.length}명`}><SearchBox value={q} onChange={setQ} placeholder="이름, 번호, 상호" /></Head>
      <div className="adm-card adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>가입</th><th>사장님</th><th>연락처</th><th className="r">계약</th><th className="r">송금</th><th className="r">누적 송금액</th><th>최근 결제</th><th /></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} style={{ cursor: 'default' }}>
                <td className="num muted">{dt(p.created_at).slice(0, 10)}</td>
                <td>{p.business_name ?? p.nickname}<small>{p.name ?? '본인인증 전'}{p.is_demo ? ' · 데모' : ''}{p.auth_provider ? ` · ${p.auth_provider}` : ''}</small></td>
                <td className="num">{p.phone ?? '-'}</td>
                <td className="r num">{p.contracts?.length ?? 0}</td>
                <td className="r num">{p.cnt}</td>
                <td className="r num">{won(p.gmv)}</td>
                <td className="num muted">{p.last ? dt(p.last).slice(0, 10) : '-'}</td>
                <td>{staff.role === 'ADMIN' && <button className="btn btn-ghost btn-sm" onClick={() => toggle(p)}>{p.suspended ? '정지 해제' : '이용 정지'}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.loading && !rows.length && <p className="empty">회원이 없어요</p>}
      </div>
    </div>
  )
}
