-- 보안 강화 (2026-11-13)
-- 1) 계좌번호 암호화 저장: 원문은 account_enc(암호문)에만, account 칸에는 가린 번호만 남겨요
-- 2) 송금 한도: 1일·1개월·가입 초기 한도, 고액 송금은 관리자 확인 후 지급
-- 3) 관리자 2단계 로그인(OTP) 필수
-- 4) 함수 실행 권한 정리(로그인 안 한 사람은 서버 함수를 부를 수 없게)

create extension if not exists pgcrypto with schema extensions;

-- ---------- 1) 계좌번호 암호화 ----------
-- 암호화 키는 Supabase Vault 에 보관(DB 백업·테이블 조회만으로는 원문을 볼 수 없어요)
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'account_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'account_key', '거래처 계좌번호 암호화 키');
  end if;
end $$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.account_key() returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'account_key' limit 1
$$;
revoke all on function private.account_key() from public, anon, authenticated;

alter table public.contracts add column if not exists account_enc bytea;

-- 계약이 저장될 때마다 원문 계좌번호를 암호화하고, account 칸은 가린 번호로 바꿔요
create or replace function private.protect_account() returns trigger
language plpgsql security definer set search_path = '' as $$
declare acc text := regexp_replace(coalesce(new.account, ''), '\D', '', 'g');
begin
  if new.account like '*%' then return new; end if;            -- 이미 가린 번호(암호문 유지)
  new.account_enc := extensions.pgp_sym_encrypt(acc, private.account_key());
  new.account := public.mask_account(acc);
  return new;
end $$;

drop trigger if exists contracts_protect_account on public.contracts;
create trigger contracts_protect_account before insert or update of account on public.contracts
  for each row execute function private.protect_account();

-- 이미 들어 있는 계좌번호도 암호화
update public.contracts set account = account where account not like '*%';

-- 관리자: 전체 계좌번호 보기(기록이 남아요)
create or replace function public.admin_reveal_account(p_contract_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v text;
begin
  if not public.is_staff('REVIEWER') then raise exception '권한이 없어요'; end if;
  select extensions.pgp_sym_decrypt(account_enc, private.account_key()) into v from public.contracts where id = p_contract_id;
  perform public.audit('contract.reveal_account', p_contract_id::text, null);
  return v;
end $$;

-- ---------- 2) 송금 한도 ----------
alter table public.settings
  add column if not exists daily_limit bigint not null default 30000000,          -- 1인 1일 송금 합계
  add column if not exists monthly_limit bigint not null default 100000000,       -- 1인 1개월 송금 합계
  add column if not exists new_user_days int not null default 7,                  -- 가입 후 이 기간은
  add column if not exists new_user_daily_limit bigint not null default 3000000,  -- 1일 한도를 낮게
  add column if not exists review_amount bigint not null default 10000000,        -- 이 금액 이상은 관리자 확인 후 지급
  add column if not exists require_admin_mfa boolean not null default true;

alter table public.transfers
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_approved_at timestamptz,
  add column if not exists review_approved_by uuid;

create or replace function private.check_transfer_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  s public.settings; joined timestamptz; day_sum bigint; month_sum bigint; day_cap bigint;
  kst_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  -- 사용자가 자기 송금을 만들 때만 검사(관리자 체험 데이터 생성·서버 작업은 제외)
  if auth.uid() is null or new.user_id is distinct from auth.uid() then return new; end if;
  select * into s from public.settings;
  select created_at into joined from public.profiles where id = new.user_id;
  select coalesce(sum(amount), 0) into day_sum from public.transfers
    where user_id = new.user_id and status not in ('CANCELED','FAILED') and (paid_at at time zone 'Asia/Seoul')::date = kst_today;
  select coalesce(sum(amount), 0) into month_sum from public.transfers
    where user_id = new.user_id and status not in ('CANCELED','FAILED')
      and date_trunc('month', paid_at at time zone 'Asia/Seoul') = date_trunc('month', now() at time zone 'Asia/Seoul');
  day_cap := case when joined > now() - make_interval(days => s.new_user_days) then least(s.daily_limit, s.new_user_daily_limit) else s.daily_limit end;
  if day_sum + new.amount > day_cap then
    raise exception '오늘 송금 한도(%)를 넘어요. 남은 한도는 %예요', public.won(day_cap), public.won(greatest(day_cap - day_sum, 0));
  end if;
  if month_sum + new.amount > s.monthly_limit then
    raise exception '이번 달 송금 한도(%)를 넘어요. 남은 한도는 %예요', public.won(s.monthly_limit), public.won(greatest(s.monthly_limit - month_sum, 0));
  end if;
  new.needs_review := new.amount >= s.review_amount;
  return new;
end $$;

drop trigger if exists transfers_check_limits on public.transfers;
create trigger transfers_check_limits before insert on public.transfers
  for each row execute function private.check_transfer_limits();

