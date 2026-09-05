alter table public.flashcards
  add column due timestamptz,
  add column stability double precision not null default 0,
  add column difficulty double precision not null default 0,
  add column elapsed_days integer not null default 0,
  add column scheduled_days integer not null default 0,
  add column learning_steps integer not null default 0,
  add column reps integer not null default 0,
  add column lapses integer not null default 0,
  add column state smallint not null default 0,
  add column last_review timestamptz,
  add column schedule_version bigint not null default 0,
  add column scheduler_version text not null default '5.4.2',
  add column config_version text not null default 'fsrs-v6-defaults-v1';

update public.flashcards set due = created_at where due is null;
alter table public.flashcards
  alter column due set default now(),
  alter column due set not null,
  add constraint flashcards_stability_domain check (stability >= 0 and stability < 'Infinity'::double precision),
  add constraint flashcards_difficulty_domain check (difficulty >= 0 and difficulty <= 10),
  add constraint flashcards_elapsed_days_domain check (elapsed_days >= 0),
  add constraint flashcards_scheduled_days_domain check (scheduled_days >= 0),
  add constraint flashcards_learning_steps_domain check (learning_steps >= 0),
  add constraint flashcards_reps_domain check (reps >= 0),
  add constraint flashcards_lapses_domain check (lapses >= 0),
  add constraint flashcards_state_domain check (state between 0 and 3),
  add constraint flashcards_schedule_version_domain check (schedule_version >= 0),
  add constraint flashcards_scheduler_version_domain check (scheduler_version = '5.4.2'),
  add constraint flashcards_config_version_domain check (config_version = 'fsrs-v6-defaults-v1'),
  add constraint flashcards_id_user_id_key unique (id, user_id);

create index flashcards_user_due_id_idx on public.flashcards (user_id, due, id);

create or replace function public.set_flashcards_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.front is distinct from old.front or new.back is distinct from old.back then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

revoke update on table public.flashcards from authenticated;
grant update (front, back) on table public.flashcards to authenticated;

create table public.flashcard_review_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cutoff timestamptz not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  completed_at timestamptz,
  status text not null default 'active' constraint flashcard_review_sessions_status_domain
    check (status in ('active', 'completed', 'expired')),
  reviewed_count integer not null default 0 constraint flashcard_review_sessions_reviewed_count_domain
    check (reviewed_count >= 0),
  again_count integer not null default 0 constraint flashcard_review_sessions_again_count_domain check (again_count >= 0),
  hard_count integer not null default 0 constraint flashcard_review_sessions_hard_count_domain check (hard_count >= 0),
  good_count integer not null default 0 constraint flashcard_review_sessions_good_count_domain check (good_count >= 0),
  easy_count integer not null default 0 constraint flashcard_review_sessions_easy_count_domain check (easy_count >= 0),
  deferred_count integer not null default 0 constraint flashcard_review_sessions_deferred_count_domain
    check (deferred_count >= 0),
  constraint flashcard_review_sessions_expiry check (expires_at = created_at + interval '24 hours'),
  constraint flashcard_review_sessions_id_user_id_key unique (id, user_id)
);

create unique index flashcard_review_sessions_one_active_owner_idx
  on public.flashcard_review_sessions (user_id) where status = 'active';
create index flashcard_review_sessions_user_created_idx
  on public.flashcard_review_sessions (user_id, created_at desc);

create table public.flashcard_review_session_cards (
  session_id uuid not null,
  user_id uuid not null,
  flashcard_id uuid not null,
  ordinal integer not null constraint flashcard_review_session_cards_ordinal_domain check (ordinal >= 0),
  state text not null default 'pending' constraint flashcard_review_session_cards_state_domain
    check (state in ('pending', 'ready', 'waiting', 'deferred', 'completed')),
  next_due timestamptz,
  review_count integer not null default 0 constraint flashcard_review_session_cards_review_count_domain
    check (review_count >= 0),
  completed_at timestamptz,
  primary key (session_id, flashcard_id),
  constraint flashcard_review_session_cards_ordinal_key unique (session_id, ordinal),
  constraint flashcard_review_session_cards_session_owner_fk foreign key (session_id, user_id)
    references public.flashcard_review_sessions (id, user_id) on delete cascade,
  constraint flashcard_review_session_cards_card_owner_fk foreign key (flashcard_id, user_id)
    references public.flashcards (id, user_id) on delete cascade
);

create index flashcard_review_session_cards_resume_idx
  on public.flashcard_review_session_cards (session_id, state, next_due, ordinal);

create table public.flashcard_review_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  user_id uuid not null,
  flashcard_id uuid not null,
  session_id uuid not null,
  rating smallint not null constraint flashcard_review_logs_rating_domain check (rating between 1 and 4),
  expected_schedule_version bigint not null constraint flashcard_review_logs_expected_version_domain
    check (expected_schedule_version >= 0),
  reviewed_at timestamptz not null,
  pre_state jsonb not null,
  post_state jsonb not null,
  result jsonb not null,
  scheduler_version text not null constraint flashcard_review_logs_scheduler_version_domain check (scheduler_version = '5.4.2'),
  config_version text not null constraint flashcard_review_logs_config_version_domain
    check (config_version = 'fsrs-v6-defaults-v1'),
  created_at timestamptz not null default now(),
  constraint flashcard_review_logs_request_key unique (user_id, request_id),
  constraint flashcard_review_logs_card_owner_fk foreign key (flashcard_id, user_id)
    references public.flashcards (id, user_id) on delete cascade,
  constraint flashcard_review_logs_session_owner_fk foreign key (session_id, user_id)
    references public.flashcard_review_sessions (id, user_id) on delete cascade
);

