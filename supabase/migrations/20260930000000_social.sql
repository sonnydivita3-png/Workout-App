-- EZ Workout Tracker: social features.
--
-- Privacy model
--   * A person is found only by their exact handle. There is no browsing or searching of users.
--   * Being friends shares nothing by itself. Every friend has five permissions that the person being
--     asked (the recipient) grants individually, all off until they agree:
--       progress   - may see my progress summary
--       workouts   - may send me shared workouts
--       requests   - may ask me to make them a workout
--       challenges - may challenge me
--       emoji      - may send me emoji reactions
--   * Row-level security enforces every rule below, so a modified client cannot bypass them.
--   * Emails are never stored here (they live in Supabase Auth) and are never exposed to other users.

-- ------------------------------------------------------------------ profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  -- An emoji, 'letter:A', or a small photo as a data URL (the app shrinks it to about 96px first).
  avatar text not null default '💪' check (
    char_length(avatar) between 1 and 8
    or (char_length(avatar) <= 12000 and avatar ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$')
  ),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ friends
create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_id <> to_id)
);
-- One open request per pair, whichever direction it was sent.
create unique index friend_requests_open_pair on public.friend_requests (least(from_id, to_id), greatest(from_id, to_id)) where status = 'pending';

create table public.friends (
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- What `owner_id` lets `friend_id` do. All false until the owner agrees.
create table public.friend_permissions (
  owner_id uuid not null,
  friend_id uuid not null,
  progress boolean not null default false,
  workouts boolean not null default false,
  requests boolean not null default false,
  challenges boolean not null default false,
  emoji boolean not null default false,
  reviewed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  foreign key (owner_id, friend_id) references public.friends (user_id, friend_id) on delete cascade
);

-- ------------------------------------------------------------------ things friends send
create table public.shared_workouts (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  scope text not null check (scope in ('day', 'week', 'month')),
  title text not null check (char_length(title) between 1 and 80),
  emoji text check (emoji is null or char_length(emoji) <= 8),
  payload jsonb not null check (pg_column_size(payload) < 262144),
  status text not null default 'pending' check (status in ('pending', 'added', 'dismissed')),
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);

create table public.workout_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade, -- who is asking
  to_id uuid not null references public.profiles (id) on delete cascade,   -- who is asked to make one
  scope text not null check (scope in ('day', 'week', 'month')),
  note text not null default '' check (char_length(note) <= 140),
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'declined')),
  share_id uuid references public.shared_workouts (id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('total', 'best', 'workout')),
  title text not null check (char_length(title) between 1 and 80),
  emoji text check (emoji is null or char_length(emoji) <= 8),
  spec jsonb not null check (pg_column_size(spec) < 65536),
  target numeric not null check (target > 0),
  days int not null check (days between 1 and 90),
  status text not null default 'pending' check (status in ('pending', 'active', 'completed', 'declined', 'cancelled')),
  progress numeric not null default 0 check (progress >= 0),
  done boolean not null default false,
  accepted_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_id <> to_id)
);

create table public.emoji_messages (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('💪', '🔥', '👏', '🎉', '😅', '🏃', '🚴', '❤️', '👀', '🙌', '💯', '😴')),
  context_type text check (context_type in ('share', 'challenge', 'request', 'progress')),
  context_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (from_id <> to_id)
);

-- A summary each user publishes of their own progress. Never includes body weight or goals.
create table public.progress_snapshots (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  data jsonb not null check (pg_column_size(data) < 65536),
  updated_at timestamptz not null default now()
);

create index on public.friend_requests (to_id);
create index on public.friend_requests (from_id);
create index on public.shared_workouts (to_id);
create index on public.shared_workouts (from_id);
create index on public.workout_requests (to_id);
create index on public.workout_requests (from_id);
create index on public.challenges (to_id);
create index on public.challenges (from_id);
create index on public.emoji_messages (to_id, created_at desc);

