import { useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { CircleAlert, CircleCheck, Clock, Download, FileSpreadsheet, Upload } from 'lucide-react'
import readXlsxFile from 'read-excel-file/browser'
import writeXlsxFile from 'write-excel-file/browser'
import { AppPage } from '../../components/Layouts'
import { ListPicker, Spinner, toast } from '../../components/ui'
import { BANKS, CARD_COMPANIES, fee, MAX_AMOUNT, Method, MIN_AMOUNT } from '../../lib/model'
import { BulkMatch, BulkRow, matchBulk, payBulk, useStore } from '../../lib/store'
import { addDays, today, won } from '../../lib/format'

const HEAD = ['거래처명', '은행', '계좌번호', '예금주', '금액', '송금 방식(바로/예약)', '입금일(예약일 때)', '메모']

interface Line extends BulkRow { problem: string | null; match: BulkMatch | null; pick: boolean }

/** 은행 이름을 거래노트 목록 이름으로 맞춰요(국민, KB → KB국민은행 등) */
function normBank(v: string): string | null {
  const s = v.replace(/\s/g, '')
  if (!s) return null
  const exact = BANKS.find((b) => b === s)
  if (exact) return exact
  const alias: [RegExp, string][] = [
    [/국민|KB/i, 'KB국민은행'], [/신한/, '신한은행'], [/우리/, '우리은행'], [/하나|KEB/i, '하나은행'], [/농협|NH/i, 'NH농협은행'],
    [/기업|IBK/i, 'IBK기업은행'], [/카카오/, '카카오뱅크'], [/토스/, '토스뱅크'], [/케이뱅크|K뱅크/i, '케이뱅크'], [/SC|제일/i, 'SC제일은행'],
    [/부산/, '부산은행'], [/대구|iM/i, '대구은행(iM뱅크)'], [/경남/, '경남은행'], [/광주/, '광주은행'], [/전북/, '전북은행'], [/제주/, '제주은행'],
    [/새마을/, '새마을금고'], [/신협/, '신협'], [/우체국/, '우체국'], [/수협/, '수협은행'],
  ]
  return alias.find(([re]) => re.test(s))?.[1] ?? null
}

function toDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  const s = String(v ?? '').trim().replace(/[./]/g, '-')
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null
}

