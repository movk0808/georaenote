-- 한도 초과 문구 다듬기("원예요" → "원이에요")
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
    raise exception '오늘 송금 한도(%)를 넘어요. 남은 한도는 %이에요', public.won(day_cap), public.won(greatest(day_cap - day_sum, 0));
  end if;
  if month_sum + new.amount > s.monthly_limit then
    raise exception '이번 달 송금 한도(%)를 넘어요. 남은 한도는 %이에요', public.won(s.monthly_limit), public.won(greatest(s.monthly_limit - month_sum, 0));
  end if;
  new.needs_review := new.amount >= s.review_amount;
  return new;
end $$;

