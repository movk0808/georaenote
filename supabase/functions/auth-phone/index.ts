// 휴대폰 번호 로그인 (앱·웹 공용)
// - request: 인증번호를 만들고 저장. 데모 모드에서는 응답에 번호를 함께 돌려줘요(문자 발송 대신).
// - verify : 번호가 맞으면 그 휴대폰 번호의 계정을 찾거나 만들고, 로그인 세션을 돌려줘요.
// 같은 번호로 로그인하면 안드로이드 앱과 웹앱이 같은 계정·같은 데이터를 봅니다.
//
// 실서비스 전환: request 단계를 본인인증 대행사(PASS 등) 결과 확인으로 바꾸고 DEMO_MODE 를 끄세요.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const DEMO_MODE = (Deno.env.get('DEMO_MODE') ?? 'true') !== 'false'
const CODE_TTL_SEC = 300
const MAX_ATTEMPTS = 5

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const digits = (s: unknown) => String(s ?? '').replace(/\D/g, '')
const sha256 = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))))
    .map((b) => b.toString(16).padStart(2, '0')).join('')
// 휴대폰 번호마다 고정된 내부 이메일(사용자에게는 보이지 않음)
const internalEmail = (phone: string) => `p${phone}@phone.georaenote.invalid`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST만 지원해요' }, 405)

  const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: '요청 형식이 올바르지 않아요' }, 400) }
  const phone = digits(body.phone)
  if (!/^01\d{8,9}$/.test(phone)) return json({ error: '휴대폰 번호를 확인해 주세요' }, 400)

  if (body.action === 'request') {
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
    const { error } = await admin.from('phone_codes').upsert({
      phone, code_hash: await sha256(`${phone}:${code}`), attempts: 0,
      expires_at: new Date(Date.now() + CODE_TTL_SEC * 1000).toISOString(),
    })
    if (error) return json({ error: '인증번호를 만들지 못했어요' }, 500)
    // TODO(실서비스): 문자 발송 또는 본인인증 대행사 연동
    return json({ ok: true, expires_in: CODE_TTL_SEC, ...(DEMO_MODE ? { demo_code: code } : {}) })
  }

  if (body.action === 'verify') {
    const code = digits(body.code)
    const name = String(body.name ?? '').trim().slice(0, 20)
    const birth = digits(body.birth).slice(0, 8)
    const carrier = String(body.carrier ?? '').slice(0, 20)
    if (!name) return json({ error: '이름을 입력해 주세요' }, 400)

    const { data: row } = await admin.from('phone_codes').select('*').eq('phone', phone).maybeSingle()
    if (!row || new Date(row.expires_at) < new Date()) return json({ error: '인증번호가 만료됐어요. 다시 받아 주세요' }, 400)
    if (row.attempts >= MAX_ATTEMPTS) return json({ error: '시도 횟수를 넘었어요. 다시 받아 주세요' }, 429)
    if (row.code_hash !== await sha256(`${phone}:${code}`)) {
      await admin.from('phone_codes').update({ attempts: row.attempts + 1 }).eq('phone', phone)
      return json({ error: '인증번호가 일치하지 않아요' }, 400)
    }
    await admin.from('phone_codes').delete().eq('phone', phone)

    const email = internalEmail(phone)
    // 계정이 없으면 먼저 만들고(이미 있으면 오류를 무시), 일회용 로그인 토큰을 받아 세션으로 바꿔요
    const { error: createErr } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { phone } })
    if (createErr && !/already|registered|exists/i.test(createErr.message)) {
      return json({ error: '계정을 만들지 못했어요', ...(DEMO_MODE ? { detail: createErr.message } : {}) }, 500)
    }
    const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    const hashed = link?.properties?.hashed_token
    if (!hashed) return json({ error: '로그인 링크를 만들지 못했어요' }, 500)
    const anon = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: session, error: otpErr } = await anon.auth.verifyOtp({
      token_hash: hashed,
      type: (link.properties.verification_type as 'magiclink' | 'signup') ?? 'magiclink',
    })
    if (otpErr || !session.session || !session.user) return json({ error: '로그인하지 못했어요', ...(DEMO_MODE ? { detail: otpErr?.message } : {}) }, 500)

    const { data: existing } = await admin.from('profiles').select('id').eq('id', session.user.id).maybeSingle()
    const profile = { id: session.user.id, name, phone, carrier, birth, verified_at: new Date().toISOString() }
    const { error: profErr } = existing
      ? await admin.from('profiles').update({ name, carrier, birth, verified_at: profile.verified_at }).eq('id', session.user.id)
      : await admin.from('profiles').insert(profile)
    if (profErr) return json({ error: '회원 정보를 저장하지 못했어요' }, 500)

    const s = session.session
    return json({
      access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, expires_at: s.expires_at,
      user_id: session.user.id, new_user: !existing,
    })
  }
  return json({ error: '알 수 없는 요청이에요' }, 400)
})
