-- Reports: anyone signed in can report another person (offensive handle or avatar, spam, harassment). Nobody can read
-- reports through the app; the project owner reviews them in the Supabase dashboard (Table Editor -> reports).
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('name', 'avatar', 'spam', 'harassment', 'other')),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  check (from_id <> target_id)
);
create index reports_created on public.reports (created_at desc);

alter table public.reports enable row level security;
create policy reports_insert on public.reports for insert to authenticated with check (from_id = auth.uid());
create trigger reports_rate before insert on public.reports for each row execute function public.limit_rate(10, 60);

revoke all on public.reports from anon, authenticated;
grant insert on public.reports to authenticated;

-- Keep-alive: a scheduled GitHub Action calls this so a free project isn't paused for inactivity. Reads nothing.
create function public.ping() returns timestamptz language sql stable set search_path = public as $$ select now() $$;
revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
