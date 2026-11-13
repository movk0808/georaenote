import { useSyncExternalStore } from 'react'
import {
  CardCharge, Contract, ContractType, CONTRACT_TYPES, fee as calcFee, maskAccount, Method, mileageOf, MileageLog, Transfer, TransferStatus, User,
} from './model'
import { today } from './format'
import { QUIZZES } from '../data/content'
import { callFunction, errText, REMOTE, sb } from './supabase'

/**
 * 웹앱 데이터 저장소. 두 가지 모드로 동작해요.
 * - 서버 모드(REMOTE): Supabase에 저장. 같은 휴대폰 번호로 로그인하면 안드로이드 앱과 같은 데이터를 봐요.
 * - 체험 모드: 서버 설정이 없을 때 이 브라우저에만 저장.
 * 화면 코드는 어느 모드인지 몰라도 되도록 같은 함수로 부릅니다.
 */
export interface State {
  user: User | null
  contracts: Contract[]
  transfers: Transfer[]
  mileageLogs: MileageLog[]
  quizDoneDate: string
  notificationsOn: boolean
  ready: boolean
}

export const MODE: 'remote' | 'local' = REMOTE ? 'remote' : 'local'
const KEY = 'georaenote-web-v1'
const DEMO_REVIEW_MS = 10_000

const empty: State = { user: null, contracts: [], transfers: [], mileageLogs: [], quizDoneDate: '', notificationsOn: true, ready: !REMOTE }

function loadLocal(): State {
  if (REMOTE) return empty
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...empty, ...JSON.parse(raw), ready: true } : empty
  } catch {
    return empty
  }
}

let state: State = loadLocal()
const listeners = new Set<() => void>()

function set(next: Partial<State>) {
  state = { ...state, ...next }
  if (!REMOTE) {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* 저장 공간이 막혀도 화면은 계속 동작 */ }
  }
  listeners.forEach((l) => l())
}

export function useStore(): State {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb) }, () => state)
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)
const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : 0)

export const mileageBalance = (s: State) => s.mileageLogs.reduce((a, m) => a + m.amount, 0)

// ---------- 서버 데이터 읽기 ----------
interface Row { [k: string]: unknown }

const toContract = (r: Row): Contract => ({
  id: r.id as string,
  type: r.type as ContractType,
  title: r.title as string,
  payeeName: r.payee_name as string,
  bank: r.bank as string,
  account: r.account as string,
  holder: r.holder as string,
  senderName: r.sender_name as string,
  address: (r.address as string) ?? '',
  proofs: ((r.contract_documents as Row[] | undefined) ?? []).map((d) => d.file_name as string),
  createdAt: ms(r.created_at as string),
  status: r.status as Contract['status'],
  rejectReason: r.reject_reason as string | null,
})

const toStatus = (s: string): TransferStatus => (s === 'PAID' || s === 'SENDING' ? 'WAITING_SEND' : (s as TransferStatus))

const toTransfer = (r: Row): Transfer => ({
  id: r.id as string,
  contractId: r.contract_id as string,
  contractTitle: r.payee_name as string,
  payeeName: r.payee_name as string,
  bank: r.bank as string,
  maskedAccount: r.masked_account as string,
  holder: r.holder as string,
  senderName: r.sender_name as string,
  memo: (r.memo as string) ?? '',
  amount: Number(r.amount),
  fee: Number(r.fee),
  method: r.method as Method,
  scheduledDate: (r.scheduled_date as string) ?? null,
  cards: ((r.card_charges as Row[] | undefined) ?? []).map((c) => ({ company: c.company as string, installment: Number(c.installment), amount: Number(c.amount) })),
  mileage: Number(r.mileage),
  createdAt: ms(r.paid_at as string),
  completedAt: r.completed_at ? ms(r.completed_at as string) : null,
  status: toStatus(r.status as string),
})

let loading = false
async function loadRemote() {
  if (!sb || loading) return
  loading = true
  try {
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { set({ ...empty, ready: true }); return }
    const [p, c, t, m, q] = await Promise.all([
      sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      sb.from('contracts').select('*, contract_documents(file_name)').eq('user_id', session.user.id).neq('status', 'SUSPENDED').order('created_at', { ascending: false }),
      sb.from('transfers').select('*, card_charges(company, installment, amount)').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(200),
      sb.from('mileage_ledger').select('amount, reason, created_at').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(200),
      sb.from('quiz_answers').select('day').eq('user_id', session.user.id).eq('day', today()).maybeSingle(),
    ])
    if (!p.data) { set({ ...empty, ready: true }); return }
    set({
      user: { name: p.data.name, phone: p.data.phone, carrier: p.data.carrier ?? '', birth: p.data.birth ?? '' },
      notificationsOn: p.data.notifications_on,
      contracts: (c.data ?? []).map(toContract),
      transfers: (t.data ?? []).map(toTransfer),
      mileageLogs: (m.data ?? []).map((x) => ({ title: x.reason, amount: Number(x.amount), at: ms(x.created_at) })),
      quizDoneDate: q.data ? today() : '',
      ready: true,
    })
  } finally {
    loading = false
  }
}

