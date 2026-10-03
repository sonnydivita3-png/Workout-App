-- Posts: "look what I did". Someone shares a workout they finished with friends so they can cheer it. Nothing goes
-- on anyone's calendar and there's nothing to accept: friends see it in their feed and can send one cheer (an emoji).
--
--   * A new per-friend permission, posts ("Share their workouts with me"), turned on by the person who'd see them.
--     Like the others it starts off, and turning it off hides that friend's posts again.
--   * A post goes to the friends picked when posting (each one must allow it), and only while you're friends.
--   * Posting to someone invites their cheer on that post, even if they can't send you emoji otherwise. One cheer per
--     person per post.
--   * Who else a post went to isn't readable by the people it went to.

-- ------------------------------------------------------------------ the permission
alter table public.friend_permissions add column posts boolean not null default false;

create or replace function public.granted_by(owner uuid, perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case perm
      when 'progress' then p.progress when 'workouts' then p.workouts when 'requests' then p.requests
      when 'challenges' then p.challenges when 'emoji' then p.emoji when 'posts' then p.posts else false end
    from public.friend_permissions p where p.owner_id = owner and p.friend_id = auth.uid()
  ), false)
$$;

-- Does the caller let `other` show them their posts? (granted_by the other way round.)
create function public.allows_posts_from(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friend_permissions p where p.owner_id = auth.uid() and p.friend_id = other and p.posts)
$$;

-- Accepting a friend request can now also allow their posts.
create or replace function public.respond_friend_request(p_id uuid, p_accept boolean, p_grant jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare r public.friend_requests;
begin
  select * into r from public.friend_requests where id = p_id and to_id = auth.uid() and status = 'pending' for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if public.blocked_with(r.from_id) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  update public.friend_requests set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = p_id;
  if p_accept then
    insert into public.friends (user_id, friend_id) values (r.to_id, r.from_id), (r.from_id, r.to_id) on conflict do nothing;
    insert into public.friend_permissions (owner_id, friend_id, progress, workouts, requests, challenges, emoji, posts, reviewed)
      values (r.to_id, r.from_id,
        coalesce((p_grant->>'progress')::boolean, false), coalesce((p_grant->>'workouts')::boolean, false),
        coalesce((p_grant->>'requests')::boolean, false), coalesce((p_grant->>'challenges')::boolean, false),
        coalesce((p_grant->>'emoji')::boolean, false), coalesce((p_grant->>'posts')::boolean, false), true)
      on conflict do nothing;
    insert into public.friend_permissions (owner_id, friend_id) values (r.from_id, r.to_id) on conflict do nothing;
  end if;
end $$;

-- ------------------------------------------------------------------ posts
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  -- Who it was shown to, picked when posting.
  audience uuid[] not null check (cardinality(audience) between 1 and 100),
  -- The day the workout was done.
  workout_date date not null,
  title text not null check (char_length(title) between 1 and 80),
  emoji text check (emoji is null or char_length(emoji) <= 8),
  payload jsonb not null check (pg_column_size(payload) < 65536),
  created_at timestamptz not null default now()
);
create index posts_from on public.posts (from_id, created_at desc);
create index posts_audience on public.posts using gin (audience);

-- The server sets the time, so a post can't be dated into the future to stay at the top of feeds (or into the past to
-- slip under the rate limit).
create function public.stamp_created_at() returns trigger language plpgsql set search_path = public as $$
begin
  new.created_at := now();
  return new;
end $$;
create trigger posts_stamp before insert on public.posts for each row execute function public.stamp_created_at();
create trigger posts_rate before insert on public.posts for each row execute function public.limit_rate(10, 60);

alter table public.posts enable row level security;

-- Seen by the poster, and by each person it was shown to while they're still friends and still allow posts from them.
create policy posts_select on public.posts for select to authenticated
  using (from_id = auth.uid() or (auth.uid() = any (audience) and public.friend_of(from_id) and public.allows_posts_from(from_id)));
-- Only to friends who allow your posts.
create policy posts_insert on public.posts for insert to authenticated
  with check (
    from_id = auth.uid()
    and not exists (select 1 from unnest(audience) as a (id) where not (public.friend_of(a.id) and public.granted_by(a.id, 'posts')))
  );
create policy posts_delete on public.posts for delete to authenticated using (from_id = auth.uid());

-- ------------------------------------------------------------------ cheers
alter table public.emoji_messages drop constraint emoji_messages_context_type_check;
alter table public.emoji_messages add constraint emoji_messages_context_type_check
  check (context_type in ('share', 'challenge', 'request', 'progress', 'post'));
create unique index emoji_one_cheer_per_post on public.emoji_messages (from_id, context_id) where context_type = 'post';

-- Can the caller cheer this post? Only one they were shown, sent to the person who posted it.
create function public.can_cheer(p_post uuid, p_to uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post and p.from_id = p_to and auth.uid() = any (p.audience)
      and public.friend_of(p.from_id) and public.allows_posts_from(p.from_id)
  )
$$;

-- A cheer on a post follows the post's rules; every other emoji still needs the recipient's emoji permission.
drop policy emoji_insert on public.emoji_messages;
create policy emoji_insert on public.emoji_messages for insert to authenticated
  with check (
    from_id = auth.uid() and read_at is null and public.friend_of(to_id)
    and case when context_type = 'post' then coalesce(public.can_cheer(context_id, to_id), false) else public.granted_by(to_id, 'emoji') end
  );

-- ------------------------------------------------------------------ privileges
revoke all on public.posts from anon, authenticated;
-- Every column but the audience: the people a post went to can't read who else got it.
grant select (id, from_id, workout_date, title, emoji, payload, created_at) on public.posts to authenticated;
grant insert, delete on public.posts to authenticated;
revoke all on function public.allows_posts_from(uuid), public.can_cheer(uuid, uuid), public.stamp_created_at() from public, anon;
grant execute on function public.allows_posts_from(uuid), public.can_cheer(uuid, uuid) to authenticated;
