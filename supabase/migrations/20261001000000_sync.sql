-- Cloud backup of each person's own workout data (plans, logs, goals...). One row per account; only its owner can
-- read or write it. Deleting the account deletes the backup (cascade from auth.users).
create table public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  data jsonb not null check (pg_column_size(data) < 5242880),
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy user_data_select on public.user_data for select to authenticated using (user_id = auth.uid());
create policy user_data_insert on public.user_data for insert to authenticated with check (user_id = auth.uid());
create policy user_data_update on public.user_data for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy user_data_delete on public.user_data for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.user_data to authenticated;
