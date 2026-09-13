create or replace function public.apply_flashcard_review(
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
  perform pg_advisory_xact_lock(
    hashtextextended('apply_flashcard_review:' || p_user_id::text || ':' || p_request_id::text, 0)
  );

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

revoke execute on function public.apply_flashcard_review(uuid, uuid, uuid, uuid, smallint, bigint, timestamptz, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_flashcard_review(uuid, uuid, uuid, uuid, smallint, bigint, timestamptz, jsonb, jsonb)
  to service_role;
