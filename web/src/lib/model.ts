// 안드로이드 앱(app/src/main/java/.../data/Models.kt)과 같은 규칙을 씁니다.

export type Method = 'INSTANT' | 'SCHEDULED'

export const METHODS: Record<Method, { label: string; bps: number; short: string; description: string }> = {
  INSTANT: { label: '바로송금', bps: 400, short: '결제 후 즉시 송금', description: "결제 후 '송금하기'를 누르면 바로 입금돼요" },
  SCHEDULED: { label: '예약송금', bps: 350, short: '원하는 날짜에 입금', description: '원하는 날짜에 자동으로 입금돼요' },
}

export const rateText = (m: Method) => `${METHODS[m].bps / 100}%`
export const fee = (amount: number, m: Method) => Math.round((amount * METHODS[m].bps) / 10000)
export const total = (amount: number, m: Method) => amount + fee(amount, m)
/** 마일리지: 이용료의 2% (내림) */
export const mileageOf = (feeValue: number) => Math.floor((feeValue * 2) / 100)

export const MIN_AMOUNT = 10_000
export const MAX_AMOUNT = 20_000_000

export type ContractType = 'GOODS' | 'FOOD' | 'BEVERAGE' | 'RENT' | 'DEPOSIT' | 'INTERIOR' | 'MAINTENANCE' | 'ETC'

export const CONTRACT_TYPES: Record<ContractType, { label: string; proof: string; needsAddress: boolean; hint: string }> = {
  GOODS: { label: '물품대금', proof: '거래명세서 또는 세금계산서', needsAddress: false, hint: '도매·사입·포장재' },
  FOOD: { label: '식자재', proof: '거래명세서 또는 세금계산서', needsAddress: false, hint: '채소·정육·수산' },
  BEVERAGE: { label: '음료', proof: '거래명세서 또는 세금계산서', needsAddress: false, hint: '커피·탄산·생수' },
  RENT: { label: '월세·임대료', proof: '임대차계약서', needsAddress: true, hint: '매장·사무실·창고' },
  DEPOSIT: { label: '보증금', proof: '임대차계약서', needsAddress: true, hint: '사업장 보증금' },
  INTERIOR: { label: '수리·인테리어', proof: '견적서 또는 공사계약서', needsAddress: true, hint: '시공·설비·간판' },
  MAINTENANCE: { label: '관리비', proof: '관리비 고지서', needsAddress: true, hint: '상가·건물 관리비' },
  ETC: { label: '기타', proof: '거래 사실을 확인할 수 있는 서류', needsAddress: false, hint: '그 밖의 사업대금' },
}

export type ContractStatus = 'REVIEW' | 'APPROVED' | 'REJECTED'
export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = { REVIEW: '검토중', APPROVED: '승인', REJECTED: '반려' }

export interface Contract {
  id: string
  type: ContractType
  title: string
  payeeName: string
  bank: string
  account: string
  holder: string
  senderName: string
  address: string
  proofs: string[]
  createdAt: number
  status: ContractStatus
  rejectReason?: string | null
}

export type TransferStatus = 'WAITING_SEND' | 'SCHEDULED' | 'SENDING' | 'COMPLETED' | 'CANCELED' | 'FAILED'
export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  WAITING_SEND: '송금 대기', SCHEDULED: '예약됨', SENDING: '송금 중', COMPLETED: '송금 완료', CANCELED: '취소', FAILED: '송금 실패',
}

export interface CardCharge { company: string; installment: number; amount: number }

export interface Transfer {
  id: string
  contractId: string
  contractTitle: string
  payeeName: string
  bank: string
  maskedAccount: string
  holder: string
  senderName: string
  memo: string
  amount: number
  fee: number
  method: Method
  scheduledDate: string | null
  cards: CardCharge[]
  mileage: number
  createdAt: number
  completedAt: number | null
  /** 고액이라 관리자 확인을 기다리는 중 */
  reviewPending?: boolean
  status: TransferStatus
}

export interface User {
  /** 본인인증 전에는 비어 있어요 */
  name: string
  phone: string
  carrier: string
  birth: string
  /** 자동으로 정해지는 닉네임(멋진사장님12 같은), 바꿀 수 있어요 */
  nickname: string
  /** 휴대폰 본인인증을 마쳤는지: 계약 등록·결제에 필요 */
  verified: boolean
}
export interface MileageLog { title: string; amount: number; at: number }

export const maskAccount = (acc: string) => (acc.length <= 4 ? acc : '*'.repeat(Math.min(acc.length - 4, 6)) + acc.slice(-4))
export const installmentText = (n: number) => (n <= 1 ? '일시불' : `${n}개월`)

export const BANKS = [
  'KB국민은행', '신한은행', '우리은행', '하나은행', 'NH농협은행', 'IBK기업은행', '카카오뱅크', '토스뱅크', '케이뱅크',
  'SC제일은행', '부산은행', '대구은행(iM뱅크)', '경남은행', '광주은행', '전북은행', '제주은행', '새마을금고', '신협', '우체국', '수협은행',
]
export const CARD_COMPANIES = ['신한카드', '삼성카드', '현대카드', 'KB국민카드', '롯데카드', '하나카드', '우리카드', 'NH농협카드', 'BC카드', 'IBK기업카드']
