begin;

select plan(46);

select has_table('public', 'flashcard_review_sessions', 'review sessions table exists');
select has_table('public', 'flashcard_review_session_cards', 'normalized session membership table exists');
select has_table('public', 'flashcard_review_logs', 'append-only review logs table exists');
select has_function('public', 'get_or_create_review_session', array['uuid', 'timestamp with time zone'], 'session RPC exists');
select has_function(
  'public',
  'apply_flashcard_review',
  array['uuid', 'uuid', 'uuid', 'uuid', 'smallint', 'bigint', 'timestamp with time zone', 'jsonb', 'jsonb'],
  'review RPC exists'
);

select has_index('public', 'flashcards', 'flashcards_user_due_id_idx', 'due selection index exists');
select is(
  (select indexdef from pg_indexes where indexname = 'flashcards_user_due_id_idx'),
  'CREATE INDEX flashcards_user_due_id_idx ON public.flashcards USING btree (user_id, due, id)',
  'due selection index has deterministic ordering'
);
select has_index(
  'public',
  'flashcard_review_sessions',
  'flashcard_review_sessions_one_active_owner_idx',
  'one-active-session index exists'
);
select ok(
  (select indexdef like '%WHERE (status = ''active''::text)'
   from pg_indexes where indexname = 'flashcard_review_sessions_one_active_owner_idx'),
  'one-active-session index is partial'
);

select col_default_is('public', 'flashcards', 'stability', '0', 'empty cards default stability to zero');
select col_default_is('public', 'flashcards', 'state', '0', 'empty cards default to New state');
select col_default_is('public', 'flashcards', 'schedule_version', '0', 'empty cards start at schedule version zero');
select col_default_is('public', 'flashcards', 'scheduler_version', '5.4.2', 'scheduler version is pinned');
select col_default_is(
  'public',
  'flashcards',
  'config_version',
  'fsrs-v6-defaults-v1',
  'scheduler config version is pinned'
);

select ok((select relrowsecurity from pg_class where oid = 'public.flashcard_review_sessions'::regclass), 'session RLS enabled');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.flashcard_review_session_cards'::regclass),
  'membership RLS enabled'
);
select ok((select relrowsecurity from pg_class where oid = 'public.flashcard_review_logs'::regclass), 'log RLS enabled');
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename like 'flashcard_review%' and cmd = 'SELECT'),
  3::bigint,
  'review tables expose owner-readable policies only'
);

select ok(not has_function_privilege('anon', 'public.get_or_create_review_session(uuid,timestamptz)', 'EXECUTE'), 'anon cannot acquire sessions');
select ok(
  not has_function_privilege('authenticated', 'public.get_or_create_review_session(uuid,timestamptz)', 'EXECUTE'),
  'authenticated cannot acquire sessions directly'
);
select ok(
  has_function_privilege('service_role', 'public.get_or_create_review_session(uuid,timestamptz)', 'EXECUTE'),
  'service role can acquire sessions'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.apply_flashcard_review(uuid,uuid,uuid,uuid,smallint,bigint,timestamptz,jsonb,jsonb)',
    'EXECUTE'
  ),
  'authenticated cannot apply reviews directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.apply_flashcard_review(uuid,uuid,uuid,uuid,smallint,bigint,timestamptz,jsonb,jsonb)',
    'EXECUTE'
  ),
  'service role can apply reviews'
);