if (sb) {
  loadRemote()
  sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') loadRemote() })
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await sb!.rpc(fn, args)
  if (error) throw new Error(errText(error))
  return data as T
}

/** 데모 심사 승인·예약송금 처리 후 최신 데이터 다시 읽기 */
export async function refresh() {
  if (REMOTE) {
    if (!state.user) return
    await sb!.rpc('tick').then(() => undefined, () => undefined)
    await loadRemote()
    return
  }
  const now = Date.now()
  if (state.contracts.some((c) => c.status === 'REVIEW' && now - c.createdAt >= DEMO_REVIEW_MS)) {
    set({ contracts: state.contracts.map((c) => (c.status === 'REVIEW' && now - c.createdAt >= DEMO_REVIEW_MS ? { ...c, status: 'APPROVED' } : c)) })
  }
  const t = today()
  for (const x of state.transfers.filter((x) => x.status === 'SCHEDULED' && x.scheduledDate && x.scheduledDate <= t)) await complete(x.id)
}

// ---------- 로그인 ----------

/** 인증번호 요청. 체험 서버는 문자를 보내는 대신 번호를 돌려줘요 */
export async function requestCode(phone: string): Promise<string> {
  if (REMOTE) {
    const r = await callFunction<{ demo_code?: string }>('auth-phone', { action: 'request', phone })
    return r.demo_code ?? ''
  }
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
}

export async function verifyLogin(p: { phone: string; code: string; expected: string; name: string; birth: string; carrier: string }) {
  if (REMOTE) {
    const r = await callFunction<{ access_token: string; refresh_token: string }>('auth-phone', { action: 'verify', ...p })
    const { error } = await sb!.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token })
    if (error) throw new Error(errText(error))
    await loadRemote()
    return
  }
  if (p.code !== p.expected) throw new Error('인증번호가 일치하지 않아요')
  set({ user: { name: p.name.trim(), phone: p.phone.replace(/\D/g, ''), carrier: p.carrier, birth: p.birth } })
}

export async function logout() {
  if (REMOTE) { await sb!.auth.signOut(); set({ ...empty, ready: true }); return }
  set({ user: null })
}

export async function withdraw() {
  if (REMOTE) {
    // 올린 증빙 파일 먼저 지우기(계정 삭제 후에는 본인이 지울 수 없어요)
    const { data: { session } } = await sb!.auth.getSession()
    if (session) {
      const { data: files } = await sb!.storage.from('proofs').list(session.user.id, { limit: 1000 })
      if (files?.length) await sb!.storage.from('proofs').remove(files.map((f) => `${session.user.id}/${f.name}`))
    }
    await rpc('withdraw_me'); await sb!.auth.signOut(); set({ ...empty, ready: true }); return
  }
  set({ ...empty, ready: true })
}

export async function setNotifications(on: boolean) {
  if (REMOTE) { await rpc('update_my_profile', { p_notifications: on }); set({ notificationsOn: on }); return }
  set({ notificationsOn: on })
}

// ---------- 계약 ----------
export interface ContractDraft {
  type: ContractType | null
  payeeName: string
  bank: string
  account: string
  holder: string
  address: string
  addressDetail: string
  senderName: string
  proofs: string[]
  /** 실제로 고른 파일(서버 모드에서 저장소에 올림). 샘플 서류는 이름만 있어요 */
  files?: Record<string, File>
}
export const emptyDraft = (): ContractDraft => ({
  type: null, payeeName: '', bank: '', account: '', holder: '', address: '', addressDetail: '', senderName: '', proofs: [], files: {},
})

