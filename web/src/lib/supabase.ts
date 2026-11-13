import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase 연결 설정. 값은 web/.env.local(로컬)이나 GitHub 저장소 변수(배포)에서 읽어요.
 * 둘 다 비어 있으면 서버 없이 브라우저 저장소만 쓰는 체험 모드로 동작합니다.
 * 호스팅을 옮길 때도 이 두 값만 새 호스팅의 환경 변수에 넣으면 돼요.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * 네이버 로그인에서 돌아오면 주소 끝(#)에 세션이 붙어 와요. 화면을 그리기 전에 떼어 내서 보관해요.
 * (# 뒤 값은 서버로 전송되지 않아요)
 */
export const naverReturn: { at?: string; rt?: string; error?: string } = (() => {
  if (typeof location === 'undefined' || !/^#gn_naver_/.test(location.hash)) return {}
  const p = new URLSearchParams(location.hash.slice(1))
  history.replaceState(null, '', `${location.pathname}${location.search}#/${p.get('gn_naver_error') ? 'login' : 'app'}`)
  return { at: p.get('gn_naver_at') ?? undefined, rt: p.get('gn_naver_rt') ?? undefined, error: p.get('gn_naver_error') ?? undefined }
})()

export const sb: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'georaenote-auth', flowType: 'pkce', detectSessionInUrl: true } })
  : null

export const REMOTE = !!sb

export type SocialProvider = 'google' | 'kakao' | 'naver'

/** 켜 둔 소셜 로그인(예: "google,kakao,naver"). 각 개발자 센터 키를 등록한 뒤 VITE_AUTH_PROVIDERS 에 적어요 */
export const SOCIAL = ((import.meta.env.VITE_AUTH_PROVIDERS as string | undefined) ?? '').split(',').map((x) => x.trim())
  .filter((x): x is SocialProvider => x === 'google' || x === 'kakao' || x === 'naver')

/** 네이버 로그인 시작 주소(서버 함수가 네이버 로그인 화면으로 보내 줘요) */
export const naverStartUrl = (site: string) =>
  `${url}/functions/v1/auth-naver?start=1&redirect=${encodeURIComponent(site)}`

/** 서버 함수(Edge Function) 호출 */
export async function callFunction<T>(name: string, body: unknown, userToken?: string): Promise<T> {
  if (!url || !key) throw new Error('서버가 연결되지 않았어요')
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${userToken ?? key}` },
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