-- ------------------------------------------------------------------ helpers (about the caller only)
-- These take the *other* person and always compare against auth.uid(), so calling them tells you nothing
-- about anyone else's relationships.
create function public.friend_of(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friends f where f.user_id = auth.uid() and f.friend_id = other)
$$;

-- Did `owner` grant the caller this permission?
create function public.granted_by(owner uuid, perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case perm
      when 'progress' then p.progress when 'workouts' then p.workouts when 'requests' then p.requests
      when 'challenges' then p.challenges when 'emoji' then p.emoji else false end
    from public.friend_permissions p where p.owner_id = owner and p.friend_id = auth.uid()
  ), false)
$$;

create function public.blocked_with(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = other) or (b.blocker_id = other and b.blocked_id = auth.uid())
  )
$$;

create function public.open_request_with(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friend_requests r
    where r.status = 'pending' and ((r.from_id = auth.uid() and r.to_id = other) or (r.from_id = other and r.to_id = auth.uid()))
  )
$$;

-- ------------------------------------------------------------------ rate limits
create function public.limit_rate() returns trigger language plpgsql security definer set search_path = public as $$
declare
  max_count int := tg_argv[0]::int;
  window_minutes int := tg_argv[1]::int;
  recent int;
begin
  execute format('select count(*) from public.%I where from_id = $1 and created_at > now() - make_interval(mins => $2)', tg_table_name)
    into recent using new.from_id, window_minutes;
  if recent >= max_count then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger friend_requests_rate before insert on public.friend_requests for each row execute function public.limit_rate(20, 60);
create trigger shared_workouts_rate before insert on public.shared_workouts for each row execute function public.limit_rate(30, 60);
create trigger workout_requests_rate before insert on public.workout_requests for each row execute function public.limit_rate(20, 60);
create trigger challenges_rate before insert on public.challenges for each row execute function public.limit_rate(30, 60);
create trigger emoji_rate before insert on public.emoji_messages for each row execute function public.limit_rate(20, 1);

-- Handles can't change once chosen (friends know people by them).
create function public.lock_handle() returns trigger language plpgsql set search_path = public as $$
begin
  if new.handle <> old.handle then raise exception 'handle_locked' using errcode = 'P0001'; end if;
  return new;
end $$;
create trigger profiles_lock_handle before update on public.profiles for each row execute function public.lock_handle();

-- ------------------------------------------------------------------ row-level security
alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friends enable row level security;
alter table public.blocks enable row level security;
alter table public.friend_permissions enable row level security;
alter table public.shared_workouts enable row level security;
alter table public.workout_requests enable row level security;
alter table public.challenges enable row level security;
alter table public.emoji_messages enable row level security;
alter table public.progress_snapshots enable row level security;

-- profiles: yourself, your friends, and people with an open request with you.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.friend_of(id) or public.open_request_with(id));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- friend requests: you can see and send your own, and withdraw one you sent. Answering goes through respond_friend_request.
create policy friend_requests_select on public.friend_requests for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
create policy friend_requests_insert on public.friend_requests for insert to authenticated
  with check (
    from_id = auth.uid() and status = 'pending' and responded_at is null
    and not public.friend_of(to_id) and not public.blocked_with(to_id)
  );
create policy friend_requests_delete on public.friend_requests for delete to authenticated
  using (from_id = auth.uid() and status = 'pending');

create policy friends_select on public.friends for select to authenticated using (user_id = auth.uid());
create policy blocks_select on public.blocks for select to authenticated using (blocker_id = auth.uid());

-- permissions: both people can read them (so you can see what a friend allows you); only the owner changes them.
create policy friend_permissions_select on public.friend_permissions for select to authenticated
  using (owner_id = auth.uid() or friend_id = auth.uid());
create policy friend_permissions_update on public.friend_permissions for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- shared workouts: only to a friend who allowed it.
create policy shared_workouts_select on public.shared_workouts for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
create policy shared_workouts_insert on public.shared_workouts for insert to authenticated
  with check (
    from_id = auth.uid() and status = 'pending'
    and public.friend_of(to_id) and public.granted_by(to_id, 'workouts')
  );
