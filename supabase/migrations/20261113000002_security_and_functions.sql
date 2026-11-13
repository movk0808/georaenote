-- 보안 규칙(RLS)과 서버 함수
-- 사용자 쓰기는 모두 아래 함수(RPC)를 거칩니다. 테이블에 직접 insert/update 하는 권한은 주지 않아요.

-- ---------- 도우미 ----------
create or replace function public.is_staff(min_role public.staff_role default 'VIEWER')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from staff s where s.user_id = auth.uid()
      and case min_role when 'ADMIN' then s.role = 'ADMIN'
                        when 'REVIEWER' then s.role in ('ADMIN','REVIEWER')
                        else true end)
$$;

create or replace function public.mask_account(acc text)
returns text language sql immutable as $$
  select case when length(acc) <= 4 then acc
              else repeat('*', least(length(acc) - 4, 6)) || right(acc, 4) end
$$;

create or replace function public.require_user() returns uuid language plpgsql stable as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요해요' using errcode = '28000'; end if;
  return auth.uid();
end $$;

create or replace function public.audit(p_action text, p_target text, p_detail jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into audit_logs(staff_id, action, target, detail) values (auth.uid(), p_action, p_target, p_detail)
$$;

-- ---------- RLS ----------
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_documents enable row level security;
alter table public.contract_reviews enable row level security;
alter table public.transfers enable row level security;
alter table public.card_charges enable row level security;
alter table public.transfer_events enable row level security;
alter table public.mileage_ledger enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.inquiries enable row level security;
alter table public.reviews enable row level security;
alter table public.notices enable row level security;
alter table public.audit_logs enable row level security;

create policy settings_read on public.settings for select using (true);
create policy settings_admin on public.settings for update using (public.is_staff('ADMIN'));

create policy profiles_own on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy profiles_staff_update on public.profiles for update using (public.is_staff('REVIEWER'));

create policy staff_self on public.staff for select using (user_id = auth.uid() or public.is_staff());
create policy staff_admin on public.staff for all using (public.is_staff('ADMIN')) with check (public.is_staff('ADMIN'));

create policy contracts_own on public.contracts for select using (user_id = auth.uid() or public.is_staff());
create policy documents_own on public.contract_documents for select using (
  public.is_staff() or exists (select 1 from contracts c where c.id = contract_id and c.user_id = auth.uid()));
create policy reviews_log_staff on public.contract_reviews for select using (public.is_staff());

create policy transfers_own on public.transfers for select using (user_id = auth.uid() or public.is_staff());
create policy charges_own on public.card_charges for select using (
  public.is_staff() or exists (select 1 from transfers t where t.id = transfer_id and t.user_id = auth.uid()));
create policy events_own on public.transfer_events for select using (
  public.is_staff() or exists (select 1 from transfers t where t.id = transfer_id and t.user_id = auth.uid()));

create policy mileage_own on public.mileage_ledger for select using (user_id = auth.uid() or public.is_staff());
create policy quiz_own on public.quiz_answers for select using (user_id = auth.uid() or public.is_staff());

create policy inquiries_own on public.inquiries for select using (user_id = auth.uid() or public.is_staff());
create policy inquiries_insert on public.inquiries for insert with check (user_id = auth.uid());

create policy reviews_read on public.reviews for select using (status = 'PUBLISHED' or user_id = auth.uid() or public.is_staff());
create policy reviews_insert on public.reviews for insert with check (user_id = auth.uid());
create policy reviews_staff on public.reviews for update using (public.is_staff('REVIEWER'));

create policy notices_read on public.notices for select using (published or public.is_staff());
create policy notices_staff on public.notices for all using (public.is_staff('ADMIN')) with check (public.is_staff('ADMIN'));

create policy audit_staff on public.audit_logs for select using (public.is_staff('ADMIN'));

-- ---------- 증빙 파일 저장소(비공개) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

create policy proofs_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy proofs_read on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- ---------- 사용자 함수 ----------

-- 프로필 정보 수정(본인인증으로 받은 이름·번호는 서버(auth-phone 함수)가 넣고, 여기서는 부가 정보만)
create or replace function public.update_my_profile(p_business_name text default null, p_marketing boolean default null, p_notifications boolean default null)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare r profiles;
begin
  update profiles set
    business_name = coalesce(p_business_name, business_name),
    marketing_opt_in = coalesce(p_marketing, marketing_opt_in),
    notifications_on = coalesce(p_notifications, notifications_on)
  where id = require_user() returning * into r;
  return r;
end $$;

create or replace function public.submit_contract(
  p_type public.contract_type, p_payee_name text, p_bank text, p_account text, p_holder text,
  p_sender_name text, p_address text, p_documents jsonb  -- [{"file_name": "...", "storage_path": "..."|null}]
) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := require_user(); cid uuid; label text;
begin
  if exists (select 1 from profiles where id = uid and suspended) then raise exception '이용이 정지된 계정이에요'; end if;
  if coalesce(trim(p_payee_name),'') = '' or coalesce(trim(p_holder),'') = '' or length(regexp_replace(p_account,'\D','','g')) < 8 then
    raise exception '거래처 정보를 확인해 주세요';
  end if;
  if jsonb_array_length(coalesce(p_documents,'[]'::jsonb)) = 0 then raise exception '증빙서류를 첨부해 주세요'; end if;
  label := case p_type when 'GOODS' then '물품대금' when 'FOOD' then '식자재' when 'BEVERAGE' then '음료'
    when 'RENT' then '월세·임대료' when 'DEPOSIT' then '보증금' when 'INTERIOR' then '수리·인테리어'
    when 'MAINTENANCE' then '관리비' else '기타' end;
  insert into contracts(user_id, type, title, payee_name, bank, account, holder, sender_name, address)
  values (uid, p_type, trim(p_payee_name) || ' ' || label, trim(p_payee_name), p_bank,
          regexp_replace(p_account,'\D','','g'), trim(p_holder), left(trim(p_sender_name), 10), coalesce(p_address,''))
  returning id into cid;
  insert into contract_documents(contract_id, file_name, storage_path)
  select cid, d->>'file_name', nullif(d->>'storage_path','') from jsonb_array_elements(p_documents) d;
  return cid;
end $$;

create or replace function public.delete_contract(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from transfers where contract_id = p_id and status in ('WAITING_SEND','SCHEDULED','SENDING')) then
    raise exception '진행 중인 송금이 있어 삭제할 수 없어요';
  end if;
  -- 송금 이력이 있으면 기록 보존을 위해 숨김(정지) 처리, 없으면 삭제
  if exists (select 1 from transfers where contract_id = p_id) then
    update contracts set status = 'SUSPENDED' where id = p_id and user_id = require_user();
  else
    delete from contracts where id = p_id and user_id = require_user();
  end if;
end $$;

-- 카드 결제(모의 승인) 후 송금 건 생성. PG 연동 시 이 함수는 PG 승인 웹훅(Edge Function)에서 호출하도록 바꿉니다.
create or replace function public.pay_transfer(
  p_contract_id uuid, p_amount bigint, p_method public.transfer_method, p_scheduled_date date,
  p_memo text, p_cards jsonb   -- [{"company": "신한카드", "installment": 1, "amount": 1040000}]
) returns public.transfers language plpgsql security definer set search_path = public as $$
declare
  uid uuid := require_user(); s settings; c contracts; v_bps int; v_fee bigint; v_total bigint; t transfers; card jsonb;
begin
  select * into s from settings;
  select * into c from contracts where id = p_contract_id and user_id = uid;
  if c.id is null then raise exception '계약을 찾을 수 없어요'; end if;
  if c.status <> 'APPROVED' then raise exception '승인된 계약으로만 송금할 수 있어요'; end if;
  if p_amount < s.min_amount or p_amount > s.max_amount then raise exception '송금액은 %원부터 %원까지예요', s.min_amount, s.max_amount; end if;
  if p_method = 'SCHEDULED' and (p_scheduled_date is null or p_scheduled_date <= (now() at time zone 'Asia/Seoul')::date) then
    raise exception '예약일은 내일 이후로 골라 주세요';
  end if;
  v_bps := case p_method when 'INSTANT' then s.instant_bps else s.scheduled_bps end;
  v_fee := round(p_amount * v_bps / 10000.0);
  v_total := p_amount + v_fee;
  if jsonb_array_length(coalesce(p_cards,'[]')) = 0 or jsonb_array_length(p_cards) > s.max_split_cards then
    raise exception '결제 카드는 1장에서 %장까지예요', s.max_split_cards;
  end if;
  if (select sum((x->>'amount')::bigint) from jsonb_array_elements(p_cards) x) <> v_total then
    raise exception '카드별 금액 합계가 결제 금액(%원)과 달라요', v_total;
  end if;

  insert into transfers(user_id, contract_id, payee_name, bank, masked_account, holder, sender_name, memo,
    amount, fee, fee_bps, method, scheduled_date, mileage, status)
  values (uid, c.id, c.payee_name, c.bank, mask_account(c.account), c.holder, c.sender_name, left(coalesce(p_memo,''), 40),
    p_amount, v_fee, v_bps, p_method, case when p_method = 'SCHEDULED' then p_scheduled_date end,
    floor(v_fee * s.mileage_percent / 100.0), case p_method when 'INSTANT' then 'WAITING_SEND' else 'SCHEDULED' end::transfer_status)
  returning * into t;

  for card in select * from jsonb_array_elements(p_cards) loop
    insert into card_charges(transfer_id, company, installment, amount, approval_no)
    values (t.id, card->>'company', greatest(1, coalesce((card->>'installment')::int, 1)), (card->>'amount')::bigint,
            'MOCK' || lpad((floor(random() * 1e8))::text, 8, '0'));
  end loop;
  insert into transfer_events(transfer_id, status, actor, note) values (t.id, 'PAID', uid, '카드 결제(모의 승인)');
  insert into transfer_events(transfer_id, status, actor) values (t.id, t.status, uid);
  return t;
end $$;

-- 송금 완료 처리(내부용): 마일리지 적립, 첫 송금 이벤트
create or replace function public._complete_transfer(p_id uuid, p_actor uuid, p_note text) returns public.transfers
language plpgsql security definer set search_path = public as $$
declare t transfers; s settings; first_ever boolean;
begin
  select * into s from settings;
  select * into t from transfers where id = p_id for update;
  if t.id is null or t.status in ('COMPLETED','CANCELED') then return t; end if;
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
revoke execute on function public._complete_transfer(uuid, uuid, text) from public, anon, authenticated;

-- 바로송금의 '송금하기'
create or replace function public.send_transfer(p_id uuid) returns public.transfers
language plpgsql security definer set search_path = public as $$
declare t transfers;
begin
  select * into t from transfers where id = p_id and user_id = require_user();
  if t.id is null then raise exception '송금 내역을 찾을 수 없어요'; end if;
  if t.status <> 'WAITING_SEND' then raise exception '송금할 수 없는 상태예요'; end if;
  return _complete_transfer(p_id, auth.uid(), '바로송금(모의 지급)');
end $$;

create or replace function public.cancel_transfer(p_id uuid) returns public.transfers
language plpgsql security definer set search_path = public as $$
declare t transfers;
begin
  select * into t from transfers where id = p_id and (user_id = auth.uid() or is_staff('REVIEWER'));
  if t.id is null then raise exception '송금 내역을 찾을 수 없어요'; end if;
  if t.status not in ('WAITING_SEND','SCHEDULED','FAILED','PAID') then raise exception '이미 송금되어 취소할 수 없어요'; end if;
  update transfers set status = 'CANCELED', canceled_at = now() where id = p_id returning * into t;
  insert into transfer_events(transfer_id, status, actor, note) values (p_id, 'CANCELED', auth.uid(), '카드 결제 취소(모의)');
  return t;
end $$;

-- 매일 퀴즈: 정답은 서버가 판정
create table public.quizzes (
  id int primary key,
  question text not null,
  options text[] not null,
  answer int not null,
  explain text not null
);
alter table public.quizzes enable row level security;
-- 정답 칸을 숨기기 위해 테이블 직접 조회는 막고 today_quiz()로만 읽습니다.

create or replace function public.today_quiz() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', q.id, 'question', q.question, 'options', to_jsonb(q.options),
    'answered', (select to_jsonb(a) from quiz_answers a where a.user_id = auth.uid() and a.day = (now() at time zone 'Asia/Seoul')::date))
  from quizzes q
  order by q.id
  offset (((now() at time zone 'Asia/Seoul')::date - date '2026-01-01') % greatest((select count(*) from quizzes), 1))
  limit 1