create index flashcard_review_logs_user_card_created_idx
  on public.flashcard_review_logs (user_id, flashcard_id, created_at desc);

alter table public.flashcard_review_sessions enable row level security;
alter table public.flashcard_review_session_cards enable row level security;
alter table public.flashcard_review_logs enable row level security;

create policy "Authenticated users can select their own review sessions"
on public.flashcard_review_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Authenticated users can select their own review session cards"
on public.flashcard_review_session_cards for select to authenticated using ((select auth.uid()) = user_id);
create policy "Authenticated users can select their own review logs"
on public.flashcard_review_logs for select to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.flashcard_review_sessions from anon, authenticated;
revoke all on table public.flashcard_review_session_cards from anon, authenticated;
revoke all on table public.flashcard_review_logs from anon, authenticated;
grant select on table public.flashcard_review_sessions to authenticated;
grant select on table public.flashcard_review_session_cards to authenticated;
grant select on table public.flashcard_review_logs to authenticated;

create function public.get_or_create_review_session(p_user_id uuid, p_cutoff timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.flashcard_review_sessions;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  update public.flashcard_review_sessions
  set status = 'expired'
  where user_id = p_user_id and status = 'active' and expires_at <= p_cutoff;

  update public.flashcard_review_sessions as session
  set status = 'completed', completed_at = p_cutoff
  where session.user_id = p_user_id
    and session.status = 'active'
    and not exists (
      select 1
      from public.flashcard_review_session_cards as member
      where member.session_id = session.id
        and member.state not in ('completed', 'deferred')
    );

  select * into v_session
  from public.flashcard_review_sessions
  where user_id = p_user_id and status = 'active'
  for update;

  if not found then
    insert into public.flashcard_review_sessions (user_id, cutoff, created_at, expires_at)
    values (p_user_id, p_cutoff, p_cutoff, p_cutoff + interval '24 hours')
    returning * into v_session;

    insert into public.flashcard_review_session_cards (session_id, user_id, flashcard_id, ordinal, state, next_due)
    select v_session.id, p_user_id, due_card.id, due_card.ordinal, 'ready', due_card.due
    from (
      select id, due, row_number() over (order by due, id)::integer - 1 as ordinal
      from public.flashcards
      where user_id = p_user_id and due <= p_cutoff
      order by due, id
      limit 20
    ) as due_card;

    if not exists (
      select 1 from public.flashcard_review_session_cards where session_id = v_session.id
    ) then
      update public.flashcard_review_sessions
      set status = 'completed', completed_at = p_cutoff
      where id = v_session.id and user_id = p_user_id
      returning * into v_session;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_session.id,
    'cutoff', v_session.cutoff,
    'expires_at', v_session.expires_at,
    'status', v_session.status
  );
end;
$$;