-- 고액 송금: 관리자 확인 전에는 지급하지 않아요
create or replace function public._complete_transfer(p_id uuid, p_actor uuid, p_note text) returns public.transfers
language plpgsql security definer set search_path = public as $$
declare t transfers; s settings; first_ever boolean;
begin
  select * into s from settings;
  select * into t from transfers where id = p_id for update;
  if t.id is null or t.status in ('COMPLETED','CANCELED') then return t; end if;
  if t.needs_review and t.review_approved_at is null then
    raise exception '고액 송금이라 관리자 확인 후 보내져요. 보통 영업일 1일 안에 처리돼요';
  end if;
  first_ever := not exists (select 1 from transfers where user_id = t.user_id and status = 'COMPLETED');
  update transfers set status = 'COMPLETED', completed_at = now(), payout_ref = coalesce(payout_ref, 'MOCK-' || substr(md5(random()::text), 1, 10))
    where id = p_id returning * into t;
  insert into transfer_events(transfer_id, status, actor, note) values (p_id, 'COMPLETED', p_actor, p_note);
  if t.mileage > 0 then
    insert into mileage_ledger(user_id, amount, reason, transfer_id) values (t.user_id, t.mileage, '송금 적립 · ' || t.payee_name, t.id);
  end if;
  if first_ever and s.first_transfer_bonus > 0 then
    insert into mileage_ledger(user_id, amount, reason, transfer_id) values (t.user_id, s.first_transfer_bonus, '첫 송금 이벤트', t.id);
  end if;
  return t;
end $$;

-- 예약송금 자동 지급은 관리자 확인이 필요한 건을 건너뛰어요
create or replace function public.tick() returns void
language plpgsql security definer set search_path = public as $$
declare s settings; r record;
begin
  select * into s from settings;
  if s.demo_auto_approve_seconds > 0 then
    with upd as (
      update contracts set status = 'APPROVED', reviewed_at = now()
      where status = 'REVIEW' and created_at < now() - make_interval(secs => s.demo_auto_approve_seconds)
      returning id)
    insert into contract_reviews(contract_id, action, memo) select id, 'APPROVED', '데모 자동 승인' from upd;
  end if;
  for r in select id from transfers
           where status = 'SCHEDULED' and scheduled_date <= (now() at time zone 'Asia/Seoul')::date
             and not (needs_review and review_approved_at is null) loop
    perform _complete_transfer(r.id, null, '예약송금 입금일 도래(모의 지급)');
  end loop;
end $$;

-- 관리자: 고액 송금 확인. 바로송금은 확인과 동시에 지급, 예약송금은 입금일에 지급
create or replace function public.admin_approve_transfer(p_id uuid, p_note text default null) returns public.transfers
language plpgsql security definer set search_path = public as $$
declare t transfers;
begin
  if not is_staff('REVIEWER') then raise exception '권한이 없어요'; end if;
  update transfers set review_approved_at = now(), review_approved_by = auth.uid()
    where id = p_id and status not in ('COMPLETED','CANCELED') returning * into t;
  if t.id is null then raise exception '확인할 수 없는 송금이에요'; end if;
  insert into transfer_events(transfer_id, status, actor, note) values (p_id, t.status, auth.uid(), coalesce(p_note, '고액 송금 관리자 확인'));
  perform audit('transfer.approve', p_id::text, jsonb_build_object('note', p_note));
  if t.status = 'WAITING_SEND' then t := _complete_transfer(p_id, auth.uid(), '관리자 확인 후 바로송금(모의 지급)'); end if;
  return t;
end $$;

-- 관리자 수동 지급도 확인으로 간주
create or replace function public.admin_mark_transfer(p_id uuid, p_status public.transfer_status, p_note text default null)
returns public.transfers language plpgsql security definer set search_path = public as $$
declare t transfers;
begin
  if not is_staff('ADMIN') then raise exception '권한이 없어요'; end if;
  if p_status = 'COMPLETED' then
    update transfers set review_approved_at = coalesce(review_approved_at, now()), review_approved_by = coalesce(review_approved_by, auth.uid())
      where id = p_id and needs_review;
    t := _complete_transfer(p_id, auth.uid(), coalesce(p_note, '관리자 수동 지급 처리'));
  elsif p_status = 'FAILED' then
    update transfers set status = 'FAILED', fail_reason = p_note where id = p_id and status not in ('COMPLETED','CANCELED') returning * into t;
    insert into transfer_events(transfer_id, status, actor, note) values (p_id, 'FAILED', auth.uid(), p_note);
  else
    raise exception '지원하지 않는 상태예요';
  end if;
  perform audit('transfer.' || lower(p_status::text), p_id::text, jsonb_build_object('note', p_note));
  return t;
end $$;

-- 인증번호 요청 횟수 제한(번호당 1시간에 5번)
alter table public.phone_codes
  add column if not exists request_count int not null default 0,
  add column if not exists window_start timestamptz not null default now();

-- ---------- 3) 관리자 2단계 로그인 ----------
-- 직원 권한은 OTP 인증(aal2)까지 마친 세션에서만 인정해요. (settings.require_admin_mfa 로 끌 수 있음)
create or replace function public.is_staff(min_role public.staff_role default 'VIEWER')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from staff s where s.user_id = auth.uid()
      and case min_role when 'ADMIN' then s.role = 'ADMIN'
                        when 'REVIEWER' then s.role in ('ADMIN','REVIEWER')
                        else true end)
    and (not coalesce((select require_admin_mfa from settings), true)
         or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2')
$$;

-- ---------- 4) 함수 권한 정리 ----------
alter function public.mask_account(text) set search_path = '';
alter function public.require_user() set search_path = '';
alter function public.won(bigint) set search_path = '';

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    -- 내부 전용(다른 함수·트리거 안에서만 쓰는 것)은 로그인한 사용자도 직접 못 불러요
    if f.proname in ('audit', '_complete_transfer', 'require_verified_owner') then
      execute format('revoke execute on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
-- 공개 공지·후기 읽기 규칙(RLS)이 is_staff 를 쓰므로 로그인 전에도 실행은 가능해야 해요(결과는 false)
grant execute on function public.is_staff(public.staff_role) to anon;
-- 앞으로 만드는 함수도 기본으로는 공개하지 않아요
alter default privileges in schema public revoke execute on functions from public, anon;
