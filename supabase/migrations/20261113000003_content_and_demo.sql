-- 퀴즈·공지 기본 데이터, 관리자 대시보드 확인용 데모 데이터 생성/삭제 함수

insert into public.quizzes(id, question, options, answer, explain) values
 (1, '부가가치세 일반과세자의 확정신고는 1년에 몇 번 하나요?', array['1번','2번','4번'], 1, '일반과세자는 1월과 7월, 1년에 두 번 확정신고를 해요.'),
 (2, '거래노트 바로송금의 이용료율은?', array['3.5%','4%','4.9%'], 1, '바로송금은 4%, 예약송금은 3.5%예요.'),
 (3, '세금계산서를 발행해야 하는 시기는 원칙적으로 언제인가요?', array['공급 시기','대금 수령 후 1년 내','연말'], 0, '세금계산서는 재화나 용역의 공급 시기에 발행하는 것이 원칙이에요.'),
 (4, '마일리지는 이용료의 몇 %가 적립되나요?', array['1%','2%','5%'], 1, '송금이 완료되면 이용료의 2%가 적립돼요.'),
 (5, '신용카드 결제일을 늦추면 생기는 효과로 맞는 것은?', array['현금 흐름 여유','이자 수익','세금 감면'], 0, '카드 결제일까지 현금을 쥐고 있을 수 있어 자금 흐름에 여유가 생겨요.')
on conflict (id) do nothing;

insert into public.notices(title, body, published_at) values
 ('거래노트 서비스 오픈 안내', '사업대금을 카드로 결제하고 거래처에는 계좌로 보내는 거래노트가 문을 열었습니다.', '2026-02-02'),
 ('26년 11월 카드사별 무이자 할부 혜택 안내', '11월 카드사별 무이자·부분무이자 할부 혜택을 안내드립니다. 앱의 카드 할부 정보에서 확인해 주세요.', '2026-11-01');

alter table public.profiles add column is_demo boolean not null default false;