create policy shared_workouts_delete on public.shared_workouts for delete to authenticated
  using (from_id = auth.uid() and status = 'pending');

create policy workout_requests_select on public.workout_requests for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
create policy workout_requests_insert on public.workout_requests for insert to authenticated
  with check (
    from_id = auth.uid() and status = 'pending' and share_id is null
    and public.friend_of(to_id) and public.granted_by(to_id, 'requests')
  );

create policy challenges_select on public.challenges for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
create policy challenges_insert on public.challenges for insert to authenticated
  with check (
    from_id = auth.uid() and status = 'pending' and progress = 0 and done = false
    and accepted_at is null and ends_at is null
    and public.friend_of(to_id) and public.granted_by(to_id, 'challenges')
  );

create policy emoji_select on public.emoji_messages for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
create policy emoji_insert on public.emoji_messages for insert to authenticated
  with check (
    from_id = auth.uid() and read_at is null
    and public.friend_of(to_id) and public.granted_by(to_id, 'emoji')
  );

-- progress snapshots: yours, or a friend's who allowed you to see progress.
create policy snapshots_select on public.progress_snapshots for select to authenticated
  using (user_id = auth.uid() or (public.friend_of(user_id) and public.granted_by(user_id, 'progress')));
create policy snapshots_insert on public.progress_snapshots for insert to authenticated with check (user_id = auth.uid());
create policy snapshots_update on public.progress_snapshots for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------------ actions that need more than a row write
-- Find someone by exact handle. Returns nothing if you are blocked with them.
create function public.find_profile(p_handle text)
returns table (id uuid, handle text, display_name text, avatar text)
language sql stable security definer set search_path = public as $$
  select p.id, p.handle, p.display_name, p.avatar
  from public.profiles p
  where p.handle = lower(trim(p_handle)) and p.id <> auth.uid() and not public.blocked_with(p.id)
$$;