create function public.apply_flashcard_review(
  p_user_id uuid,
  p_session_id uuid,
  p_request_id uuid,
  p_flashcard_id uuid,
  p_rating smallint,
  p_expected_schedule_version bigint,
  p_reviewed_at timestamptz,
  p_post_state jsonb,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.flashcard_review_logs;
  v_session public.flashcard_review_sessions;
  v_card public.flashcards;
  v_member public.flashcard_review_session_cards;
  v_new_version bigint;
  v_member_state text;
  v_next_due timestamptz;
  v_remaining integer;
begin
  select * into v_existing
  from public.flashcard_review_logs
  where user_id = p_user_id and request_id = p_request_id;

  if found then
    if v_existing.session_id = p_session_id
      and v_existing.flashcard_id = p_flashcard_id
      and v_existing.rating = p_rating
      and v_existing.expected_schedule_version = p_expected_schedule_version then
      return v_existing.result || jsonb_build_object('outcome', 'replayed');
    end if;
    raise exception using errcode = '23505', message = 'review_request_conflict';
  end if;

  if p_rating not between 1 and 4 then
    raise exception using errcode = '22023', message = 'invalid_rating';
  end if;

  select * into v_session
  from public.flashcard_review_sessions
  where id = p_session_id and user_id = p_user_id
  for update;
  if not found or v_session.status <> 'active' or v_session.expires_at <= p_reviewed_at then
    raise exception using errcode = 'P0001', message = 'review_session_unavailable';
  end if;

  select * into v_member
  from public.flashcard_review_session_cards
  where session_id = p_session_id and user_id = p_user_id and flashcard_id = p_flashcard_id
  for update;
  if not found or v_member.state in ('completed', 'deferred') then
    raise exception using errcode = 'P0001', message = 'review_card_not_in_session';
  end if;

  select * into v_card
  from public.flashcards
  where id = p_flashcard_id and user_id = p_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'review_card_unavailable';
  end if;
  if v_card.schedule_version <> p_expected_schedule_version then
    raise exception using errcode = '40001', message = 'stale_schedule_version';
  end if;
  if v_card.due > p_reviewed_at then
    raise exception using errcode = '22023', message = 'review_card_not_due';
  end if;

  v_next_due := (p_post_state ->> 'due')::timestamptz;
  if v_next_due is null
    or (p_post_state ->> 'stability')::double precision < 0
    or (p_post_state ->> 'difficulty')::double precision not between 0 and 10
    or (p_post_state ->> 'elapsed_days')::integer < 0
    or (p_post_state ->> 'scheduled_days')::integer < 0
    or (p_post_state ->> 'learning_steps')::integer < 0
    or (p_post_state ->> 'reps')::integer < 0
    or (p_post_state ->> 'lapses')::integer < 0
    or (p_post_state ->> 'state')::smallint not between 0 and 3 then
    raise exception using errcode = '22023', message = 'invalid_post_state';
  end if;

  v_new_version := v_card.schedule_version + 1;
  update public.flashcards set
    due = v_next_due,
    stability = (p_post_state ->> 'stability')::double precision,
    difficulty = (p_post_state ->> 'difficulty')::double precision,
    elapsed_days = (p_post_state ->> 'elapsed_days')::integer,
    scheduled_days = (p_post_state ->> 'scheduled_days')::integer,
    learning_steps = (p_post_state ->> 'learning_steps')::integer,
    reps = (p_post_state ->> 'reps')::integer,
    lapses = (p_post_state ->> 'lapses')::integer,
    state = (p_post_state ->> 'state')::smallint,
    last_review = p_reviewed_at,
    schedule_version = v_new_version,
    scheduler_version = '5.4.2',
    config_version = 'fsrs-v6-defaults-v1'
  where id = p_flashcard_id and user_id = p_user_id;

  if v_next_due <= p_reviewed_at + interval '60 seconds' then
    v_member_state := case when v_next_due <= p_reviewed_at then 'ready' else 'waiting' end;
  else
    v_member_state := 'deferred';
  end if;

  update public.flashcard_review_session_cards set
    state = v_member_state,
    next_due = v_next_due,
    review_count = review_count + 1,
    completed_at = case when v_member_state = 'deferred' then p_reviewed_at else null end
  where session_id = p_session_id and flashcard_id = p_flashcard_id;

  update public.flashcard_review_sessions set
    reviewed_count = reviewed_count + 1,
    again_count = again_count + case when p_rating = 1 then 1 else 0 end,
    hard_count = hard_count + case when p_rating = 2 then 1 else 0 end,
    good_count = good_count + case when p_rating = 3 then 1 else 0 end,
    easy_count = easy_count + case when p_rating = 4 then 1 else 0 end,
    deferred_count = deferred_count + case when v_member_state = 'deferred' then 1 else 0 end
  where id = p_session_id and user_id = p_user_id;

  select count(*) into v_remaining
  from public.flashcard_review_session_cards
  where session_id = p_session_id and state not in ('completed', 'deferred');

  if v_remaining = 0 then
    update public.flashcard_review_sessions
    set status = 'completed', completed_at = p_reviewed_at
    where id = p_session_id and user_id = p_user_id;
  end if;

  begin
    insert into public.flashcard_review_logs (
      request_id, user_id, flashcard_id, session_id, rating, expected_schedule_version, reviewed_at,
      pre_state, post_state, result, scheduler_version, config_version
    ) values (
      p_request_id, p_user_id, p_flashcard_id, p_session_id, p_rating, p_expected_schedule_version, p_reviewed_at,
      jsonb_build_object(
        'due', v_card.due, 'stability', v_card.stability, 'difficulty', v_card.difficulty,
        'elapsed_days', v_card.elapsed_days, 'scheduled_days', v_card.scheduled_days,
        'learning_steps', v_card.learning_steps, 'reps', v_card.reps, 'lapses', v_card.lapses,
        'state', v_card.state, 'last_review', v_card.last_review, 'schedule_version', v_card.schedule_version
      ),
      p_post_state,
      p_result || jsonb_build_object('reviewed_at', p_reviewed_at, 'schedule_version', v_new_version),
      '5.4.2',
      'fsrs-v6-defaults-v1'
    );
  exception when unique_violation then
    raise exception using errcode = '40001', message = 'concurrent_review_request';
  end;

  return p_result || jsonb_build_object(
    'outcome', 'applied',
    'reviewed_at', p_reviewed_at,
    'schedule_version', v_new_version,
    'member_state', v_member_state
  );
end;
$$;

revoke execute on function public.get_or_create_review_session(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.apply_flashcard_review(uuid, uuid, uuid, uuid, smallint, bigint, timestamptz, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.get_or_create_review_session(uuid, timestamptz) to service_role;
grant execute on function public.apply_flashcard_review(uuid, uuid, uuid, uuid, smallint, bigint, timestamptz, jsonb, jsonb)
  to service_role;
