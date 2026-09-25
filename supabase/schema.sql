-- Full database schema for Tim's Music. Run once in the Supabase SQL editor on a fresh project.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_name text not null,
  created_at timestamptz not null default now()
);

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  base_title text not null,          -- title with edition suffixes removed, groups editions together
  edition text,                      -- e.g. 'Deluxe Edition', '20th Anniversary Edition'
  kind text not null default 'album' check (kind in ('album','live','compilation','single')),
  year int,
  cover_key text,                    -- e.g. /covers/<slug>  (-> _300.webp/_600.webp/_1200.webp)
  color_bg text,
  color_fg text,
  color_accent text,
  disc_count int not null default 1,
  track_count int not null default 0,
  duration_sec int not null default 0,
  added_at timestamptz not null default now()
);
create index albums_artist_idx on public.albums(artist_id, year);

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  artist_credit text not null,       -- per-track artist tag (may include features)
  disc int not null default 1,
  track_no int,
  duration_sec real not null default 0,
  bitrate int,
  file_key text not null unique,     -- R2 object key
  file_size bigint not null,
  content_hash text not null unique, -- sha1 of file, makes ingest idempotent
  search_text text generated always as (lower(title || ' ' || artist_credit)) stored,
  added_at timestamptz not null default now()
);
create index tracks_album_idx on public.tracks(album_id, disc, track_no);
create index tracks_search_trgm on public.tracks using gin (search_text extensions.gin_trgm_ops);
create index albums_title_trgm on public.albums using gin (lower(title) extensions.gin_trgm_ops);
create index artists_name_trgm on public.artists using gin (lower(name) extensions.gin_trgm_ops);

create table public.plays (
  id bigint generated always as identity primary key,
  track_id uuid not null references public.tracks(id) on delete cascade,
  listener_id text not null,
  played_at timestamptz not null default now()
);
create index plays_track_time_idx on public.plays(track_id, played_at desc);
create index plays_listener_time_idx on public.plays(listener_id, played_at desc);

-- Locked down: the Next.js server is the only client, using the secret key.
alter table public.artists enable row level security;
alter table public.albums  enable row level security;
alter table public.tracks  enable row level security;
alter table public.plays   enable row level security;

create or replace function public.search_catalog(q text, lim int default 20)
returns jsonb
language sql stable
set search_path = public, extensions
as $$
  with term as (select lower(trim(q)) t)
  select jsonb_build_object(
    'artists', coalesce((select jsonb_agg(a order by a.score desc) from (
        select ar.id, ar.slug, ar.name,
               (select al.cover_key from albums al where al.artist_id = ar.id order by al.year desc limit 1) cover_key,
               similarity(lower(ar.name), term.t) + case when lower(ar.name) like term.t || '%' then 0.5 else 0 end score
        from artists ar, term
        where lower(ar.name) % term.t or lower(ar.name) like '%' || term.t || '%'
        order by score desc limit 5) a), '[]'::jsonb),
    'albums', coalesce((select jsonb_agg(a order by a.score desc) from (
        select al.id, al.slug, al.title, al.year, al.cover_key, al.color_bg, ar.name artist_name,
               greatest(similarity(lower(al.title), term.t), word_similarity(term.t, lower(al.title || ' ' || ar.name)))
                 + case when lower(al.title) like term.t || '%' then 0.3 else 0 end score
        from albums al join artists ar on ar.id = al.artist_id, term
        where lower(al.title) like '%' || term.t || '%' or term.t <% lower(al.title || ' ' || ar.name)
        order by score desc limit 8) a), '[]'::jsonb),
    'tracks', coalesce((select jsonb_agg(x order by x.score desc) from (
        select * from (
          select distinct on (lower(tr.title), tr.artist_id)
                 tr.id, tr.title, tr.artist_credit, tr.duration_sec,
                 al.slug album_slug, al.title album_title, al.cover_key, al.color_bg, al.color_accent, ar.slug artist_slug,
                 word_similarity(term.t, tr.search_text || ' ' || lower(al.title))
                   + case when tr.search_text like term.t || '%' then 0.3 else 0 end
                   + case when lower(tr.title) = term.t then 0.5 else 0 end
                   - case when al.edition is not null or al.kind <> 'album' then 0.05 else 0 end score
          from tracks tr join albums al on al.id = tr.album_id join artists ar on ar.id = tr.artist_id, term
          where tr.search_text like '%' || term.t || '%' or term.t <% (tr.search_text || ' ' || lower(al.title))
          order by lower(tr.title), tr.artist_id, score desc) d
        order by d.score desc limit lim) x), '[]'::jsonb)
  );
$$;

create or replace function public.top_tracks(since interval default interval '30 days', lim int default 20)
returns table (track_id uuid, plays bigint)
language sql stable set search_path = public as $$
  select track_id, count(*) plays from plays
  where played_at > now() - since
  group by track_id order by plays desc limit lim;
$$;

revoke execute on function public.search_catalog(text,int) from anon, authenticated, public;
revoke execute on function public.top_tracks(interval,int) from anon, authenticated, public;

-- ---------- Playlists ----------

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  description text check (description is null or length(description) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.playlist_tracks (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  position double precision not null,   -- fractional so inserts/moves don't renumber the list
  added_at timestamptz not null default now(),
  primary key (playlist_id, track_id)
);
create index playlist_tracks_order_idx on public.playlist_tracks(playlist_id, position);

alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;

-- Keep updated_at fresh when a playlist's contents change, so lists can sort by "recently updated".
create or replace function public.touch_playlist() returns trigger
language plpgsql set search_path = public as $$
begin
  update playlists set updated_at = now() where id = coalesce(new.playlist_id, old.playlist_id);
  return null;
end $$;
create trigger playlist_tracks_touch after insert or update or delete on public.playlist_tracks
  for each row execute function public.touch_playlist();
revoke execute on function public.touch_playlist() from anon, authenticated, public;
