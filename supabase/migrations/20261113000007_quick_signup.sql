-- 간편 가입: 바로 시작(익명 계정)·구글·카카오로 먼저 들어오고, 돈이 오가기 직전에만 본인인증 1회
-- - 모든 회원은 자동 닉네임(멋진사장님12 같은)을 가져요. 나중에 바꿀 수 있어요.
-- - 이름·휴대폰은 본인인증을 마친 뒤에만 채워져요.
-- - 계약 등록과 결제는 본인인증(verified_at)이 있어야 해요.

create sequence if not exists public.nickname_seq start 1;

create or replace function public.gen_nickname() returns text
language sql volatile set search_path = public as $$
  select (array['멋진사장님','든든한사장님','부지런한사장님','똑똑한사장님','다정한사장님','성실한사장님'])[1 + floor(random() * 6)::int]
         || nextval('public.nickname_seq')::text
$$;

alter table public.profiles alter column name drop not null;
alter table public.profiles alter column phone drop not null;
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists auth_provider text;
update public.profiles set nickname = public.gen_nickname() where nickname is null;
alter table public.profiles alter column nickname set default public.gen_nickname();
alter table public.profiles alter column nickname set not null;
create unique index if not exists profiles_nickname_key on public.profiles (lower(nickname));
-- 한 휴대폰 번호는 한 계정에서만 본인인증할 수 있어요
create unique index if not exists profiles_verified_phone_key on public.profiles (phone) where verified_at is not null;

-- 로그인 직후 프로필이 없으면 만들기(바로 시작·구글·카카오 공통). 이미 있으면 그대로 돌려줘요.
create or replace function public.ensure_profile() returns public.profiles
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := require_user(); r profiles; prov text;
begin
  select * into r from profiles where id = uid;
  if r.id is not null then return r; end if;
  select case when u.is_anonymous then 'quick' else coalesce(u.raw_app_meta_data->>'provider', 'email') end
    into prov from auth.users u where u.id = uid;
  insert into profiles(id, auth_provider) values (uid, prov) on conflict (id) do nothing;
  select * into r from profiles where id = uid;
  return r;
end $$;

-- 닉네임 바꾸기: 2~12자, 한글·영문·숫자만, 다른 사람과 겹치면 안 돼요
create or replace function public.update_nickname(p_nickname text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare uid uuid := require_user(); n text := trim(p_nickname); r profiles;
begin
  if n !~ '^[가-힣A-Za-z0-9]{2,12}$' then raise exception '닉네임은 한글·영문·숫자 2~12자로 정해 주세요'; end if;
  if exists (select 1 from profiles where lower(nickname) = lower(n) and id <> uid) then raise exception '이미 쓰고 있는 닉네임이에요'; end if;
  update profiles set nickname = n where id = uid returning * into r;
  return r;
end $$;

-- 계약 등록·결제 전 본인인증 확인(함수마다 넣지 않고 테이블에서 한 번에 막아요)
create or replace function public.require_verified_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = new.user_id and verified_at is not null) then
    raise exception '본인인증이 필요해요' using errcode = 'GN401', hint = 'verify';
  end if;
  return new;
end $$;

drop trigger if exists contracts_require_verified on public.contracts;
create trigger contracts_require_verified before insert on public.contracts
  for each row execute function public.require_verified_owner();
drop trigger if exists transfers_require_verified on public.transfers;
create trigger transfers_require_verified before insert on public.transfers
  for each row execute function public.require_verified_owner();

-- 데모 데이터 생성 함수가 만든 가상 사장님은 본인인증된 상태로 들어가요(verified_at = now()) — 변경 없음
