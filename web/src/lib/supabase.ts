import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase 연결 설정. 값은 web/.env.local(로컬)이나 GitHub 저장소 변수(배포)에서 읽어요.
 * 둘 다 비어 있으면 서버 없이 브라우저 저장소만 쓰는 체험 모드로 동작합니다.
 * 호스팅을 옮길 때도 이 두 값만 새 호스팅의 환경 변수에 넣으면 돼요.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const sb: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'georaenote-auth' } })
  : null

export const REMOTE = !!sb

/** 서버 함수(Edge Function) 호출 */
export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  if (!url || !key) throw new Error('서버가 연결되지 않았어요')
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? '요청을 처리하지 못했어요')
  return data as T
}

/** PostgREST 오류를 사용자에게 보여줄 문장으로 */
export function errText(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: string }).message)
  return '요청을 처리하지 못했어요'
}
