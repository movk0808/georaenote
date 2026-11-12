import { useSyncExternalStore } from 'react'
import {
  CardCharge, Contract, ContractType, CONTRACT_TYPES, fee as calcFee, maskAccount, Method, mileageOf, MileageLog, Transfer, User,
} from './model'
import { today } from './format'
import { QUIZZES } from '../data/content'

/**
 * 브라우저 안(localStorage)에 저장하는 체험판 저장소. 안드로이드 앱의 Repository/AppViewModel 과 같은 규칙입니다.
 * 서버와 PG가 연결되면 이 파일의 함수들을 API 호출로 바꾸면 됩니다.
 */
interface State {
  user: User | null
  contracts: Contract[]
  transfers: Transfer[]
  mileageLogs: MileageLog[]
  quizDoneDate: string
  notificationsOn: boolean
}

const KEY = 'georaenote-web-v1'
const DEMO_REVIEW_MS = 10_000

const empty: State = { user: null, contracts: [], transfers: [], mileageLogs: [], quizDoneDate: '', notificationsOn: true }

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...empty, ...JSON.parse(raw) } : empty
  } catch {
    return empty
  }
}

let state: State = load()
const listeners = new Set<() => void>()

function set(next: Partial<State>) {
  state = { ...state, ...next }
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* 저장 공간이 막혀도 화면은 계속 동작 */ }
  listeners.forEach((l) => l())
}

export function useStore(): State {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb) }, () => state)
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

export const mileageBalance = (s: State) => s.mileageLogs.reduce((a, m) => a + m.amount, 0)

/** 데모 심사 승인, 예약송금 입금일 처리 */
export function refresh() {
  const now = Date.now()
  let contracts = state.contracts
  if (contracts.some((c) => c.status === 'REVIEW' && now - c.createdAt >= DEMO_REVIEW_MS)) {
    contracts = contracts.map((c) => (c.status === 'REVIEW' && now - c.createdAt >= DEMO_REVIEW_MS ? { ...c, status: 'APPROVED' } : c))
    set({ contracts })
  }
  const t = today()
  state.transfers
    .filter((x) => x.status === 'SCHEDULED' && x.scheduledDate && x.scheduledDate <= t)
    .forEach((x) => complete(x.id))
}

export function login(name: string, phone: string, carrier: string, birth: string) {
  set({ user: { name: name.trim(), phone: phone.replace(/\D/g, ''), carrier, birth } })
}
export const logout = () => set({ user: null })
export const withdraw = () => set({ ...empty })
export const setNotifications = (on: boolean) => set({ notificationsOn: on })

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
}
export const emptyDraft = (): ContractDraft => ({
  type: null, payeeName: '', bank: '', account: '', holder: '', address: '', addressDetail: '', senderName: '', proofs: [],
})

export function submitContract(d: ContractDraft): string {
  const type = d.type ?? 'ETC'
  const c: Contract = {
    id: uid(),
    type,
    title: `${d.payeeName.trim()} ${CONTRACT_TYPES[type].label}`,
    payeeName: d.payeeName.trim(),
    bank: d.bank,
    account: d.account.replace(/\D/g, ''),
    holder: d.holder.trim(),
    senderName: d.senderName.trim(),
    address: [d.address, d.addressDetail].filter((x) => x.trim()).join(' '),
    proofs: d.proofs,
    createdAt: Date.now(),
    status: 'REVIEW',
  }
  set({ contracts: [c, ...state.contracts] })
  return c.id
}

export const deleteContract = (id: string) => set({ contracts: state.contracts.filter((c) => c.id !== id) })

export interface TransferDraft { contractId: string; amount: number; method: Method; scheduledDate: string | null; memo: string; split: boolean }

let transferDraft: TransferDraft | null = null
export const setTransferDraft = (d: TransferDraft | null) => { transferDraft = d }
export const getTransferDraft = () => transferDraft

/** 카드 결제(모의 승인) 후 송금 건 생성 */
export function pay(cards: CardCharge[]): Transfer | null {
  const d = transferDraft
  if (!d) return null
  const c = state.contracts.find((x) => x.id === d.contractId)
  if (!c) return null
  const f = calcFee(d.amount, d.method)
  const t: Transfer = {
    id: uid(),
    contractId: c.id,
    contractTitle: c.title,
    payeeName: c.payeeName,
    bank: c.bank,
    maskedAccount: maskAccount(c.account),
    holder: c.holder,
    senderName: c.senderName,
    memo: d.memo,
    amount: d.amount,
    fee: f,
    method: d.method,
    scheduledDate: d.scheduledDate,
    cards,
    mileage: mileageOf(f),
    createdAt: Date.now(),
    completedAt: null,
    status: d.method === 'INSTANT' ? 'WAITING_SEND' : 'SCHEDULED',
  }
  set({ transfers: [t, ...state.transfers] })
  transferDraft = null
  return t
}

/** 바로송금의 '송금하기' 또는 예약일 도래 시 송금 완료 */
export function complete(id: string) {
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

export function cancel(id: string) {
  set({ transfers: state.transfers.map((x) => (x.id === id && x.status !== 'COMPLETED' ? { ...x, status: 'CANCELED' } : x)) })
}

export const quizIndex = () => Math.floor(Date.parse(`${today()}T00:00:00Z`) / 86400000) % QUIZZES.length
export function answerQuiz(correct: boolean) {
  set({
    quizDoneDate: today(),
    mileageLogs: correct ? [{ title: '매일 퀴즈 정답', amount: 10, at: Date.now() }, ...state.mileageLogs] : state.mileageLogs,
  })
}