/** CSV 한 줄 나누기(따옴표 안 쉼표 처리) */
function splitCsv(line: string): string[] {
  const out: string[] = []; let cur = ''; let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') q = false; else cur += ch }
    else if (ch === '"') q = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

async function readRows(file: File): Promise<unknown[][]> {
  if (/\.csv$/i.test(file.name)) {
    const text = (await file.text()).replace(/^﻿/, '')
    return text.split(/\r?\n/).filter((l) => l.trim()).map(splitCsv)
  }
  const sheets = await readXlsxFile(file)
  return (sheets[0]?.data ?? []) as unknown[][]
}

function toLine(cells: unknown[]): Line {
  const c = (i: number) => String(cells[i] ?? '').trim()
  const bank = normBank(c(1))
  const account = c(2).replace(/\D/g, '')
  const amount = Number(String(cells[4] ?? '').replace(/[^\d]/g, ''))
  const method: Method = /예약|SCHED/i.test(c(5)) ? 'SCHEDULED' : 'INSTANT'
  const scheduledDate = method === 'SCHEDULED' ? toDate(cells[6]) : null
  const row: BulkRow = { payeeName: c(0), bank: bank ?? c(1), account, holder: c(3), amount, method, scheduledDate, memo: c(7).slice(0, 40) }
  let problem: string | null = null
  if (!row.payeeName) problem = '거래처명이 비어 있어요'
  else if (!bank) problem = `은행 이름을 알 수 없어요(${c(1) || '빈칸'})`
  else if (account.length < 8) problem = '계좌번호를 확인해 주세요'
  else if (!row.holder) problem = '예금주가 비어 있어요'
  else if (!amount || amount < MIN_AMOUNT || amount > MAX_AMOUNT) problem = `금액은 ${won(MIN_AMOUNT)}부터 ${won(MAX_AMOUNT)}까지예요`
  else if (method === 'SCHEDULED' && (!scheduledDate || scheduledDate <= today())) problem = '예약 입금일은 내일 이후 날짜(2026-12-01 형식)로 적어 주세요'
  return { ...row, problem, match: null, pick: !problem }
}

/** 엑셀로 한 번에 송금: 양식 → 올리기 → 줄별 검사 → 미리보기 → 카드 한 번 결제 */
export function BulkTransferPage() {
  const s = useStore()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [company, setCompany] = useState('')
  const [installment, setInstallment] = useState(1)
  const [picker, setPicker] = useState<'company' | 'inst' | null>(null)
  if (s.user && !s.user.verified) return <Navigate to="/app/verify?next=/app/transfers/bulk" replace />

  const template = async () => {
    const day = addDays(today(), 3)
    const data = [
      HEAD.map((h) => ({ value: h, fontWeight: 'bold' as const })),
      ['한빛식자재', '신한은행', '110123456789', '한빛식자재', 1280000, '바로', '', '11월 식자재'].map((v) => ({ value: v })),
      ['상가 임대인', 'KB국민은행', '12345678901234', '김임대', 2000000, '예약', day, '12월 월세'].map((v) => ({ value: v })),
    ]
    await writeXlsxFile(data, { columns: [16, 12, 18, 12, 12, 18, 16, 16].map((w) => ({ width: w })) }).toFile('거래노트_일괄송금_양식.xlsx')
  }

  const onFile = async (file: File) => {
    setBusy('파일을 읽고 있어요'); setFileName(file.name)
    try {
      const raw = await readRows(file)
      const body = raw.filter((r) => r.some((x) => String(x ?? '').trim()))
      const start = body.length && String(body[0][0] ?? '').includes('거래처') ? 1 : 0
      const parsed = body.slice(start, start + 100).map(toLine)
      if (!parsed.length) { toast('송금할 줄이 없어요. 양식의 두 번째 줄부터 적어 주세요'); setLines([]); return }
      const ok = parsed.filter((l) => !l.problem)
      const matched = ok.length ? await matchBulk(ok) : []
      let k = 0
      setLines(parsed.map((l) => {
        if (l.problem) return l
        const m = matched[k++] ?? null
        const ready = m?.contractId && m.status === 'APPROVED'
        return { ...l, match: m, pick: !!ready, problem: ready ? null : null }
      }))
    } catch (e) {
      toast(e instanceof Error ? e.message : '파일을 읽지 못했어요')
    } finally { setBusy(null) }
  }

  const ready = (l: Line) => !l.problem && l.match?.contractId && l.match.status === 'APPROVED'
  const picked = lines.filter((l) => l.pick && ready(l))
  const sumAmount = picked.reduce((a, l) => a + l.amount, 0)
  const sumFee = picked.reduce((a, l) => a + fee(l.amount, l.method), 0)

  const registerContract = (l: Line) => {
    try {
      sessionStorage.setItem('georaenote-contract-prefill', JSON.stringify({ payeeName: l.payeeName, bank: l.bank, account: l.account, holder: l.holder }))
    } catch { /* 저장 못 해도 빈 양식으로 열려요 */ }
    navigate('/app/contracts/new')
  }

  const submit = async () => {
    if (!picked.length || !company) return
    setBusy('카드 결제를 진행하고 있어요')
    try {
      await payBulk(picked.map((l) => ({ contractId: l.match!.contractId!, amount: l.amount, method: l.method, scheduledDate: l.scheduledDate, memo: l.memo })), company, installment)
      toast(`${picked.length}건을 결제했어요`)
      navigate('/app/transfers')
    } catch (e) {
      toast(e instanceof Error ? e.message : '결제하지 못했어요')
    } finally { setBusy(null) }
  }

  return (
    <AppPage title="엑셀로 한 번에 송금" back="/app/transfers">
      {busy && <Spinner label={busy} />}
      <div className="card" style={{ marginBottom: 12 }}>
        <h2 className="step-title" style={{ marginTop: 0 }}>여러 거래처에 한 번에 보내요</h2>
        <p className="step-sub">양식에 거래처와 금액을 적어 올리면, 줄마다 확인해서 카드 한 번으로 결제해요. 한 번에 100건까지 올릴 수 있어요</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => void template()}><Download size={18} />양식 내려받기</button>
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()}><Upload size={18} />엑셀·CSV 올리기</button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = '' }} />
        </div>
        {fileName && <p className="hint" style={{ marginTop: 10 }}><FileSpreadsheet size={14} style={{ verticalAlign: -2 }} /> {fileName} · {lines.length}줄</p>}
        <p className="hint" style={{ marginTop: 8 }}>처음 보내는 거래처는 계약 등록과 증빙 확인을 먼저 거쳐야 해요. 본인·자사 계좌로는 보낼 수 없어요</p>
      </div>

      {lines.length > 0 && (
        <div className="card" style={{ padding: 0, overflowX: 'auto', marginBottom: 12 }}>
          <table className="bulk-table">
            <thead><tr><th></th><th>거래처</th><th>계좌</th><th className="r">금액</th><th>방식</th><th>상태</th></tr></thead>
            <tbody>
              {lines.map((l, i) => {
                const ok = ready(l)
                return (
                  <tr key={i} className={ok ? '' : 'muted-row'}>
                    <td><input type="checkbox" aria-label={`${l.payeeName} 선택`} disabled={!ok} checked={!!ok && l.pick} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, pick: e.target.checked } : x)))} /></td>
                    <td>{l.payeeName || '-'}<small>{l.memo}</small></td>
                    <td>{l.bank}<small className="num">{l.account ? `****${l.account.slice(-4)}` : ''} · {l.holder}</small></td>
                    <td className="r num">{l.amount ? won(l.amount) : '-'}</td>
                    <td>{l.method === 'INSTANT' ? '바로' : `예약 ${l.scheduledDate?.slice(5) ?? ''}`}</td>
                    <td>
                      {l.problem ? <span className="bulk-st bad"><CircleAlert size={14} />{l.problem}</span>
                        : ok ? <span className="bulk-st ok"><CircleCheck size={14} />준비됨</span>
                          : l.match?.contractId ? <span className="bulk-st wait"><Clock size={14} />계약 {l.match.status === 'REVIEW' ? '검토 중' : '확인 필요'}</span>
                            : <button className="btn btn-ghost btn-sm" onClick={() => registerContract(l)}>계약 등록</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {picked.length > 0 && (
        <div className="card">
          <div className="kv"><dt>선택한 송금</dt><dd>{picked.length}건</dd></div>
          <div className="kv"><dt>거래처 입금액 합계</dt><dd className="num">{won(sumAmount)}</dd></div>
          <div className="kv"><dt>이용료 합계</dt><dd className="num">{won(sumFee)}</dd></div>
          <div className="kv total"><dt>카드 청구액</dt><dd className="num">{won(sumAmount + sumFee)}</dd></div>
          <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
            <button className="input" style={{ flex: 1, textAlign: 'left' }} onClick={() => setPicker('company')}>{company || '카드사 선택'}</button>
            <button className="input" style={{ width: 120, textAlign: 'left' }} onClick={() => setPicker('inst')}>{installment === 1 ? '일시불' : `${installment}개월`}</button>
          </div>
          <p className="hint">바로송금은 결제와 함께 송금이 접수되고, 예약송금은 적은 날짜에 입금돼요. 고액·한도 초과 건은 결제 전에 안내해 드려요</p>
          <button className="btn btn-primary btn-block" disabled={!company || !!busy} onClick={() => void submit()}>{won(sumAmount + sumFee)} 결제하기</button>
          <p className="hint" style={{ marginTop: 8 }}>체험판에서는 모의 승인돼요. 실제 서비스에서는 PG 결제창에서 본인 명의 카드로 한 번 승인해요</p>
        </div>
      )}
      {lines.length > 0 && !picked.length && <p className="empty">결제할 수 있는 줄이 없어요. 상태 칸의 안내를 확인해 주세요</p>}
      <p className="hint" style={{ marginTop: 16 }}><Link to="/app/transfers">송금 내역으로 돌아가기</Link></p>

      {picker === 'company' && <ListPicker title="카드사 선택" options={CARD_COMPANIES} onClose={() => setPicker(null)} onPick={(v) => { setCompany(v); setPicker(null) }} />}
      {picker === 'inst' && <ListPicker title="할부" options={['일시불', '2개월', '3개월', '6개월', '10개월', '12개월']} onClose={() => setPicker(null)} onPick={(v) => { setInstallment(v === '일시불' ? 1 : Number(v.replace(/\D/g, ''))); setPicker(null) }} />}
    </AppPage>
  )
}
