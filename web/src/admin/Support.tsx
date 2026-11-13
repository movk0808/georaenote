import { useEffect, useState } from 'react'
import { adb, arpc, dt, Staff, useQuery } from './api'
import { toast } from '../components/ui'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const Head = ({ title, sub }: { title: string; sub?: string }) => <header className="adm-head"><div><h1>{title}</h1>{sub && <p className="sub">{sub}</p>}</div></header>

// ---------------- 1:1 문의 ----------------
export function InquiriesPage() {
  const list = useQuery(async () => {
    const { data, error } = await adb!.from('inquiries').select('*, profiles(name, business_name, phone)').order('created_at', { ascending: false }).limit(200)
    if (error) throw error
    return data as Row[]
  })
  const [draft, setDraft] = useState<Record<string, string>>({})
  const send = (id: string) => {
    arpc('admin_answer_inquiry', { p_id: id, p_answer: draft[id] }).then(() => { toast('답변을 저장했어요'); list.reload() }).catch((e: Error) => toast(e.message))
  }
  const rows = list.data ?? []
  return (
    <div className="adm-page">
      <Head title="1:1 문의" sub={`답변 대기 ${rows.filter((r) => r.status === 'OPEN').length}건 · 앱·웹 고객센터 채팅에서 남긴 문의예요`} />
      <div style={{ display: 'grid', gap: 12 }}>
        {rows.map((r) => (
          <div key={r.id} className="adm-card">
            <div className="adm-card-head">
              <div><strong style={{ fontWeight: 600 }}>{r.profiles?.business_name ?? r.profiles?.name}</strong> <span className="muted" style={{ fontSize: 13 }}>{r.profiles?.name} · {r.profiles?.phone}</span></div>
              <span className={`pill ${r.status === 'OPEN' ? 'pill-review' : 'pill-ok'}`}>{r.status === 'OPEN' ? '답변 대기' : '답변 완료'}</span>
            </div>
            <p style={{ margin: '0 0 4px', whiteSpace: 'pre-line' }}>{r.message}</p>
            <span className="muted num" style={{ fontSize: 12 }}>{dt(r.created_at)}</span>
            {r.answer
              ? <div className="notice-box" style={{ marginTop: 12 }}>{r.answer}</div>
              : (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <input className="input" style={{ height: 40 }} value={draft[r.id] ?? ''} onChange={(e) => setDraft({ ...draft, [r.id]: e.target.value })} placeholder="답변 입력" />
                  <button className="btn btn-primary btn-sm" style={{ height: 40 }} disabled={!draft[r.id]?.trim()} onClick={() => send(r.id)}>답변</button>
                </div>
              )}
          </div>
        ))}
        {!list.loading && !rows.length && <p className="empty">문의가 없어요</p>}
      </div>
    </div>
  )
}