-- Answer a friend request. Accepting makes you friends; the person answering chooses what the requester may do.
create function public.respond_friend_request(p_id uuid, p_accept boolean, p_grant jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare r public.friend_requests;
begin
  select * into r from public.friend_requests where id = p_id and to_id = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if public.blocked_with(r.from_id) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  update public.friend_requests set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = p_id;
  if p_accept then
    insert into public.friends (user_id, friend_id) values (r.to_id, r.from_id), (r.from_id, r.to_id) on conflict do nothing;
    insert into public.friend_permissions (owner_id, friend_id, progress, workouts, requests, challenges, emoji, reviewed)
      values (r.to_id, r.from_id,
        coalesce((p_grant->>'progress')::boolean, false), coalesce((p_grant->>'workouts')::boolean, false),
        coalesce((p_grant->>'requests')::boolean, false), coalesce((p_grant->>'challenges')::boolean, false),
        coalesce((p_grant->>'emoji')::boolean, false), true)
      on conflict do nothing;
    insert into public.friend_permissions (owner_id, friend_id) values (r.from_id, r.to_id) on conflict do nothing;
  end if;
end $$;

-- Remove a friend and everything still pending between you.
create function public.remove_friend(p_friend uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.friends where (user_id = auth.uid() and friend_id = p_friend) or (user_id = p_friend and friend_id = auth.uid());
  delete from public.shared_workouts where status = 'pending' and ((from_id = auth.uid() and to_id = p_friend) or (from_id = p_friend and to_id = auth.uid()));
  delete from public.workout_requests where status = 'pending' and ((from_id = auth.uid() and to_id = p_friend) or (from_id = p_friend and to_id = auth.uid()));
  update public.challenges set status = 'cancelled', updated_at = now()
    where status in ('pending', 'active') and ((from_id = auth.uid() and to_id = p_friend) or (from_id = p_friend and to_id = auth.uid()));
  delete from public.friend_requests where status = 'pending' and ((from_id = auth.uid() and to_id = p_friend) or (from_id = p_friend and to_id = auth.uid()));
end $$;

create function public.block_user(p_user uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user = auth.uid() then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;
  perform public.remove_friend(p_user);
end $$;

create function public.unblock_user(p_user uuid) returns void language sql security definer set search_path = public as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_user
$$;

-- The recipient of a shared workout marks it added to their calendar or dismissed.
create function public.respond_shared_workout(p_id uuid, p_added boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.shared_workouts set status = case when p_added then 'added' else 'dismissed' end
    where id = p_id and to_id = auth.uid() and status = 'pending';
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
end $$;

-- The person asked to make a workout either sends one (linking it to the request) or declines.
create function public.respond_workout_request(p_id uuid, p_action text, p_share uuid default null) returns void language plpgsql security definer set search_path = public as $$
declare r public.workout_requests;
begin
  select * into r from public.workout_requests where id = p_id and to_id = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if p_action = 'fulfill' then
    if p_share is null or not exists (select 1 from public.shared_workouts s where s.id = p_share and s.from_id = auth.uid() and s.to_id = r.from_id) then
      raise exception 'not_allowed' using errcode = 'P0001';
    end if;
    update public.workout_requests set status = 'fulfilled', share_id = p_share where id = p_id;
  elsif p_action = 'decline' then
    update public.workout_requests set status = 'declined' where id = p_id;
  else
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
end $$;

create function public.respond_challenge(p_id uuid, p_accept boolean) returns void language plpgsql security definer set search_path = public as $$
declare c public.challenges;
begin
  select * into c from public.challenges where id = p_id and to_id = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if p_accept then
    update public.challenges set status = 'active', accepted_at = now(), ends_at = now() + make_interval(days => c.days), updated_at = now() where id = p_id;
  else
    update public.challenges set status = 'declined', updated_at = now() where id = p_id;
  end if;
end $$;

-- The challenged person reports their own progress; the challenger can watch it.
create function public.report_challenge_progress(p_id uuid, p_progress numeric, p_done boolean) returns void language plpgsql security definer set search_path = public as $$
declare c public.challenges;
begin
  select * into c from public.challenges where id = p_id and to_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if now() > c.ends_at + interval '1 day' then raise exception 'expired' using errcode = 'P0001'; end if;
  update public.challenges
    set progress = greatest(0, p_progress), done = p_done, status = case when p_done then 'completed' else 'active' end, updated_at = now()
    where id = p_id;
end $$;

create function public.cancel_challenge(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.challenges set status = 'cancelled', updated_at = now()
    where id = p_id and from_id = auth.uid() and status in ('pending', 'active');
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
end $$;

create function public.mark_emoji_read(p_ids uuid[]) returns void language sql security definer set search_path = public as $$
  update public.emoji_messages set read_at = now() where to_id = auth.uid() and read_at is null and id = any (p_ids)
$$;

-- Delete your social account and everything tied to it. Your workouts stay on your device.
create function public.delete_my_account() returns void language plpgsql security definer set search_path = public as $$
begin
  delete from auth.users where id = auth.uid();
end $$;

-- ------------------------------------------------------------------ privileges
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon;
grant usage on schema public to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.friend_requests to authenticated;
grant select on public.friends, public.blocks to authenticated;
grant select, update on public.friend_permissions to authenticated;
grant select, insert, delete on public.shared_workouts to authenticated;
grant select, insert on public.workout_requests, public.challenges, public.emoji_messages to authenticated;
grant select, insert, update on public.progress_snapshots to authenticated;

grant execute on function
  public.friend_of(uuid), public.granted_by(uuid, text), public.blocked_with(uuid), public.open_request_with(uuid),
  public.find_profile(text), public.respond_friend_request(uuid, boolean, jsonb), public.remove_friend(uuid),
  public.block_user(uuid), public.unblock_user(uuid), public.respond_shared_workout(uuid, boolean),
  public.respond_workout_request(uuid, text, uuid), public.respond_challenge(uuid, boolean),
  public.report_challenge_progress(uuid, numeric, boolean), public.cancel_challenge(uuid),
  public.mark_emoji_read(uuid[]), public.delete_my_account()
  to authenticated;
