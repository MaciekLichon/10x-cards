create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  front text not null constraint flashcards_front_length check (char_length(btrim(front)) between 1 and 10000),
  back text not null constraint flashcards_back_length check (char_length(btrim(back)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index flashcards_user_id_idx on public.flashcards (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger flashcards_set_updated_at
before update on public.flashcards
for each row
execute function public.set_updated_at();

alter table public.flashcards enable row level security;

create policy "Authenticated users can select their own flashcards"
on public.flashcards
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can insert their own flashcards"
on public.flashcards
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Authenticated users can update their own flashcards"
on public.flashcards
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Authenticated users can delete their own flashcards"
on public.flashcards
for delete
to authenticated
using ((select auth.uid()) = user_id);
