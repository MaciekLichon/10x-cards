begin;

select plan(45);

select has_table('public', 'flashcards', 'flashcards table exists');
select columns_are(
  'public',
  'flashcards',
  array[
    'id', 'user_id', 'front', 'back', 'created_at', 'updated_at', 'due', 'stability', 'difficulty', 'elapsed_days',
    'scheduled_days', 'learning_steps', 'reps', 'lapses', 'state', 'last_review', 'schedule_version',
    'scheduler_version', 'config_version'
  ],
  'flashcards has the approved content and scheduling columns'
);
select col_type_is('public', 'flashcards', 'id', 'uuid', 'id is uuid');
select col_is_pk('public', 'flashcards', 'id', 'id is the primary key');
select col_type_is('public', 'flashcards', 'user_id', 'uuid', 'user_id is uuid');
select col_not_null('public', 'flashcards', 'user_id', 'user_id is required');
select col_type_is('public', 'flashcards', 'front', 'text', 'front is text');
select col_not_null('public', 'flashcards', 'front', 'front is required');
select col_type_is('public', 'flashcards', 'back', 'text', 'back is text');
select col_not_null('public', 'flashcards', 'back', 'back is required');
select col_type_is('public', 'flashcards', 'created_at', 'timestamp with time zone', 'created_at is timestamptz');
select col_not_null('public', 'flashcards', 'created_at', 'created_at is required');
select col_type_is('public', 'flashcards', 'updated_at', 'timestamp with time zone', 'updated_at is timestamptz');
select col_not_null('public', 'flashcards', 'updated_at', 'updated_at is required');
select col_has_check('public', 'flashcards', 'front', 'front has a content constraint');
select col_has_check('public', 'flashcards', 'back', 'back has a content constraint');
select col_default_is('public', 'flashcards', 'id', 'gen_random_uuid()', 'id is database-generated');
select col_default_is('public', 'flashcards', 'user_id', 'auth.uid()', 'owner defaults to auth.uid()');
select col_default_is('public', 'flashcards', 'created_at', 'now()', 'created_at defaults to now()');
select col_default_is('public', 'flashcards', 'updated_at', 'now()', 'updated_at defaults to now()');
select fk_ok(
  'public',
  'flashcards',
  'user_id',
  'auth',
  'users',
  'id',
  'user_id references auth.users'
);
select is(
  (
    select confdeltype
    from pg_constraint
    where conrelid = 'public.flashcards'::regclass and contype = 'f'
  ),
  'c'::"char",
  'deleting a user cascades to their flashcards'
);
select has_index('public', 'flashcards', 'flashcards_user_id_idx', 'owner index exists');
select is(
  (
    select indexdef
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'flashcards'
      and indexname = 'flashcards_user_created_id_idx'
  ),
  'CREATE INDEX flashcards_user_created_id_idx ON public.flashcards USING btree (user_id, created_at DESC, id DESC)',
  'collection index matches owner-scoped newest-first pagination'
);
select trigger_is(
  'public',
  'flashcards',
  'flashcards_set_updated_at',
  'public',
  'set_flashcards_updated_at',
  'updated_at trigger exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.flashcards'::regclass),
  'row-level security is enabled'
);

select results_eq(
  $$
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'flashcards'
    order by policyname
  $$,
  $$
    values
      ('Authenticated users can delete their own flashcards'::name),
      ('Authenticated users can insert their own flashcards'::name),
      ('Authenticated users can select their own flashcards'::name),
      ('Authenticated users can update their own flashcards'::name)
  $$,
  'all four ownership policies exist'
);

select results_eq(
  $$
    select cmd
    from pg_policies
    where schemaname = 'public' and tablename = 'flashcards'
    order by cmd
  $$,
  $$ values ('DELETE'), ('INSERT'), ('SELECT'), ('UPDATE') $$,
  'policies cover every CRUD command'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'flashcards'
      and roles = array['authenticated'::name]
      and case when cmd = 'INSERT' then qual is null and with_check is not null
               when cmd = 'UPDATE' then qual is not null and with_check is not null
               else qual is not null
          end
  ),
  4::bigint,
  'policies apply to authenticated users with ownership expressions'
);

insert into auth.users (id, aud, role, email)
values ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@example.test');