-- 데모 데이터 만들기: 가상 사장님 36명과 최근 90일 결제·송금, 검토 대기 계약, 문의, 후기
create or replace function public.admin_seed_demo() returns jsonb
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  shops text[] := array['바다횟집','한빛분식','달빛카페','온기국밥','소담한식','골목떡볶이','오늘베이커리','청년치킨','도담정육','푸른과일',
    '미소네일','하루꽃집','동네세탁','바른약국','열린철물','새벽빵집','모락만두','들꽃식당','해오름수산','고운미용실',
    '한결문구','다온커피','정성반찬','참숯갈비','노을포차','소반한정식','빛나안경','토닥애견','숲속카페','맑은물정수',
    '단골슈퍼','이음공방','봄날피자','가온족발','새싹어린이집','든든김밥'];
  names text[] := array['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황'];
  given text[] := array['민준','서연','지훈','하은','도윤','수아','예준','지민','현우','유진','성민','은지','태호','다은','준서','소연'];
  payees text[] := array['한빛식자재','대성유통','우리축산','남해수산','청정농산','동방음료','미래포장','태평상가관리','성원인테리어','서울청과','하나주류도매','명가제과재료'];
  types contract_type[] := array['FOOD','GOODS','BEVERAGE','RENT','FOOD','GOODS','MAINTENANCE','INTERIOR','FOOD','RENT'];
  banks text[] := array['KB국민은행','신한은행','우리은행','하나은행','NH농협은행','IBK기업은행','카카오뱅크'];
  cards text[] := array['신한카드','삼성카드','현대카드','KB국민카드','롯데카드','하나카드','우리카드','BC카드'];
  uid uuid; cid uuid; tid uuid; i int; j int; k int; n int; amt bigint; fee bigint; bps int; m transfer_method; st transfer_status;
  d timestamptz; sd date; total_t int := 0; ct contract_type; today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if not is_staff('ADMIN') then raise exception '권한이 없어요'; end if;
  perform setseed(0.42);
  for i in 1..array_length(shops, 1) loop
    uid := gen_random_uuid();
    insert into auth.users(instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_anonymous)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      'demo' || i || '@demo.georaenote.invalid', '', now(), now() - make_interval(days => 120 - i), now(),
      '{"provider":"demo","providers":["demo"]}', '{}', false);
    insert into profiles(id, name, phone, carrier, business_name, verified_at, is_demo, created_at)
    values (uid, names[1 + (i % 16)] || given[1 + ((i * 7) % 16)], '010' || lpad((20000000 + i * 137731)::text, 8, '0'),
      (array['SKT','KT','LG U+'])[1 + i % 3], shops[i], now(), true, now() - make_interval(days => 120 - i));

    for j in 1..(1 + i % 3) loop
      ct := types[1 + ((i + j) % array_length(types, 1))];
      insert into contracts(user_id, type, title, payee_name, bank, account, holder, sender_name, address, status, reviewed_at, created_at)
      values (uid, ct, payees[1 + ((i * 3 + j) % 12)] || ' ' || case ct when 'FOOD' then '식자재' when 'GOODS' then '물품대금' when 'BEVERAGE' then '음료'
                when 'RENT' then '월세·임대료' when 'MAINTENANCE' then '관리비' when 'INTERIOR' then '수리·인테리어' else '기타' end,
        payees[1 + ((i * 3 + j) % 12)], banks[1 + ((i + j) % 7)], '1' || lpad((floor(random() * 1e11))::bigint::text, 11, '0'),
        '대표 ' || names[1 + ((i + j) % 16)] || given[1 + ((i + 3 * j) % 16)], shops[i],
        case ct when 'RENT' then '서울시 마포구 ' || (i * 7) || '번길' else '' end,
        case when i % 12 = 0 and j = 1 then 'REVIEW' when i % 17 = 0 and j = 2 then 'REJECTED' else 'APPROVED' end::contract_status,
        now() - make_interval(days => 100 - i), now() - make_interval(days => 101 - i))
      returning id into cid;
      insert into contract_documents(contract_id, file_name) values (cid, '거래명세서_' || shops[i] || '.pdf');

      if (select status from contracts where id = cid) <> 'APPROVED' then continue; end if;
      n := 3 + floor(random() * 12)::int;
      for k in 1..n loop
        d := now() - make_interval(days => floor(random() * 90)::int, hours => floor(random() * 10)::int);
        amt := case ct when 'RENT' then (15 + floor(random() * 35)::int) * 100000
                       when 'INTERIOR' then (20 + floor(random() * 120)::int) * 100000
                       when 'MAINTENANCE' then (2 + floor(random() * 8)::int) * 50000
                       else (3 + floor(random() * 60)::int) * 50000 end;
        m := case when random() < 0.42 then 'INSTANT' else 'SCHEDULED' end;
        bps := case m when 'INSTANT' then 400 else 350 end;
        fee := round(amt * bps / 10000.0);
        sd := case when m = 'SCHEDULED' then (d at time zone 'Asia/Seoul')::date + 1 + floor(random() * 10)::int end;
        st := case when random() < 0.025 then 'CANCELED'
                   when m = 'SCHEDULED' and sd > today then 'SCHEDULED'
                   when m = 'INSTANT' and d > now() - interval '1 day' and random() < 0.5 then 'WAITING_SEND'
                   when random() < 0.01 then 'FAILED'
                   else 'COMPLETED' end;
        insert into transfers(user_id, contract_id, payee_name, bank, masked_account, holder, sender_name, memo, amount, fee, fee_bps,
          method, scheduled_date, mileage, status, paid_at, completed_at, canceled_at, created_at, fail_reason)
        select uid, c.id, c.payee_name, c.bank, mask_account(c.account), c.holder, c.sender_name,
          to_char(d at time zone 'Asia/Seoul', 'FMMM') || '월 ' || case ct when 'RENT' then '월세' else '매입대금' end,
          amt, fee, bps, m, sd, floor(fee * 0.02), st, d,
          case when st = 'COMPLETED' then coalesce(sd::timestamptz + interval '10 hours', d + interval '3 minutes') end,
          case when st = 'CANCELED' then d + interval '20 minutes' end, d,
          case when st = 'FAILED' then '수취 계좌 오류(모의)' end
        from contracts c where c.id = cid returning id into tid;
        insert into card_charges(transfer_id, company, installment, amount, approval_no)
        values (tid, cards[1 + floor(random() * 8)::int], (array[1,1,1,2,3,3,6,12])[1 + floor(random() * 8)::int], amt + fee, 'DEMO');
        if st = 'COMPLETED' then
          insert into mileage_ledger(user_id, amount, reason, transfer_id, created_at) values (uid, floor(fee * 0.02), '송금 적립', tid, d);
        end if;
        total_t := total_t + 1;
      end loop;
    end loop;

    if i % 5 = 0 then
      insert into inquiries(user_id, message, created_at) values (uid,
        (array['예약송금 날짜를 바꿀 수 있나요?','세금계산서는 거래처에서 받으면 되나요?','계약 승인이 아직 안 났어요.','분할결제 카드를 3장 넘게 쓸 수 있나요?'])[1 + (i / 5) % 4],
        now() - make_interval(hours => i));
    end if;
    if i % 3 = 0 then
      insert into reviews(user_id, rating, body, status, created_at) values (uid, (array[5,5,4,5,3,5,4])[1 + i % 7],
        (array['식자재 대금 날짜가 정산일보다 빨라서 자주 써요. 예약송금이 편해요.','월세를 카드로 내니 실적 채우기 좋아요.','심사가 생각보다 빨랐어요.',
               '수수료가 조금 아쉽지만 급할 때 유용해요.','분할결제로 큰 금액도 나눠 낼 수 있어서 좋아요.'])[1 + i % 5],
        case when i % 9 = 0 then 'PENDING' else 'PUBLISHED' end::review_status, now() - make_interval(days => i));
    end if;
  end loop;
  perform audit('demo.seed', null, jsonb_build_object('transfers', total_t));
  return jsonb_build_object('users', array_length(shops, 1), 'transfers', total_t);
end $$;

create or replace function public.admin_clear_demo() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  if not is_staff('ADMIN') then raise exception '권한이 없어요'; end if;
  with del as (delete from auth.users where id in (select id from profiles where is_demo) returning 1) select count(*) into n from del;
  perform audit('demo.clear', null, jsonb_build_object('users', n));
  return jsonb_build_object('users', n);
end $$;