// ---------------- 후기 ----------------
export function ReviewsPage() {
  const list = useQuery(async () => {
    const { data, error } = await adb!.from('reviews').select('*, profiles(name, business_name)').order('created_at', { ascending: false }).limit(300)
    if (error) throw error
    return data as Row[]
  })
  const setStatus = async (id: string, status: string) => {
    const { error } = await adb!.from('reviews').update({ status }).eq('id', id)
    if (error) toast(error.message); else list.reload()
  }
  return (
    <div className="adm-page">
      <Head title="후기" sub="공개한 후기만 사이트와 앱에 보여요" />
      <div className="adm-card adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>작성</th><th>사장님</th><th>별점</th><th>내용</th><th>상태</th><th /></tr></thead>
          <tbody>
            {(list.data ?? []).map((r) => (
              <tr key={r.id} style={{ cursor: 'default' }}>
                <td className="num muted">{dt(r.created_at).slice(0, 10)}</td>
                <td>{r.profiles?.business_name ?? '-'}<small>{r.profiles?.name}</small></td>
                <td className="num">{'★'.repeat(r.rating)}<span className="muted">{'★'.repeat(5 - r.rating)}</span></td>
                <td style={{ maxWidth: 420, whiteSpace: 'normal' }}>{r.body}</td>
                <td><span className={`pill ${r.status === 'PUBLISHED' ? 'pill-ok' : r.status === 'PENDING' ? 'pill-review' : 'pill-neutral'}`}>{r.status === 'PUBLISHED' ? '공개' : r.status === 'PENDING' ? '검토 대기' : '숨김'}</span></td>
                <td>
                  {r.status !== 'PUBLISHED' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(r.id, 'PUBLISHED')}>공개</button>}
                  {r.status !== 'HIDDEN' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(r.id, 'HIDDEN')}>숨김</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.loading && !list.data?.length && <p className="empty">후기가 없어요</p>}
      </div>
    </div>
  )
}

// ---------------- 공지사항 ----------------
export function NoticesPage() {
  const list = useQuery(async () => {
    const { data, error } = await adb!.from('notices').select('*').order('published_at', { ascending: false })
    if (error) throw error
    return data as Row[]
  })
  const [edit, setEdit] = useState<Row | null>(null)
  const save = async () => {
    if (!edit) return
    const body = { title: edit.title, body: edit.body, published: edit.published ?? true, published_at: edit.published_at ?? new Date().toISOString().slice(0, 10) }
    const { error } = edit.id ? await adb!.from('notices').update(body).eq('id', edit.id) : await adb!.from('notices').insert(body)
    if (error) { toast(error.message); return }
    toast('저장했어요'); setEdit(null); list.reload()
  }
  const remove = async (id: number) => {
    if (!confirm('이 공지를 삭제할까요?')) return
    const { error } = await adb!.from('notices').delete().eq('id', id)
    if (error) toast(error.message); else list.reload()
  }
  return (
    <div className="adm-page">
      <header className="adm-head"><div><h1>공지사항</h1><p className="sub">관리자 권한이 있어야 쓰고 고칠 수 있어요</p></div><button className="btn btn-primary btn-sm" onClick={() => setEdit({ title: '', body: '', published: true })}>새 공지</button></header>
      {edit && (
        <div className="adm-card form-stack" style={{ marginBottom: 16 }}>
          <label className="field"><span>제목</span><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
          <label className="field"><span>내용</span><textarea className="input" style={{ height: 140, paddingTop: 10 }} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></label>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="field" style={{ width: 200 }}><span>게시일</span><input className="input" type="date" value={edit.published_at ?? new Date().toISOString().slice(0, 10)} onChange={(e) => setEdit({ ...edit, published_at: e.target.value })} /></label>
            <label className="check"><input type="checkbox" checked={edit.published ?? true} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} />공개</label>
            <span style={{ flex: 1 }} />
            <button className="btn btn-secondary btn-sm" onClick={() => setEdit(null)}>닫기</button>
            <button className="btn btn-primary btn-sm" disabled={!edit.title?.trim() || !edit.body?.trim()} onClick={save}>저장</button>
          </div>
        </div>
      )}
      <div className="adm-card adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>게시일</th><th>제목</th><th>상태</th><th /></tr></thead>
          <tbody>
            {(list.data ?? []).map((n) => (
              <tr key={n.id} onClick={() => setEdit(n)}>
                <td className="num muted">{n.published_at}</td>
                <td>{n.title}</td>
                <td><span className={`pill ${n.published ? 'pill-ok' : 'pill-neutral'}`}>{n.published ? '공개' : '비공개'}</span></td>
                <td><button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); remove(n.id) }}>삭제</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------- 운영 설정 ----------------
const FIELDS: [string, string, string][] = [
  ['instant_bps', '바로송금 이용료', 'bps (400 = 4%)'],
  ['scheduled_bps', '예약송금 이용료', 'bps (350 = 3.5%)'],
  ['mileage_percent', '마일리지 적립률', '이용료의 %'],
  ['first_transfer_bonus', '첫 송금 보너스', 'M'],
  ['quiz_reward', '퀴즈 정답 적립', 'M'],
  ['min_amount', '1회 최소 송금액', '원'],
  ['max_amount', '1회 최대 송금액', '원'],
  ['max_split_cards', '분할결제 카드 수', '장'],
  ['demo_auto_approve_seconds', '데모 자동 승인', '초 (0이면 끔, 실서비스는 0)'],
  ['pg_fee_bps', 'PG 수수료율(추정)', 'bps, 대시보드 순이익 계산용'],
  ['pg_settlement_days', 'PG 정산까지 걸리는 날', '일, 자금 흐름 추정용'],
]

export function SettingsPage({ staff }: { staff: Staff }) {
  const isAdmin = staff.role === 'ADMIN'
  const settings = useQuery(async () => (await adb!.from('settings').select('*').single()).data as Row)
  const staffList = useQuery(async () => ((await adb!.from('staff').select('*').order('created_at')).data ?? []) as Row[])
  const audit = useQuery(async () => (isAdmin ? ((await adb!.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(30)).data ?? []) : []) as Row[])
  const [form, setForm] = useState<Row | null>(null)
  const [invite, setInvite] = useState({ email: '', name: '', role: 'REVIEWER' })
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (settings.data) setForm(settings.data) }, [settings.data])

  const save = async () => {
    if (!form) return
    const patch = Object.fromEntries(FIELDS.map(([k]) => [k, Number(form[k])]))
    const { error } = await adb!.from('settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', true)
    if (error) toast(error.message); else { toast('설정을 저장했어요'); settings.reload() }
  }
  const run = (fn: string, msg: (r: Row) => string) => {
    setBusy(true)
    arpc<Row>(fn).then((r) => { toast(msg(r)); audit.reload() }).catch((e: Error) => toast(e.message)).finally(() => setBusy(false))
  }

  return (
    <div className="adm-page">
      <Head title="운영 설정" sub={isAdmin ? '바꾼 값은 앱과 웹에 바로 적용돼요' : '관리자만 바꿀 수 있어요'} />
      <section className="adm-card">
        <div className="adm-card-head"><h2>이용료·한도</h2>{isAdmin && <button className="btn btn-primary btn-sm" onClick={save}>저장</button>}</div>
        <div className="adm-form-grid">
          {form && FIELDS.map(([k, l, hint]) => (
            <label key={k} className="field"><span>{l}</span>
              <input className="input num" inputMode="numeric" disabled={!isAdmin} value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value.replace(/\D/g, '') })} />
              <small className="hint">{hint}</small>
            </label>
          ))}
        </div>
      </section>

      <div className="adm-grid2">
        <section className="adm-card">
          <div className="adm-card-head"><h2>직원</h2></div>
          {(staffList.data ?? []).map((s) => (
            <div key={s.user_id} className="adm-log"><b>{s.name}</b><span className="muted">{s.email}</span><span className="pill pill-neutral">{s.role === 'ADMIN' ? '관리자' : s.role === 'REVIEWER' ? '심사자' : '조회 전용'}</span></div>
          ))}
          {isAdmin && (
            <div className="form-stack" style={{ marginTop: 16, gap: 10 }}>
              <p className="hint" style={{ margin: 0 }}>추가할 분이 먼저 관리자 페이지에서 '계정 만들기'를 해야 해요</p>
              <input className="input" placeholder="이메일" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" placeholder="이름" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
                <select className="input" style={{ width: 140 }} value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                  <option value="REVIEWER">심사자</option><option value="VIEWER">조회 전용</option><option value="ADMIN">관리자</option>
                </select>
              </div>
              <button className="btn btn-secondary btn-sm" disabled={!invite.email || !invite.name}
                onClick={() => arpc('admin_add_staff', { p_email: invite.email, p_name: invite.name, p_role: invite.role }).then(() => { toast('추가했어요'); staffList.reload() }).catch((e: Error) => toast(e.message))}>직원 추가</button>
            </div>
          )}
        </section>

        {isAdmin && (
          <section className="adm-card">
            <div className="adm-card-head"><h2>데모 데이터</h2></div>
            <p className="sub" style={{ margin: '0 0 16px', fontSize: 14 }}>대시보드와 목록을 확인할 수 있게 가상 사장님 36명과 최근 90일 결제를 만들어요. 실제 회원 데이터는 건드리지 않고, 지우기로 데모 데이터만 지울 수 있어요.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run('admin_seed_demo', (r) => `데모 데이터를 만들었어요(송금 ${r.transfers}건)`)}>데모 데이터 만들기</button>
              <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => confirm('데모 데이터를 모두 지울까요?') && run('admin_clear_demo', (r) => `데모 회원 ${r.users}명을 지웠어요`)}>데모 데이터 지우기</button>
            </div>
            <h3 className="adm-sub">최근 작업 기록</h3>
            {(audit.data ?? []).map((a) => <div key={a.id} className="adm-log"><span className="num muted">{dt(a.created_at)}</span>{a.action}{a.target ? <span className="muted"> · {String(a.target).slice(0, 8)}</span> : null}</div>)}
          </section>
        )}
      </div>
    </div>
  )
}
