-- 휴대폰 인증번호(서버 함수 auth-phone 전용, 클라이언트는 직접 읽고 쓸 수 없음)
create table public.phone_codes (
  phone text primary key,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.phone_codes enable row level security;
-- 정책을 두지 않아 anon/authenticated 접근 불가. service_role(서버 함수)만 사용.