$$;

create or replace function public.answer_quiz(p_choice int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := require_user(); q jsonb; qq quizzes; ok boolean; d date := (now() at time zone 'Asia/Seoul')::date;
begin
  if exists (select 1 from quiz_answers where user_id = uid and day = d) then raise exception '오늘은 이미 참여했어요'; end if;
  q := today_quiz();
  select * into qq from quizzes where id = (q->>'id')::int;
  ok := p_choice = qq.answer;
  insert into quiz_answers(user_id, day, correct) values (uid, d, ok);
  if ok then insert into mileage_ledger(user_id, amount, reason) values (uid, (select quiz_reward from settings), '매일 퀴즈 정답'); end if;
  return jsonb_build_object('correct', ok, 'answer', qq.answer, 'explain', qq.explain);
end $$;

-- 데모 진행: 오래된 검토중 계약 자동 승인, 입금일이 된 예약송금 완료
-- (실서비스에서는 settings.demo_auto_approve_seconds = 0, 예약송금은 pg_cron/송금 업체 웹훅으로 처리)
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
  for r in select id from transfers where status = 'SCHEDULED' and scheduled_date <= (now() at time zone 'Asia/Seoul')::date loop
    perform _complete_transfer(r.id, null, '예약송금 입금일 도래(모의 지급)');
  end loop;
end $$;

-- 1:1 문의
create or replace function public.create_inquiry(p_message text) returns public.inquiries
language plpgsql security definer set search_path = public as $$
declare r inquiries;
begin
  insert into inquiries(user_id, message) values (require_user(), left(trim(p_message), 2000)) returning * into r;
  return r;
end $$;

-- 회원 탈퇴: 진행 중 송금이 없을 때 auth 계정째 삭제(연결된 데이터는 함께 삭제)
create or replace function public.withdraw_me() returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := require_user();
begin
  if exists (select 1 from transfers where user_id = uid and status in ('WAITING_SEND','SCHEDULED','SENDING')) then
    raise exception '진행 중인 송금이 있어 탈퇴할 수 없어요';
  end if;
  delete from auth.users where id = uid;
end $$;

-- ---------- 관리자 함수 ----------

-- 관리자가 아직 한 명도 없을 때, 로그인한 사람을 첫 관리자로 등록
create or replace function public.claim_first_admin(p_name text) returns public.staff
language plpgsql security definer set search_path = public, auth as $$
declare r staff;
begin
  if exists (select 1 from staff) then raise exception '이미 관리자가 있어요. 기존 관리자에게 초대를 요청하세요'; end if;
  insert into staff(user_id, email, name, role)
  values (require_user(), (select email from auth.users where id = auth.uid()), coalesce(nullif(trim(p_name),''), '관리자'), 'ADMIN')
  returning * into r;
  return r;
end $$;

-- 관리자가 다른 직원 등록(상대가 먼저 관리자 페이지에서 가입해야 함)
create or replace function public.admin_add_staff(p_email text, p_name text, p_role public.staff_role) returns public.staff
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid; r staff;
begin
  if not is_staff('ADMIN') then raise exception '권한이 없어요'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception '해당 이메일로 가입한 계정이 없어요'; end if;
  insert into staff(user_id, email, name, role) values (uid, lower(trim(p_email)), p_name, p_role)
  on conflict (user_id) do update set role = excluded.role, name = excluded.name
  returning * into r;
  perform audit('staff.add', uid::text, jsonb_build_object('role', p_role));
  return r;
end $$;

create or replace function public.admin_review_contract(p_id uuid, p_approve boolean, p_memo text default null)
returns public.contracts language plpgsql security definer set search_path = public as $$
declare c contracts;
begin
  if not is_staff('REVIEWER') then raise exception '권한이 없어요'; end if;
  update contracts set status = case when p_approve then 'APPROVED' else 'REJECTED' end::contract_status,
    reject_reason = case when p_approve then null else coalesce(nullif(trim(p_memo),''), '증빙 보완이 필요해요') end,
    reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id returning * into c;
  if c.id is null then raise exception '계약을 찾을 수 없어요'; end if;
  insert into contract_reviews(contract_id, staff_id, action, memo) values (p_id, auth.uid(), c.status, p_memo);
  perform audit(case when p_approve then 'contract.approve' else 'contract.reject' end, p_id::text, jsonb_build_object('memo', p_memo));
  return c;
end $$;

create or replace function public.admin_suspend_contract(p_id uuid, p_memo text) returns public.contracts
language plpgsql security definer set search_path = public as $$
declare c contracts;
begin
  if not is_staff('REVIEWER') then raise exception '권한이 없어요'; end if;
  update contracts set status = 'SUSPENDED', reject_reason = p_memo, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id returning * into c;
  insert into contract_reviews(contract_id, staff_id, action, memo) values (p_id, auth.uid(), 'SUSPENDED', p_memo);
  perform audit('contract.suspend', p_id::text, jsonb_build_object('memo', p_memo));
  return c;
end $$;

-- 송금 수동 처리: 지급 완료로 표시 / 실패로 표시
create or replace function public.admin_mark_transfer(p_id uuid, p_status public.transfer_status, p_note text default null)
returns public.transfers language plpgsql security definer set search_path = public as $$
declare t transfers;
begin
  if not is_staff('ADMIN') then raise exception '권한이 없어요'; end if;
  if p_status = 'COMPLETED' then
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

create or replace function public.admin_answer_inquiry(p_id uuid, p_answer text) returns public.inquiries
language plpgsql security definer set search_path = public as $$
declare r inquiries;
begin
  if not is_staff('REVIEWER') then raise exception '권한이 없어요'; end if;
  update inquiries set answer = p_answer, status = 'ANSWERED', answered_by = auth.uid(), answered_at = now()
  where id = p_id returning * into r;
  return r;
end $$;

create or replace function public.admin_set_user_suspended(p_user uuid, p_suspended boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff('ADMIN') then raise exception '권한이 없어요'; end if;
  update profiles set suspended = p_suspended where id = p_user;
  perform audit(case when p_suspended then 'user.suspend' else 'user.unsuspend' end, p_user::text);
end $$;

-- 대시보드 집계: 기간(한국 날짜 기준) 안의 결제·매출·자금 흐름
create or replace function public.admin_dashboard(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s settings; res jsonb;
begin
  if not is_staff() then raise exception '권한이 없어요'; end if;
  select * into s from settings;
  with paid as (
    select t.*, (t.paid_at at time zone 'Asia/Seoul')::date as d, c.type as ctype
    from transfers t join contracts c on c.id = t.contract_id
    where (t.paid_at at time zone 'Asia/Seoul')::date between p_from and p_to and t.status <> 'CANCELED'
  ), days as (
    select generate_series(p_from, p_to, interval '1 day')::date as d
  ), daily as (
    select d.d, coalesce(sum(p.amount),0) as gmv, coalesce(sum(p.fee),0) as fee, count(p.id) as cnt
    from days d left join paid p on p.d = d.d group by d.d order by d.d
  ), prev as (
    select coalesce(sum(amount),0) gmv, coalesce(sum(fee),0) fee, count(*) cnt from transfers
    where status <> 'CANCELED' and (paid_at at time zone 'Asia/Seoul')::date between p_from - (p_to - p_from + 1) and p_from - 1
  )
  select jsonb_build_object(
    'kpi', (select jsonb_build_object(
        'gmv', coalesce(sum(amount),0), 'fee', coalesce(sum(fee),0), 'count', count(*),
        'pg_cost', coalesce(round(sum(amount + fee) * s.pg_fee_bps / 10000.0),0),
        'mileage', coalesce(sum(mileage),0),
        'avg', coalesce(round(avg(amount)),0),
        'users', count(distinct user_id)) from paid),
    'prev', (select to_jsonb(prev) from prev),
    'daily', (select jsonb_agg(jsonb_build_object('d', d, 'gmv', gmv, 'fee', fee, 'count', cnt)) from daily),
    'by_type', (select coalesce(jsonb_agg(x order by x.gmv desc), '[]') from (
        select ctype as type, sum(amount) gmv, count(*) cnt from paid group by ctype) x),
    'by_method', (select coalesce(jsonb_agg(x), '[]') from (
        select method, sum(amount) gmv, count(*) cnt from paid group by method) x),
    'by_amount', (select coalesce(jsonb_agg(x order by x.ord), '[]') from (
        select case when amount < 300000 then 1 when amount < 1000000 then 2 when amount < 3000000 then 3 when amount < 10000000 then 4 else 5 end ord,
               case when amount < 300000 then '30만 원 미만' when amount < 1000000 then '30만~100만' when amount < 3000000 then '100만~300만'
                    when amount < 10000000 then '300만~1,000만' else '1,000만 이상' end label,
               count(*) cnt, sum(amount) gmv
        from paid group by 1, 2) x),
    'status', (select coalesce(jsonb_object_agg(status, n), '{}') from (
        select status, count(*) n from transfers group by status) x),
    'queue', jsonb_build_object(
        'review', (select count(*) from contracts where status = 'REVIEW'),
        'waiting_send', (select count(*) from transfers where status = 'WAITING_SEND'),
        'failed', (select count(*) from transfers where status = 'FAILED'),
        'inquiries', (select count(*) from inquiries where status = 'OPEN'),
        'reviews', (select count(*) from reviews where status = 'PENDING')),
    -- 앞으로 14일: 예약송금으로 나갈 돈 vs PG에서 들어올 카드대금(결제일 + 정산일, 단순 추정)
    'cashflow', (select jsonb_agg(jsonb_build_object('d', d,
        'payout', (select coalesce(sum(amount),0) from transfers where status = 'SCHEDULED' and scheduled_date = g.d),
        'settle', (select coalesce(sum(amount + fee),0) from transfers where status <> 'CANCELED'
                   and ((paid_at at time zone 'Asia/Seoul')::date + s.pg_settlement_days) = g.d)) order by d)
        from (select generate_series((now() at time zone 'Asia/Seoul')::date, (now() at time zone 'Asia/Seoul')::date + 13, interval '1 day')::date d) g),
    'reviews', (select jsonb_build_object('avg', round(avg(rating)::numeric, 2), 'count', count(*),
        'dist', (select coalesce(jsonb_object_agg(rating, n), '{}') from (select rating, count(*) n from reviews group by rating) z)) from reviews),
    'settings', to_jsonb(s)
  ) into res;
  return res;
end $$;