export async function submitContract(d: ContractDraft): Promise<string> {
  const type = d.type ?? 'ETC'
  const address = [d.address, d.addressDetail].filter((x) => x.trim()).join(' ')
  if (REMOTE) {
    const { data: { session } } = await sb!.auth.getSession()
    if (!session) throw new Error('로그인이 필요해요')
    const docs: { file_name: string; storage_path: string | null }[] = []
    for (const name of d.proofs) {
      const file = d.files?.[name]
      if (!file) { docs.push({ file_name: name, storage_path: null }); continue }
      const ext = (name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `${session.user.id}/${uid()}.${ext}`
      const { error } = await sb!.storage.from('proofs').upload(path, file, { contentType: file.type || undefined })
      if (error) throw new Error(`${name} 파일을 올리지 못했어요`)
      docs.push({ file_name: name, storage_path: path })
    }
    const id = await rpc<string>('submit_contract', {
      p_type: type, p_payee_name: d.payeeName, p_bank: d.bank, p_account: d.account, p_holder: d.holder,
      p_sender_name: d.senderName, p_address: address, p_documents: docs,
    })
    await loadRemote()
    return id
  }
  const c: Contract = {
    id: uid(), type, title: `${d.payeeName.trim()} ${CONTRACT_TYPES[type].label}`, payeeName: d.payeeName.trim(), bank: d.bank,
    account: d.account.replace(/\D/g, ''), holder: d.holder.trim(), senderName: d.senderName.trim(), address,
    proofs: d.proofs, createdAt: Date.now(), status: 'REVIEW',
  }
  set({ contracts: [c, ...state.contracts] })
  return c.id
}

export async function deleteContract(id: string) {
  if (REMOTE) { await rpc('delete_contract', { p_id: id }); await loadRemote(); return }
  set({ contracts: state.contracts.filter((c) => c.id !== id) })
}

// ---------- 송금 ----------
export interface TransferDraft { contractId: string; amount: number; method: Method; scheduledDate: string | null; memo: string; split: boolean }

let transferDraft: TransferDraft | null = null
export const setTransferDraft = (d: TransferDraft | null) => { transferDraft = d }
export const getTransferDraft = () => transferDraft

/** 카드 결제(모의 승인) 후 송금 건 생성. PG 연동 후에는 PG 결제창 → 승인 웹훅으로 바뀝니다 */
export async function pay(cards: CardCharge[]): Promise<Transfer | null> {
  const d = transferDraft
  if (!d) return null
  if (REMOTE) {
    const r = await rpc<Row>('pay_transfer', {
      p_contract_id: d.contractId, p_amount: d.amount, p_method: d.method, p_scheduled_date: d.scheduledDate,
      p_memo: d.memo, p_cards: cards.map((c) => ({ company: c.company, installment: c.installment, amount: c.amount })),
    })
    transferDraft = null
    await loadRemote()
    return state.transfers.find((x) => x.id === r.id) ?? toTransfer({ ...r, card_charges: cards })
  }
  const c = state.contracts.find((x) => x.id === d.contractId)
  if (!c) return null
  const f = calcFee(d.amount, d.method)
  const t: Transfer = {
    id: uid(), contractId: c.id, contractTitle: c.title, payeeName: c.payeeName, bank: c.bank, maskedAccount: maskAccount(c.account),
    holder: c.holder, senderName: c.senderName, memo: d.memo, amount: d.amount, fee: f, method: d.method, scheduledDate: d.scheduledDate,
    cards, mileage: mileageOf(f), createdAt: Date.now(), completedAt: null, status: d.method === 'INSTANT' ? 'WAITING_SEND' : 'SCHEDULED',
  }
  set({ transfers: [t, ...state.transfers] })
  transferDraft = null
  return t
}

/** 바로송금의 '송금하기' (체험 모드에서는 예약일 도래 처리도 이 함수로) */
export async function complete(id: string) {
  if (REMOTE) { await rpc('send_transfer', { p_id: id }); await loadRemote(); return }
  const t = state.transfers.find((x) => x.id === id)
  if (!t || t.status === 'COMPLETED' || t.status === 'CANCELED') return
  const firstEver = !state.transfers.some((x) => x.status === 'COMPLETED')
  const now = Date.now()
  const logs: MileageLog[] = [{ title: `송금 적립 · ${t.payeeName}`, amount: t.mileage, at: now }]
  if (firstEver) logs.push({ title: '첫 송금 이벤트', amount: 3000, at: now })
  set({
    transfers: state.transfers.map((x) => (x.id === id ? { ...x, status: 'COMPLETED', completedAt: now } : x)),
    mileageLogs: [...logs, ...state.mileageLogs],
  })
}

export async function cancel(id: string) {
  if (REMOTE) { await rpc('cancel_transfer', { p_id: id }); await loadRemote(); return }
  set({ transfers: state.transfers.map((x) => (x.id === id && x.status !== 'COMPLETED' ? { ...x, status: 'CANCELED' } : x)) })
}

// ---------- 퀴즈·문의 ----------

/** 앱·서버와 같은 규칙: 2026-01-01부터 지난 날 수로 오늘의 문제를 고릅니다 */
export const quizIndex = () => Math.floor((Date.parse(`${today()}T00:00:00Z`) - Date.parse('2026-01-01T00:00:00Z')) / 86400000) % QUIZZES.length

export async function answerQuiz(choice: number): Promise<{ correct: boolean; answer: number; explain: string }> {
  if (REMOTE) {
    const r = await rpc<{ correct: boolean; answer: number; explain: string }>('answer_quiz', { p_choice: choice })
    await loadRemote()
    return r
  }
  const q = QUIZZES[quizIndex()]
  const correct = choice === q.answer
  set({
    quizDoneDate: today(),
    mileageLogs: correct ? [{ title: '매일 퀴즈 정답', amount: 10, at: Date.now() }, ...state.mileageLogs] : state.mileageLogs,
  })
  return { correct, answer: q.answer, explain: q.explain }
}

/** 고객센터 채팅 문의를 서버에 남겨 관리자가 답할 수 있게 해요(체험 모드에서는 남기지 않음) */
export async function sendInquiry(message: string) {
  if (REMOTE && state.user) await rpc('create_inquiry', { p_message: message }).catch(() => undefined)
}
