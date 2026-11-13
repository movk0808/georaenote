-- 오류 문구의 금액을 1,000 단위 쉼표로 보여주기
create or replace function public.won(v bigint) returns text language sql immutable as $$
  select to_char(v, 'FM999,999,999,999') || '원'
$$;

create or replace function public.pay_transfer(
  p_contract_id uuid, p_amount bigint, p_method public.transfer_method, p_scheduled_date date,
  p_memo text, p_cards jsonb
) returns public.transfers language plpgsql security definer set search_path = public as $$
declare
  uid uuid := require_user(); s settings; c contracts; v_bps int; v_fee bigint; v_total bigint; t transfers; card jsonb;
begin
  select * into s from settings;
  select * into c from contracts where id = p_contract_id and user_id = uid;
  if c.id is null then raise exception '계약을 찾을 수 없어요'; end if;
  if c.status <> 'APPROVED' then raise exception '승인된 계약으로만 송금할 수 있어요'; end if;
  if exists (select 1 from profiles where id = uid and suspended) then raise exception '이용이 정지된 계정이에요'; end if;
  if p_amount < s.min_amount or p_amount > s.max_amount then raise exception '송금액은 %부터 %까지예요', won(s.min_amount), won(s.max_amount); end if;
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
    raise exception '카드별 금액 합계가 결제 금액(%)과 달라요', won(v_total);
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