insert into public.flashcards (user_id, front, back, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000001',
  'Question',
  'Answer',
  '2026-01-01 00:00:00+00'::timestamptz,
  '2026-01-01 00:00:00+00'::timestamptz
);

select throws_ok(
  $$insert into public.flashcards (user_id, front, back) values ('00000000-0000-0000-0000-000000000001', '', 'Answer')$$,
  '23514',
  null,
  'empty front is rejected'
);
select throws_ok(
  $$insert into public.flashcards (user_id, front, back) values ('00000000-0000-0000-0000-000000000001', '   ', 'Answer')$$,
  '23514',
  null,
  'whitespace-only front is rejected'
);
select throws_ok(
  $$insert into public.flashcards (user_id, front, back) values ('00000000-0000-0000-0000-000000000001', repeat('x', 10001), 'Answer')$$,
  '23514',
  null,
  'overlong front is rejected'
);
select throws_ok(
  $$insert into public.flashcards (user_id, front, back) values ('00000000-0000-0000-0000-000000000001', 'Question', '')$$,
  '23514',
  null,
  'empty back is rejected'
);
select throws_ok(
  $$insert into public.flashcards (user_id, front, back) values ('00000000-0000-0000-0000-000000000001', 'Question', '   ')$$,
  '23514',
  null,
  'whitespace-only back is rejected'
);
select throws_ok(
  $$insert into public.flashcards (user_id, front, back) values ('00000000-0000-0000-0000-000000000001', 'Question', repeat('x', 10001))$$,
  '23514',
  null,
  'overlong back is rejected'
);

update public.flashcards set front = 'Updated question';

select ok(
  (select updated_at > created_at from public.flashcards limit 1),
  'updating a flashcard advances updated_at'
);
select is(
  (select created_at from public.flashcards limit 1),
  '2026-01-01 00:00:00+00'::timestamptz,
  'updating a flashcard preserves created_at'
);
select is(
  (select user_id from public.flashcards limit 1),
  '00000000-0000-0000-0000-000000000001'::uuid,
  'updating a flashcard preserves user_id'
);

create temporary table scheduling_token_before as
select updated_at, schedule_version from public.flashcards limit 1;

update public.flashcards
set due = due + interval '1 day', schedule_version = schedule_version + 1;

select is(
  (select updated_at from public.flashcards limit 1),
  (select updated_at from scheduling_token_before),
  'scheduler-only updates preserve the content concurrency token'
);
select is(
  (select schedule_version from public.flashcards limit 1),
  (select schedule_version + 1 from scheduling_token_before),
  'scheduler-only updates advance schedule_version'
);

create temporary table mutation_results (
  operation text primary key,
  affected_rows bigint not null
);

with stale_update as (
  update public.flashcards
  set front = 'Stale update'
  where user_id = '00000000-0000-0000-0000-000000000001'
    and updated_at = '2026-01-01 00:00:00+00'::timestamptz
  returning id
)
insert into mutation_results
select 'stale_update', count(*) from stale_update;

select is(
  (select affected_rows from mutation_results where operation = 'stale_update'),
  0::bigint,
  'stale conditional update affects no rows'
);

with stale_delete as (
  delete from public.flashcards
  where user_id = '00000000-0000-0000-0000-000000000001'
    and updated_at = '2026-01-01 00:00:00+00'::timestamptz
  returning id
)
insert into mutation_results
select 'stale_delete', count(*) from stale_delete;

select is(
  (select affected_rows from mutation_results where operation = 'stale_delete'),
  0::bigint,
  'stale conditional delete affects no rows'
);

select is(
  (select front from public.flashcards where user_id = '00000000-0000-0000-0000-000000000001'),
  'Updated question',
  'stale conditional mutations preserve the current card'
);

with owner_delete as (
  delete from public.flashcards
  where user_id = '00000000-0000-0000-0000-000000000001'
    and front = 'Updated question'
  returning id
)
insert into mutation_results
select 'owner_delete', count(*) from owner_delete;

select is(
  (select affected_rows from mutation_results where operation = 'owner_delete'),
  1::bigint,
  'owner conditional deletion removes the target'
);

delete from auth.users where id = '00000000-0000-0000-0000-000000000001';
select is_empty('select * from public.flashcards', 'deleting a user removes their flashcards');

select * from finish();
rollback;
