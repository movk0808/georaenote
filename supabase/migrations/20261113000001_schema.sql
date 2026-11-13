-- 거래노트 기본 스키마
-- 금액은 모두 원 단위 정수(bigint), 이용료율은 bps(1/100 %) 정수입니다.

create extension if not exists pgcrypto;

-- ---------- 열거형 ----------
create type public.contract_type as enum ('GOODS','FOOD','BEVERAGE','RENT','DEPOSIT','INTERIOR','MAINTENANCE','ETC');
create type public.contract_status as enum ('REVIEW','APPROVED','REJECTED','SUSPENDED');
create type public.transfer_method as enum ('INSTANT','SCHEDULED');
create type public.transfer_status as enum ('PAID','WAITING_SEND','SCHEDULED','SENDING','COMPLETED','FAILED','CANCELED');
create type public.staff_role as enum ('ADMIN','REVIEWER','VIEWER');
create type public.inquiry_status as enum ('OPEN','ANSWERED','CLOSED');
create type public.review_status as enum ('PENDING','PUBLISHED','HIDDEN');

-- ---------- 운영 설정(이용료율·한도 등) ----------
create table public.settings (
  id boolean primary key default true check (id),
  instant_bps int not null default 400,
  scheduled_bps int not null default 350,
  mileage_percent int not null default 2,
  first_transfer_bonus bigint not null default 3000,
  quiz_reward bigint not null default 10,
  min_amount bigint not null default 10000,
  max_amount bigint not null default 20000000,
  max_split_cards int not null default 3,
  -- 데모 모드: 계약 등록 후 이 초가 지나면 자동 승인(0이면 끔). 실서비스에서는 0
  demo_auto_approve_seconds int not null default 10,
  pg_fee_bps int not null default 230,          -- 대시보드 순이익 추정용 PG 수수료율(예시)
  pg_settlement_days int not null default 3,    -- 카드대금 정산까지 영업일(예시)
  updated_at timestamptz not null default now()
);
insert into public.settings default values;

-- ---------- 회원 ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  carrier text,
  birth text,
  business_name text,
  business_number text,
  verified_at timestamptz,               -- 본인인증 완료 시각(연동 전까지는 체험 인증)
  suspended boolean not null default false,
  marketing_opt_in boolean not null default false,
  notifications_on boolean not null default true,
  created_at timestamptz not null default now()
);

-- 관리자·심사자
create table public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text not null,
  role public.staff_role not null default 'REVIEWER',
  created_at timestamptz not null default now()
);

-- ---------- 계약(거래처) ----------
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.contract_type not null,
  title text not null,
  payee_name text not null,
  bank text not null,
  account text not null,
  holder text not null,
  sender_name text not null,
  address text not null default '',
  status public.contract_status not null default 'REVIEW',
  reject_reason text,
  reviewed_by uuid references public.staff(user_id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index contracts_user_idx on public.contracts(user_id, created_at desc);
create index contracts_status_idx on public.contracts(status, created_at);

create table public.contract_documents (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  file_name text not null,
  storage_path text,                     -- 스토리지 'proofs' 버킷 경로(샘플 서류는 null)
  created_at timestamptz not null default now()
);
create index contract_documents_contract_idx on public.contract_documents(contract_id);

-- 심사 이력
create table public.contract_reviews (
  id bigint generated always as identity primary key,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  staff_id uuid references public.staff(user_id),
  action public.contract_status not null,
  memo text,
  created_at timestamptz not null default now()
);

-- ---------- 송금(결제 1건 = 송금 1건) ----------
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  contract_id uuid not null references public.contracts(id),
  -- 송금 시점의 계약 정보 스냅샷(계약이 바뀌거나 지워져도 영수증은 그대로)
  payee_name text not null,
  bank text not null,
  masked_account text not null,
  holder text not null,
  sender_name text not null,
  memo text not null default '',
  amount bigint not null check (amount > 0),
  fee bigint not null check (fee >= 0),
  fee_bps int not null,
  method public.transfer_method not null,
  scheduled_date date,
  mileage bigint not null default 0,
  status public.transfer_status not null default 'PAID',
  pg_provider text not null default 'MOCK',
  pg_payment_key text,                   -- PG 결제 키(연동 후)
  payout_ref text,                       -- 송금 업체 거래번호(연동 후)
  fail_reason text,
  paid_at timestamptz not null default now(),
  completed_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  check (method = 'INSTANT' or scheduled_date is not null)
);
create index transfers_user_idx on public.transfers(user_id, created_at desc);
create index transfers_status_idx on public.transfers(status, scheduled_date);
create index transfers_paid_idx on public.transfers(paid_at);

-- 분할결제 카드
create table public.card_charges (
  id bigint generated always as identity primary key,
  transfer_id uuid not null references public.transfers(id) on delete cascade,
  company text not null,
  installment int not null default 1 check (installment between 1 and 24),
  amount bigint not null check (amount > 0),
  approval_no text,
  created_at timestamptz not null default now()
);
create index card_charges_transfer_idx on public.card_charges(transfer_id);

-- 상태 변경 이력(운영 추적용)
create table public.transfer_events (
  id bigint generated always as identity primary key,
  transfer_id uuid not null references public.transfers(id) on delete cascade,
  status public.transfer_status not null,
  actor uuid,
  note text,
  created_at timestamptz not null default now()
);

-- ---------- 마일리지 원장 ----------
create table public.mileage_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount bigint not null,
  reason text not null,
  transfer_id uuid references public.transfers(id) on delete set null,
  created_at timestamptz not null default now()
);
create index mileage_user_idx on public.mileage_ledger(user_id, created_at desc);

create table public.quiz_answers (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  correct boolean not null,
  primary key (user_id, day)
);

-- ---------- 고객 문의·후기 ----------
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  answer text,
  status public.inquiry_status not null default 'OPEN',
  answered_by uuid references public.staff(user_id),
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  transfer_id uuid references public.transfers(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  body text not null,
  status public.review_status not null default 'PENDING',
  created_at timestamptz not null default now()
);

-- ---------- 콘텐츠(공지 등은 관리자에서 편집) ----------
create table public.notices (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  published boolean not null default true,
  published_at date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------- 관리자 작업 기록 ----------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  staff_id uuid,
  action text not null,
  target text,
  detail jsonb,
  created_at timestamptz not null default now()
);