insert into auth.users (id, aud, role, email) values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'review-owner@example.test'),
  ('20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'review-other@example.test');

insert into public.flashcards (id, user_id, front, back, created_at, due) values
  ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Due 1', 'Answer', '2026-09-01 09:00:00+00', '2026-09-01 09:00:00+00'),
  ('11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Due 2', 'Answer', '2026-09-01 10:00:00+00', '2026-09-01 10:00:00+00'),
  ('22000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Other', 'Answer', '2026-09-01 08:00:00+00', '2026-09-01 08:00:00+00');

create temporary table acquired_session as
select public.get_or_create_review_session(
  '10000000-0000-0000-0000-000000000001',
  '2026-09-02 10:00:00+00'
) as value;

select is((select value ->> 'status' from acquired_session), 'active', 'acquisition creates an active session');
select is(
  (select expires_at - created_at from public.flashcard_review_sessions where user_id = '10000000-0000-0000-0000-000000000001'),
  interval '24 hours',
  'sessions expire exactly 24 hours after creation'
);
select is(
  (select count(*) from public.flashcard_review_session_cards where user_id = '10000000-0000-0000-0000-000000000001'),
  2::bigint,
  'acquisition admits only the owner due cards'
);
select results_eq(
  $$select flashcard_id from public.flashcard_review_session_cards order by ordinal$$,
  $$values ('11000000-0000-0000-0000-000000000001'::uuid), ('11000000-0000-0000-0000-000000000002'::uuid)$$,
  'membership follows due then id ordering'
);
select is(
  public.get_or_create_review_session('10000000-0000-0000-0000-000000000001', '2026-09-02 11:00:00+00') ->> 'id',
  (select value ->> 'id' from acquired_session),
  'acquisition resumes the active session'
);
select throws_ok(
  $$insert into public.flashcard_review_sessions (user_id, cutoff) values ('10000000-0000-0000-0000-000000000001', now())$$,
  '23505',
  null,
  'partial unique index prevents a second active session'
);
select throws_ok(
  $$insert into public.flashcard_review_session_cards (session_id, user_id, flashcard_id, ordinal)
    select (value ->> 'id')::uuid, '10000000-0000-0000-0000-000000000001',
      '22000000-0000-0000-0000-000000000001', 9 from acquired_session$$,
  '23503',
  null,
  'composite ownership rejects another user card'
);

create temporary table first_review as
select public.apply_flashcard_review(
  '10000000-0000-0000-0000-000000000001',
  (select (value ->> 'id')::uuid from acquired_session),
  '33000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  3::smallint,
  0::bigint,
  '2026-09-02 10:05:00+00',
  '{"due":"2026-09-12T10:05:00Z","stability":2.3,"difficulty":5,"elapsed_days":0,"scheduled_days":10,"learning_steps":0,"reps":1,"lapses":0,"state":2}'::jsonb,
  '{"card_id":"11000000-0000-0000-0000-000000000001"}'::jsonb
) as value;

select is((select value ->> 'outcome' from first_review), 'applied', 'a due member review is applied');
select is((select schedule_version from public.flashcards where id = '11000000-0000-0000-0000-000000000001'), 1::bigint, 'review advances schedule version once');
select is((select count(*) from public.flashcard_review_logs), 1::bigint, 'review appends one immutable log');
select is((select state from public.flashcard_review_session_cards where flashcard_id = '11000000-0000-0000-0000-000000000001'), 'deferred', 'a due time beyond one minute is deferred');
select is((select reviewed_count from public.flashcard_review_sessions where user_id = '10000000-0000-0000-0000-000000000001'), 1, 'session summary advances atomically');

create temporary table replayed_review as
select public.apply_flashcard_review(
  '10000000-0000-0000-0000-000000000001',
  (select (value ->> 'id')::uuid from acquired_session),
  '33000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  3::smallint,
  0::bigint,
  '2026-09-02 10:06:00+00',
  '{"due":"2030-01-01T00:00:00Z"}'::jsonb,
  '{"different":"derived output is ignored on replay"}'::jsonb
) as value;

select is((select value ->> 'outcome' from replayed_review), 'replayed', 'identical stable intent replays');
select is((select value ->> 'reviewed_at' from replayed_review), '2026-09-02T10:05:00+00:00', 'replay returns the first canonical timestamp');
select is((select count(*) from public.flashcard_review_logs), 1::bigint, 'replay does not append another log');
select is((select schedule_version from public.flashcards where id = '11000000-0000-0000-0000-000000000001'), 1::bigint, 'replay does not reschedule the card');
select throws_ok(
  format(
    $$select public.apply_flashcard_review(
      '10000000-0000-0000-0000-000000000001', %L, '33000000-0000-0000-0000-000000000001',
      '11000000-0000-0000-0000-000000000001', 4::smallint, 0::bigint, now(), '{}'::jsonb, '{}'::jsonb)$$,
    (select value ->> 'id' from acquired_session)
  ),
  '23505',
  'review_request_conflict',
  'request UUID reuse with changed stable intent conflicts'
);
select throws_ok(
  format(
    $$select public.apply_flashcard_review(
      '10000000-0000-0000-0000-000000000001', %L, '33000000-0000-0000-0000-000000000002',
      '11000000-0000-0000-0000-000000000002', 3::smallint, 9::bigint, '2026-09-02 10:05:00+00', '{}'::jsonb, '{}'::jsonb)$$,
    (select value ->> 'id' from acquired_session)
  ),
  '40001',
  'stale_schedule_version',
  'stale schedule version rejects without mutation'
);
select is((select count(*) from public.flashcard_review_logs), 1::bigint, 'rejected reviews roll back without logs');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$update public.flashcards set front = 'Content remains editable' where id = '11000000-0000-0000-0000-000000000002'$$,
  'ordinary owner can update content'
);
select throws_ok(
  $$update public.flashcards set due = now() where id = '11000000-0000-0000-0000-000000000002'$$,
  '42501',
  null,
  'ordinary owner cannot update scheduler columns'
);
reset role;

delete from public.flashcards where id = '11000000-0000-0000-0000-000000000001';
select is_empty('select * from public.flashcard_review_logs', 'deleting a card cascades its logs');
select is_empty(
  $$select * from public.flashcard_review_session_cards where flashcard_id = '11000000-0000-0000-0000-000000000001'$$,
  'deleting a card cascades its membership'
);

select * from finish();
rollback;
