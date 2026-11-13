import { useState } from 'react'
import { CheckCheck, Download, Layers, X } from 'lucide-react'
import writeXlsxFile from 'write-excel-file/browser'
import { adb, arpc, dt, Staff, useQuery, won } from './api'
import { toast } from '../components/ui'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/** 은행 표준코드(금융결제원 기준 3자리). 대량이체 파일에 함께 넣어요 */
const BANK_CODE: Record<string, string> = {
  'KB국민은행': '004', '신한은행': '088', '우리은행': '020', '하나은행': '081', 'NH농협은행': '011', 'IBK기업은행': '003',
  '카카오뱅크': '090', '토스뱅크': '092', '케이뱅크': '089', 'SC제일은행': '023', '부산은행': '032', '대구은행(iM뱅크)': '031',
  '경남은행': '039', '광주은행': '034', '전북은행': '037', '제주은행': '035', '새마을금고': '045', '신협': '048', '우체국': '071', '수협은행': '007',
}
const BATCH_STATUS: Record<string, [string, string]> = {
  DRAFT: ['결재 대기', 'pill-review'], APPROVED: ['결재 완료 · 이체 대기', 'pill-info'], DONE: ['지급 완료', 'pill-ok'], CANCELED: ['취소', 'pill-neutral'],
}

/**
 * 송금 처리(운영): 송금 중으로 모인 건 → 묶음 만들기 → 결재 → 은행 대량이체 파일 → 은행에서 이체 → 완료 처리
 * 나중에 펌뱅킹·PG 지급대행 API를 붙이면 '파일 받기 + 완료 처리' 단계가 자동으로 바뀌어요.
 */
