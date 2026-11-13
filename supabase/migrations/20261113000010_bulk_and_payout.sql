-- 일괄 송금(사장님)과 송금 처리(거래노트 운영) (2026-11-13)
--
-- 송금 처리 방식(settings.payout_mode)
--   AUTO  : 체험판. '송금하기'를 누르거나 예약일이 되면 바로 완료(모의 지급)
--   BATCH : 실제 운영. 보낼 건이 '송금 중(SENDING)'으로 모이고, 관리자가 묶음을 만들어
--           은행 대량이체 파일로 보내고 결재·완료 처리해요(나중에 펌뱅킹·PG 지급대행 API로 대체)

alter table public.settings
  add column if not exists payout_mode text not null default 'AUTO' check (payout_mode in ('AUTO','BATCH')),
  add column if not exists payout_two_person boolean not null default false;   -- 켜면 묶음을 만든 사람과 다른 직원이 결재

create table if not exists public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'DRAFT' check (status in ('DRAFT','APPROVED','DONE','CANCELED')),
  item_count int not null default 0,
  total_amount bigint not null default 0,
  memo text not null default '',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  file_downloaded_at timestamptz,
  done_by uuid,
  done_at timestamptz
);
alter table public.payout_batches enable row level security;
drop policy if exists payout_batches_staff on public.payout_batches;
create policy payout_batches_staff on public.payout_batches for select using (public.is_staff());

alter table public.transfers add column if not exists payout_batch_id uuid references public.payout_batches(id);
alter table public.transfers add column if not exists send_requested_at timestamptz;

-- 지급 단계로 넘기기: AUTO 면 바로 완료, BATCH 면 송금 중으로 모아 둬요
create or replace function public._queue_payout(p_id uuid, p_actor uuid, p_note text) returns public.transfers
language plpgsql security definer set search_path = public as $$
declare t transfers; mode text;
begin
  select payout_mode into mode from settings;
  select * into t from transfers where id = p_id for update;
  if t.needs_review and t.review_approved_at is null then
    raise exception '고액 송금이라 관리자 확인 후 보내져요. 보통 영업일 1일 안에 처리돼요';
  end if;
  if mode = 'AUTO' then return _complete_transfer(p_id, p_actor, p_note); end if;
  update transfers set status = 'SENDING', send_requested_at = now() where id = p_id returning * into t;
  insert into transfer_events(transfer_id, status, actor, note) values (p_id, 'SENDING', p_actor, '송금 접수 · 거래노트가 거래처로 보내는 중');
  return t;
end $$;

create or replace function public.send_transfer(p_id uuid) returns public.transfers
language plpgsql security definer set search_path = public as $$
declare t transfers;
begin
  select * into t from transfers where id = p_id and user_id = require_user();
  if t.id is null then raise exception '송금 내역을 찾을 수 없어요'; end if;
  if t.status <> 'WAITING_SEND' then raise exception '송금할 수 없는 상태예요'; end if;
  update transfers set send_requested_at = coalesce(send_requested_at, now()) where id = p_id returning * into t;
  -- 고액이면 요청만 받아 두고, 관리자 확인 뒤 자동으로 보내요
  if t.needs_review and t.review_approved_at is null then
    insert into transfer_events(transfer_id, status, actor, note) values (p_id, t.status, auth.uid(), '송금 요청 · 고액이라 관리자 확인 후 보내져요');
    return t;
  end if;
  return _queue_payout(p_id, auth.uid(), '바로송금(모의 지급)');
end $$;

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
    perform _queue_payout(r.id, null, '예약송금 입금일 도래(모의 지급)');
  end loop;
end $$;

-- 고액 확인 후 바로송금도 같은 지급 단계로
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
  if t.status = 'WAITING_SEND' and t.send_requested_at is not null then t := _queue_payout(p_id, auth.uid(), '관리자 확인 후 바로송금'); end if;
  return t;
end $$;

