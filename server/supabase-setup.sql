-- Run this ONCE in Supabase: Dashboard > SQL Editor > New query > paste > Run

create table if not exists public.posts (
  id          bigint generated always as identity primary key,
  title_en    text,
  title_ne    text,
  body_en     text,
  body_ne     text,
  category    text not null default 'news',
  image       text,
  views       integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists posts_category_idx on public.posts (category);

-- Lock the table: only your server (using the secret key) can read/write it.
alter table public.posts enable row level security;

-- Used when someone opens a post: adds 1 view and returns the post.
create or replace function public.increment_views(post_id bigint)
returns setof public.posts
language sql
set search_path = public
as $$
  update public.posts set views = views + 1 where id = post_id returning *;
$$;

-- Nobody outside your server may call it.
revoke execute on function public.increment_views(bigint) from public, anon, authenticated;
