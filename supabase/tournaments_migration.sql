create table tournaments (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  team_name   text not null,
  created_at  timestamptz default now()
);

create table tournament_games (
  id             uuid default gen_random_uuid() primary key,
  tournament_id  uuid references tournaments(id) on delete cascade,
  game_number    int  not null,
  opponent       text,
  date           date,
  competition    text,
  scorecard_url  text,
  team_report    jsonb not null,
  created_at     timestamptz default now()
);

alter table tournaments enable row level security;
alter table tournament_games enable row level security;

create policy "public read tournaments"      on tournaments      for select using (true);
create policy "public read tournament_games" on tournament_games  for select using (true);