-- ---------- 사장님: 엑셀 일괄 송금 ----------
-- 줄마다 은행·계좌번호로 내 승인된 계약을 찾아요(계좌번호는 암호화돼 있어 서버에서만 비교)
create or replace function public.match_bulk_rows(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_user(); r jsonb; out jsonb := '[]'; acc text; i int := 0;
  v_id uuid; v_status text; v_title text; v_payee text; v_holder text;
begin
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]')) loop
    acc := regexp_replace(coalesce(r->>'account', ''), '\D', '', 'g');
    v_id := null; v_status := null; v_title := null; v_payee := null; v_holder := null;
    select x.id, x.status::text, x.title, x.payee_name, x.holder into v_id, v_status, v_title, v_payee, v_holder from public.contracts x
      where x.user_id = uid and x.bank = r->>'bank' and x.status <> 'SUSPENDED'
        and extensions.pgp_sym_decrypt(x.account_enc, private.account_key()) = acc
      order by (x.status = 'APPROVED') desc, x.created_at desc limit 1;
    out := out || jsonb_build_array(jsonb_build_object('index', i, 'contract_id', v_id, 'status', v_status, 'title', v_title, 'payee_name', v_payee, 'holder', v_holder));
    i := i + 1;
  end loop;
  return out;
end $$;

-- 여러 건을 카드 한 장으로 한 번에 결제(전부 성공하거나 전부 취소). 바로송금은 결제와 함께 송금 요청까지
create or replace function public.pay_bulk(p_items jsonb, p_company text, p_installment int default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it jsonb; t transfers; s settings; bps int; fee bigint; ids jsonb := '[]';
begin
  perform require_user();
  select * into s from settings;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception '결제할 송금이 없어요'; end if;
  if jsonb_array_length(p_items) > 100 then raise exception '한 번에 100건까지 결제할 수 있어요'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    bps := case when it->>'method' = 'SCHEDULED' then s.scheduled_bps else s.instant_bps end;
    fee := round((it->>'amount')::bigint * bps / 10000.0);
    t := pay_transfer((it->>'contract_id')::uuid, (it->>'amount')::bigint, (it->>'method')::transfer_method,
                      nullif(it->>'scheduled_date', '')::date, coalesce(it->>'memo', ''),
                      jsonb_build_array(jsonb_build_object('company', p_company, 'installment', greatest(1, coalesce(p_installment, 1)), 'amount', (it->>'amount')::bigint + fee)));
    if t.method = 'INSTANT' then
      update transfers set send_requested_at = now() where id = t.id;
      if not t.needs_review then t := _queue_payout(t.id, auth.uid(), '일괄 바로송금'); end if;
    end if;
    ids := ids || to_jsonb(t.id);
  end loop;
  return ids;
end $$;

-- ---------- 운영: 송금 처리(묶음 → 결재 → 대량이체 파일 → 완료) ----------
create or replace function public.admin_create_payout_batch(p_ids uuid[], p_memo text default '') returns public.payout_batches
language plpgsql security definer set search_path = public as $$
declare b payout_batches; n int; total bigint;
begin
  if not is_staff('REVIEWER') then raise exception '권한이 없어요'; end if;
  select count(*), coalesce(sum(amount), 0) into n, total from transfers
    where id = any(p_ids) and status = 'SENDING' and payout_batch_id is null;
  if n = 0 then raise exception '묶을 송금이 없어요(송금 중 상태만 묶을 수 있어요)'; end if;
  insert into payout_batches(item_count, total_amount, memo, created_by) values (n, total, left(coalesce(p_memo, ''), 100), auth.uid()) returning * into b;
  update transfers set payout_batch_id = b.id where id = any(p_ids) and status = 'SENDING' and payout_batch_id is null;
  perform audit('payout.create', b.id::text, jsonb_build_object('count', n, 'total', total));
  return b;
end $$;

create or replace function public.admin_approve_payout_batch(p_id uuid) returns public.payout_batches
language plpgsql security definer set search_path = public as $$
declare b payout_batches; two boolean;
begin
  if not is_staff('ADMIN') then raise exception '결재는 관리자만 할 수 있어요'; end if;
  select payout_two_person into two from settings;
  select * into b from payout_batches where id = p_id for update;
  if b.id is null or b.status <> 'DRAFT' then raise exception '결재할 수 없는 묶음이에요'; end if;
  if two and b.created_by = auth.uid() then raise exception '2인 결재가 켜져 있어요. 묶음을 만든 사람이 아닌 다른 관리자가 결재해야 해요'; end if;
  update payout_batches set status = 'APPROVED', approved_by = auth.uid(), approved_at = now() where id = p_id returning * into b;
  perform audit('payout.approve', p_id::text, null);
  return b;
end $$;

-- 은행 대량이체 파일 내용(전체 계좌번호 포함). 결재된 묶음만, 내려받으면 기록이 남아요
create or replace function public.admin_payout_file(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b public.payout_batches; out jsonb;
begin
  if not public.is_staff('ADMIN') then raise exception '권한이 없어요'; end if;
  select * into b from public.payout_batches where id = p_id;
  if b.id is null or b.status not in ('APPROVED','DONE') then raise exception '결재를 마친 묶음만 파일로 받을 수 있어요'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'transfer_id', t.id, 'bank', t.bank, 'account', extensions.pgp_sym_decrypt(c.account_enc, private.account_key()),
      'holder', t.holder, 'amount', t.amount, 'sender_name', t.sender_name, 'memo', t.memo, 'payee_name', t.payee_name)
      order by t.paid_at), '[]')
    into out
    from public.transfers t join public.contracts c on c.id = t.contract_id
    where t.payout_batch_id = p_id;
  update public.payout_batches set file_downloaded_at = now() where id = p_id;
  perform public.audit('payout.file', p_id::text, jsonb_build_object('count', jsonb_array_length(out)));
  return out;
