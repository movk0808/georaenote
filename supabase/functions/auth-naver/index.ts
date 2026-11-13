// 네이버 로그인 (Supabase가 기본 지원하지 않아서 직접 연결)
// 1) 웹의 '네이버로 시작하기' → GET ?start=1&redirect=<사이트 주소>
//    → 네이버 로그인 화면으로 보냄(state는 쿠키에 보관)
// 2) 네이버가 이 함수로 돌려보냄(GET ?code&state) → 네이버 회원 고유번호로 계정을 찾거나 만들고
//    로그인 세션을 만들어 사이트로 돌려보냄(#gn_naver_at=...&gn_naver_rt=...)
//
// 필요한 비밀값: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET (supabase secrets set 으로 등록)
// 네이버 개발자 센터 Callback URL: https://<프로젝트>.supabase.co/functions/v1/auth-naver
import { createClient } from 'jsr:@supabase/supabase-js@2'

const URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const CLIENT_ID = Deno.env.get('NAVER_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('NAVER_CLIENT_SECRET') ?? ''
const CALLBACK = `${URL}/functions/v1/auth-naver`
// 로그인 후 돌아갈 수 있는 주소(그 외 주소는 거절)
const ALLOWED = ['https://movk0808.github.io/georaenote/', 'http://localhost:5173/']
const COOKIE = 'gn_naver'

const sha256 = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))))
    .map((b) => b.toString(16).padStart(2, '0')).join('')
const randomHex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n))).map((b) => b.toString(16).padStart(2, '0')).join('')
const redirect = (to: string, headers: Record<string, string> = {}) => new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store', ...headers } })
const clearCookie = `${COOKIE}=; Path=/functions/v1/auth-naver; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
const back = (site: string, frag: Record<string, string>) =>
  redirect(`${site}#${new URLSearchParams(frag).toString()}`, { 'Set-Cookie': clearCookie })

Deno.serve(async (req) => {
  const u = new globalThis.URL(req.url)
  if (req.method !== 'GET') return new Response('GET only', { status: 405 })
  if (!CLIENT_ID || !CLIENT_SECRET) return new Response('네이버 로그인이 아직 설정되지 않았어요', { status: 503 })

  // 1) 시작
  if (u.searchParams.get('start')) {
    const site = u.searchParams.get('redirect') ?? ''
    if (!ALLOWED.includes(site)) return new Response('허용되지 않은 주소예요', { status: 400 })
    const state = randomHex(16)
    const auth = new globalThis.URL('https://nid.naver.com/oauth2.0/authorize')
    auth.search = new URLSearchParams({ response_type: 'code', client_id: CLIENT_ID, redirect_uri: CALLBACK, state }).toString()
    const val = `${state}.${btoa(site)}`
    return redirect(auth.toString(), { 'Set-Cookie': `${COOKIE}=${val}; Path=/functions/v1/auth-naver; Max-Age=600; HttpOnly; Secure; SameSite=Lax` })
  }

  // 2) 네이버에서 돌아옴
  const cookie = (req.headers.get('Cookie') ?? '').split(/; */).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? ''
  const [savedState, siteB64] = cookie.split('.')
  let site = ALLOWED[0]
  try { const s = atob(siteB64 ?? ''); if (ALLOWED.includes(s)) site = s } catch { /* 기본 주소로 */ }
  const fail = (msg: string) => back(site, { gn_naver_error: msg })

  if (u.searchParams.get('error')) return fail('네이버 로그인을 취소했어요')
  const code = u.searchParams.get('code') ?? ''
  const state = u.searchParams.get('state') ?? ''
  if (!code || !state || state !== savedState) return fail('로그인 요청이 만료됐어요. 다시 시도해 주세요')

  // 토큰 교환
  const tokRes = await fetch('https://nid.naver.com/oauth2.0/token?' + new URLSearchParams({
    grant_type: 'authorization_code', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code, state,
  }))
  const tok = await tokRes.json().catch(() => ({})) as { access_token?: string }
  if (!tok.access_token) return fail('네이버 로그인에 실패했어요')

  // 회원 정보(고유번호·별명)
  const meRes = await fetch('https://openapi.naver.com/v1/nid/me', { headers: { Authorization: `Bearer ${tok.access_token}` } })
  const me = await meRes.json().catch(() => ({})) as { response?: { id?: string; nickname?: string } }
  const naverId = me.response?.id
  if (!naverId) return fail('네이버 회원 정보를 받지 못했어요')

  // 네이버 회원마다 고정된 내부 이메일(사용자에게는 보이지 않음)
  const email = `n${(await sha256(`naver:${naverId}`)).slice(0, 32)}@naver.georaenote.invalid`
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: createErr } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { provider: 'naver' }, app_metadata: { provider: 'naver', providers: ['naver'] } })
  if (createErr && !/already|registered|exists/i.test(createErr.message)) return fail('계정을 만들지 못했어요')

  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const hashed = link?.properties?.hashed_token
  if (!hashed) return fail('로그인하지 못했어요')
  const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: session, error: otpErr } = await anon.auth.verifyOtp({
    token_hash: hashed,
    type: (link.properties.verification_type as 'magiclink' | 'signup') ?? 'magiclink',
  })
  if (otpErr || !session.session || !session.user) return fail('로그인하지 못했어요')

  // 처음이면 프로필 만들기(닉네임은 자동)
  await admin.from('profiles').upsert({ id: session.user.id, auth_provider: 'naver' }, { onConflict: 'id', ignoreDuplicates: true })

  return back(site, { gn_naver_at: session.session.access_token, gn_naver_rt: session.session.refresh_token })
})