export function PayoutsPage({ staff }: { staff: Staff }) {
  const isAdmin = staff.role === 'ADMIN'
  const canMake = staff.role !== 'VIEWER'
  const settings = useQuery(async () => (await adb!.from('settings').select('payout_mode, payout_two_person').single()).data as Row)
  const queue = useQuery(async () => {
    const { data, error } = await adb!.from('transfers')
      .select('id, payee_name, bank, masked_account, holder, sender_name, amount, method, send_requested_at, paid_at, profiles(nickname, name)')
      .eq('status', 'SENDING').is('payout_batch_id', null).order('send_requested_at')
    if (error) throw new Error(error.message)
    return (data ?? []) as Row[]
  })
  const batches = useQuery(async () => {
    const { data, error } = await adb!.from('payout_batches').select('*').order('created_at', { ascending: false }).limit(30)
    if (error) throw new Error(error.message)
    return (data ?? []) as Row[]
  })
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [closing, setClosing] = useState<Row | null>(null)
  const reload = () => { queue.reload(); batches.reload(); setPicked(new Set()) }
  const run = (p: Promise<unknown>, msg: string) => {
    setBusy(true)
    p.then(() => { toast(msg); reload() }).catch((e: Error) => toast(e.message)).finally(() => setBusy(false))
  }

  const rows = queue.data ?? []
  const all = rows.length > 0 && rows.every((r) => picked.has(r.id))
  const pickedRows = rows.filter((r) => picked.has(r.id))
  const toggle = (id: string) => { const n = new Set(picked); if (n.has(id)) n.delete(id); else n.add(id); setPicked(n) }

  const downloadFile = async (b: Row) => {
    setBusy(true)
    try {
      const items = await arpc<Row[]>('admin_payout_file', { p_id: b.id })
      const head = ['은행코드', '은행', '입금계좌번호', '예금주', '이체금액', '받는분 통장 표시', '내 통장 표시', '메모', '거래노트 송금번호']
      const data = [
        head.map((h) => ({ value: h, fontWeight: 'bold' as const })),
        ...items.map((x) => [
          BANK_CODE[x.bank] ?? '', x.bank, String(x.account), x.holder, Number(x.amount), x.sender_name, x.payee_name.slice(0, 7), x.memo ?? '', x.transfer_id,
        ].map((v) => ({ value: v }))),
      ]
      await writeXlsxFile(data, { columns: [10, 14, 20, 14, 14, 16, 14, 18, 38].map((w) => ({ width: w })) })
        .toFile(`거래노트_대량이체_${b.created_at.slice(0, 10)}_${b.item_count}건.xlsx`)
      toast('파일을 내려받았어요. 은행 기업뱅킹의 대량이체(파일 이체)에 올려 주세요')
      batches.reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : '파일을 만들지 못했어요')
    } finally { setBusy(false) }
  }

  return (
    <div className="adm-page">
      <header className="adm-head">
        <div><h1>송금 처리</h1><p className="sub">보낼 송금을 묶어 결재하고, 은행 대량이체 파일로 보낸 뒤 완료 처리해요</p></div>
      </header>

      {settings.data?.payout_mode !== 'BATCH' && (
        <div className="adm-card" style={{ borderLeft: '3px solid var(--primary)' }}>
          <b>지금은 자동 지급(체험판) 모드예요.</b>
          <p className="sub" style={{ margin: '6px 0 0' }}>사장님이 '송금하기'를 누르면 바로 완료 처리돼요. 실제 운영에서는 운영 설정 → 송금 처리 방식을 '묶음 송금'으로 바꾸면 보낼 건이 여기로 모여요.</p>
        </div>
      )}

      <section className="adm-card">
        <div className="adm-card-head">
          <h2>보낼 송금 <span className="muted">{rows.length}건 · {won(rows.reduce((a, r) => a + Number(r.amount), 0))}</span></h2>
          {canMake && (
            <button className="btn btn-primary btn-sm" disabled={busy || !pickedRows.length}
              onClick={() => run(arpc('admin_create_payout_batch', { p_ids: pickedRows.map((r) => r.id) }), `${pickedRows.length}건으로 묶음을 만들었어요`)}>
              <Layers size={16} />선택한 {pickedRows.length}건 묶기 · {won(pickedRows.reduce((a, r) => a + Number(r.amount), 0))}
            </button>
          )}
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr>
              <th><input type="checkbox" aria-label="전체 선택" checked={all} onChange={() => setPicked(all ? new Set() : new Set(rows.map((r) => r.id)))} /></th>
              <th>요청 시각</th><th>사장님</th><th>받는 곳</th><th>송금자명</th><th className="r">금액</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => toggle(r.id)}>
                  <td><input type="checkbox" aria-label={`${r.payee_name} 선택`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} onClick={(e) => e.stopPropagation()} /></td>
                  <td className="num muted">{dt(r.send_requested_at ?? r.paid_at)}</td>
                  <td>{r.profiles?.nickname ?? '-'}<small>{r.profiles?.name ?? ''}</small></td>
                  <td>{r.payee_name}<small>{r.bank} {r.masked_account} · {r.holder}</small></td>
                  <td>{r.sender_name}</td>
                  <td className="r num">{won(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!queue.loading && !rows.length && <p className="empty">보낼 송금이 없어요</p>}
        </div>
      </section>

      <section className="adm-card">
        <div className="adm-card-head"><h2>송금 묶음</h2>{settings.data?.payout_two_person && <span className="pill pill-info">2인 결재 켜짐</span>}</div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>만든 시각</th><th>상태</th><th className="r">건수</th><th className="r">금액</th><th>결재</th><th>파일</th><th></th></tr></thead>
            <tbody>
              {(batches.data ?? []).map((b) => (
                <tr key={b.id}>
                  <td className="num muted">{dt(b.created_at)}</td>
                  <td><span className={`pill ${BATCH_STATUS[b.status][1]}`}>{BATCH_STATUS[b.status][0]}</span></td>
                  <td className="r num">{b.item_count}</td>
                  <td className="r num">{won(b.total_amount)}</td>
                  <td className="num muted">{b.approved_at ? dt(b.approved_at) : '-'}</td>
                  <td className="num muted">{b.file_downloaded_at ? dt(b.file_downloaded_at) : '-'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {isAdmin && b.status === 'DRAFT' && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => confirm(`${b.item_count}건 ${won(b.total_amount)}을 결재할까요?`) && run(arpc('admin_approve_payout_batch', { p_id: b.id }), '결재했어요')}><CheckCheck size={15} />결재</button>}
                    {isAdmin && (b.status === 'APPROVED' || b.status === 'DONE') && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void downloadFile(b)}><Download size={15} />대량이체 파일</button>}
                    {isAdmin && b.status === 'APPROVED' && <button className="btn btn-primary btn-sm" style={{ marginLeft: 6 }} disabled={busy} onClick={() => setClosing(b)}>이체 완료 처리</button>}
                    {isAdmin && (b.status === 'DRAFT' || b.status === 'APPROVED') && <button className="btn btn-ghost btn-sm" disabled={busy} aria-label="묶음 취소" onClick={() => confirm('묶음을 취소할까요? 송금은 다시 보낼 목록으로 돌아가요') && run(arpc('admin_cancel_payout_batch', { p_id: b.id }), '묶음을 취소했어요')}><X size={15} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!batches.loading && !(batches.data ?? []).length && <p className="empty">아직 만든 묶음이 없어요</p>}
        </div>
        <p className="hint" style={{ marginTop: 12 }}>순서: 묶기 → 결재 → 대량이체 파일 받기 → 은행 기업뱅킹에서 파일 이체·OTP 결재 → 이체 완료 처리(실패한 건만 따로 표시). 파일에는 전체 계좌번호가 들어 있어 내려받을 때마다 기록이 남아요</p>
      </section>

      {closing && <CloseBatch batch={closing} onClose={() => setClosing(null)} onDone={() => { setClosing(null); reload() }} />}
    </div>
  )
}

/** 은행 이체 결과 반영: 실패한 건만 체크하면 나머지는 지급 완료 */
function CloseBatch({ batch, onClose, onDone }: { batch: Row; onClose: () => void; onDone: () => void }) {
  const items = useQuery(async () => ((await adb!.from('transfers').select('id, payee_name, bank, masked_account, amount').eq('payout_batch_id', batch.id).eq('status', 'SENDING')).data ?? []) as Row[], [batch.id])
  const [failed, setFailed] = useState<Set<string>>(new Set())
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = () => {
    setBusy(true)
    arpc('admin_complete_payout_batch', { p_id: batch.id, p_failed: [...failed], p_reason: reason || null })
      .then(() => { toast('이체 결과를 반영했어요'); onDone() }).catch((e: Error) => toast(e.message)).finally(() => setBusy(false))
  }
  return (
    <div className="adm-drawer-bg" onClick={onClose}>
      <aside className="adm-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="이체 완료 처리">
        <header><h2>이체 완료 처리</h2><button aria-label="닫기" onClick={onClose}><X size={18} /></button></header>
        <div className="body">
        <p className="sub">은행 이체 결과를 보고 <b>실패한 건만</b> 체크해 주세요. 나머지는 지급 완료로 바뀌고 사장님 앱·웹에 바로 표시돼요.</p>
        {(items.data ?? []).map((t) => (
          <label key={t.id} className="adm-log" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={failed.has(t.id)} onChange={() => { const n = new Set(failed); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); setFailed(n) }} />
            <span>{t.payee_name}</span><span className="muted">{t.bank} {t.masked_account}</span><b className="num">{won(t.amount)}</b>
          </label>
        ))}
        {failed.size > 0 && <input className="input" style={{ marginTop: 12 }} placeholder="실패 사유(예: 계좌번호 오류, 예금주 불일치)" value={reason} onChange={(e) => setReason(e.target.value)} />}
        <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={busy} onClick={submit}>
          {failed.size ? `${(items.data ?? []).length - failed.size}건 완료 · ${failed.size}건 실패로 처리` : `${(items.data ?? []).length}건 모두 지급 완료`}
        </button>
        </div>
      </aside>
    </div>
  )
}