end $$;

-- 은행에서 이체를 마친 뒤 완료 처리. 실패한 건은 사유와 함께 따로 표시
create or replace function public.admin_complete_payout_batch(p_id uuid, p_failed uuid[] default '{}', p_reason text default null) returns public.payout_batches
language plpgsql security definer set search_path = public as $$
declare b payout_batches; r record;
begin
  if not is_staff('ADMIN') then raise exception '권한이 없어요'; end if;
  select * into b from payout_batches where id = p_id for update;
  if b.id is null or b.status <> 'APPROVED' then raise exception '결재된 묶음만 완료 처리할 수 있어요'; end if;
  for r in select id from transfers where payout_batch_id = p_id and status = 'SENDING' loop
    if r.id = any(coalesce(p_failed, '{}')) then
      update transfers set status = 'FAILED', fail_reason = coalesce(p_reason, '이체 실패') where id = r.id;
      insert into transfer_events(transfer_id, status, actor, note) values (r.id, 'FAILED', auth.uid(), coalesce(p_reason, '이체 실패'));
    else
      perform _complete_transfer(r.id, auth.uid(), '은행 대량이체 지급 완료');
    end if;
  end loop;
  update payout_batches set status = 'DONE', done_by = auth.uid(), done_at = now() where id = p_id returning * into b;
  perform audit('payout.done', p_id::text, jsonb_build_object('failed', coalesce(array_length(p_failed, 1), 0)));
  return b;
end $$;

create or replace function public.admin_cancel_payout_batch(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_staff('ADMIN') then raise exception '권한이 없어요'; end if;
  if not exists (select 1 from payout_batches where id = p_id and status in ('DRAFT','APPROVED')) then raise exception '취소할 수 없는 묶음이에요'; end if;
  update transfers set payout_batch_id = null where payout_batch_id = p_id and status = 'SENDING';
  update payout_batches set status = 'CANCELED' where id = p_id;
  perform audit('payout.cancel', p_id::text, null);
end $$;

-- 권한: 로그인 전 실행 불가, 내부 함수는 직접 호출 불가
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname in ('_queue_payout','send_transfer','tick','admin_approve_transfer','match_bulk_rows','pay_bulk',
                        'admin_create_payout_batch','admin_approve_payout_batch','admin_payout_file','admin_complete_payout_batch','admin_cancel_payout_batch')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname = '_queue_payout' then
      execute format('revoke execute on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
