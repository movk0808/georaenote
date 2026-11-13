import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

/**
 * 관리자 전용 Supabase 클라이언트. 사용자 웹앱과 로그인 정보를 따로 저장해서
 * 같은 브라우저에서 관리자·사용자로 동시에 로그인해도 섞이지 않아요.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const adb: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'georaenote-admin-auth' } })
  : null

export async function arpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await adb!.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export interface Staff { user_id: string; email: string | null; name: string; role: 'ADMIN' | 'REVIEWER' | 'VIEWER' }

/** 관리자 로그인 상태와 직원 정보 */
export function useStaff() {
  const [state, setState] = useState<{ loading: boolean; email: string | null; staff: Staff | null; aal2: boolean }>({ loading: true, email: null, staff: null, aal2: false })
  const load = async () => {
    if (!adb) { setState({ loading: false, email: null, staff: null, aal2: false }); return }
    const { data: { session } } = await adb.auth.getSession()
    if (!session) { setState({ loading: false, email: null, staff: null, aal2: false }); return }
    const { data } = await adb.from('staff').select('*').eq('user_id', session.user.id).maybeSingle()
    // 2단계 로그인(OTP)까지 마쳤는지. 직원 권한은 aal2 세션에서만 인정돼요
    const { data: aal } = await adb.auth.mfa.getAuthenticatorAssuranceLevel()
    setState({ loading: false, email: session.user.email ?? null, staff: data as Staff | null, aal2: aal?.currentLevel === 'aal2' })
  }
  useEffect(() => {
    load()
    const sub = adb?.auth.onAuthStateChange(() => { load() })
    return () => sub?.data.subscription.unsubscribe()
  }, [])
  return { ...state, reload: load }
}

/** 한 번 불러오고 다시 불러오기 함수를 주는 작은 훅 */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const run = () => {
    setLoading(true)
    fn().then((d) => { setData(d); setError(null) }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(run, deps)
  return { data, error, loading, reload: run }
}

export const CONTRACT_STATUS: Record<string, { label: string; cls: string }> = {
  REVIEW: { label: '검토중', cls: 'pill-review' },
  APPROVED: { label: '승인', cls: 'pill-ok' },
  REJECTED: { label: '반려', cls: 'pill-bad' },
  SUSPENDED: { label: '정지', cls: 'pill-neutral' },
}
export const TRANSFER_STATUS: Record<string, { label: string; cls: string }> = {
  PAID: { label: '결제됨', cls: 'pill-info' },
  WAITING_SEND: { label: '송금 대기', cls: 'pill-info' },
  SCHEDULED: { label: '예약됨', cls: 'pill-info' },
  SENDING: { label: '송금 중', cls: 'pill-info' },
  COMPLETED: { label: '송금 완료', cls: 'pill-ok' },
  FAILED: { label: '실패', cls: 'pill-bad' },
  CANCELED: { label: '취소', cls: 'pill-neutral' },
}
export const TYPE_LABEL: Record<string, string> = {
  GOODS: '물품대금', FOOD: '식자재', BEVERAGE: '음료', RENT: '월세·임대료', DEPOSIT: '보증금',
  INTERIOR: '수리·인테리어', MAINTENANCE: '관리비', ETC: '기타',
}

const nf = new Intl.NumberFormat('ko-KR')
export const won = (v: number) => `${nf.format(Math.round(v))}원`
/** 큰 금액을 '1.2억', '3,450만' 처럼 짧게 */
export const short = (v: number) => {
  if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(v >= 1e9 ? 0 : 1).replace(/\.0$/, '')}억`
  if (Math.abs(v) >= 1e4) return `${nf.format(Math.round(v / 1e4))}만`
  return nf.format(v)
}
export const dt = (iso: string | null | undefined) => {
  if (!iso) return '-'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
