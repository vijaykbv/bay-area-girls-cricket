-- Bay Area Girls Cricket - Supabase Schema
-- Run this in your Supabase SQL editor at:
-- https://supabase.com/dashboard/project/_/sql

-- Teams
create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text not null,
  logo_url text,
  created_at timestamptz default now()
);

-- Players
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  team_id uuid references teams(id) on delete set null,
  role text check (role in ('batsman', 'bowler', 'all-rounder', 'wicket-keeper')) default 'all-rounder',
  photo_url text,
  batting_style text,
  bowling_style text,
  created_at timestamptz default now()
);

-- Matches
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  scorecard_url text,
  date date not null,
  venue text,
  home_team_id uuid references teams(id),
  away_team_id uuid references teams(id),
  result text,
  winning_team_id uuid references teams(id),
  match_type text default 'T20',
  competition text,
  status text check (status in ('scheduled', 'completed', 'cancelled')) default 'scheduled',
  created_at timestamptz default now()
);

-- Innings
create table if not exists innings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  team_id uuid references teams(id),
  innings_number integer check (innings_number in (1, 2)),
  total_runs integer default 0,
  total_wickets integer default 0,
  total_overs numeric(5,1) default 0,
  extras integer default 0,
  created_at timestamptz default now(),
  unique(match_id, innings_number)
);

-- Batting performances
create table if not exists batting_performances (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid references innings(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  player_name text not null,
  batting_order integer,
  runs integer not null default 0,
  balls integer not null default 0,
  fours integer default 0,
  sixes integer default 0,
  strike_rate numeric(6,2) default 0,
  how_out text,
  bowler_name text,
  fielder_name text,
  not_out boolean default false,
  created_at timestamptz default now()
);

-- Bowling performances
create table if not exists bowling_performances (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid references innings(id) on delete cascade,
  player_id uuid references players(id) on delete set null,
  player_name text not null,
  overs numeric(5,1) not null default 0,
  maidens integer default 0,
  runs integer not null default 0,
  wickets integer not null default 0,
  economy numeric(5,2) default 0,
  wides integer default 0,
  no_balls integer default 0,
  created_at timestamptz default now()
);

-- News posts
create table if not exists news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  content text not null,
  excerpt text,
  cover_image_url text,
  published boolean default false,
  published_at timestamptz,
  created_at timestamptz default now()
);

-- Gallery
create table if not exists gallery (
  id uuid primary key default gen_random_uuid(),
  title text,
  image_url text not null,
  match_id uuid references matches(id) on delete set null,
  created_at timestamptz default now()
);

-- Enable row-level security (allow public reads)
alter table teams enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table innings enable row level security;
alter table batting_performances enable row level security;
alter table bowling_performances enable row level security;
alter table news enable row level security;
alter table gallery enable row level security;

create policy "Public read access" on teams for select using (true);
create policy "Public read access" on players for select using (true);
create policy "Public read access" on matches for select using (true);
create policy "Public read access" on innings for select using (true);
create policy "Public read access" on batting_performances for select using (true);
create policy "Public read access" on bowling_performances for select using (true);
create policy "Public read access" on news for select using (published = true);
create policy "Public read access" on gallery for select using (true);

-- Batting statistics view
create or replace view batting_stats as
select
  coalesce(p.id::text, bp.player_name) as player_id,
  bp.player_name,
  count(distinct i.match_id) as matches,
  count(bp.id) as innings,
  sum(bp.runs) as runs,
  max(bp.runs) as highest_score,
  round(sum(bp.runs)::numeric / nullif(count(bp.id) - count(case when bp.not_out then 1 end), 0), 2) as average,
  round(sum(bp.runs)::numeric * 100 / nullif(sum(bp.balls), 0), 2) as strike_rate,
  count(case when bp.runs >= 50 and bp.runs < 100 then 1 end) as fifties,
  count(case when bp.runs >= 100 then 1 end) as hundreds,
  sum(bp.fours) as fours,
  sum(bp.sixes) as sixes,
  count(case when bp.not_out then 1 end) as not_outs
from batting_performances bp
join innings i on bp.innings_id = i.id
left join players p on bp.player_id = p.id
where bp.balls > 0
group by coalesce(p.id::text, bp.player_name), bp.player_name
order by runs desc;

-- Bowling statistics view
create or replace view bowling_stats as
select
  coalesce(p.id::text, bo.player_name) as player_id,
  bo.player_name,
  count(distinct i.match_id) as matches,
  count(bo.id) as innings,
  sum(bo.overs) as overs,
  sum(bo.wickets) as wickets,
  sum(bo.runs) as runs,
  round(sum(bo.runs)::numeric / nullif(sum(bo.wickets), 0), 2) as average,
  round(sum(bo.runs)::numeric / nullif(sum(bo.overs), 0), 2) as economy,
  round(sum(bo.overs)::numeric * 6 / nullif(sum(bo.wickets), 0), 2) as strike_rate,
  count(case when bo.wickets >= 5 then 1 end) as five_wickets
from bowling_performances bo
join innings i on bo.innings_id = i.id
left join players p on bo.player_id = p.id
where bo.overs > 0
group by coalesce(p.id::text, bo.player_name), bo.player_name
order by wickets desc;
