export interface Team {
  id: string;
  name: string;
  short_name: string;
  logo_url?: string;
  created_at: string;
}

export interface Player {
  id: string;
  name: string;
  team_id?: string;
  team?: Team;
  role: "batsman" | "bowler" | "all-rounder" | "wicket-keeper";
  photo_url?: string;
  batting_style?: string;
  bowling_style?: string;
  created_at: string;
}

export interface Match {
  id: string;
  scorecard_url?: string;
  date: string;
  venue?: string;
  home_team_id: string;
  away_team_id: string;
  home_team?: Team;
  away_team?: Team;
  result?: string;
  winning_team_id?: string;
  match_type?: string;
  competition?: string;
  status: "scheduled" | "completed" | "cancelled";
  created_at: string;
}

export interface Innings {
  id: string;
  match_id: string;
  team_id: string;
  team?: Team;
  innings_number: 1 | 2;
  total_runs: number;
  total_wickets: number;
  total_overs: number;
  extras: number;
  batting_performances?: BattingPerformance[];
  bowling_performances?: BowlingPerformance[];
}

export interface BattingPerformance {
  id: string;
  innings_id: string;
  player_id?: string;
  player_name: string;
  player?: Player;
  batting_order: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strike_rate: number;
  how_out?: string;
  bowler_name?: string;
  fielder_name?: string;
  not_out: boolean;
}

export interface BowlingPerformance {
  id: string;
  innings_id: string;
  player_id?: string;
  player_name: string;
  player?: Player;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  wides: number;
  no_balls: number;
}

export interface PlayerStats {
  player_id: string;
  player_name: string;
  matches: number;
  innings: number;
  runs: number;
  highest_score: number;
  average: number;
  strike_rate: number;
  fifties: number;
  hundreds: number;
  fours: number;
  sixes: number;
  not_outs: number;
}

export interface BowlingStats {
  player_id: string;
  player_name: string;
  matches: number;
  innings: number;
  overs: number;
  wickets: number;
  runs: number;
  best_bowling: string;
  average: number;
  economy: number;
  strike_rate: number;
  five_wickets: number;
}

export interface ScorecardData {
  match: {
    date: string;
    venue: string;
    competition: string;
    match_type: string;
    result: string;
    home_team: string;
    away_team: string;
  };
  innings: InningsData[];
}

export interface InningsData {
  team: string;
  innings_number: number;
  total: string;
  batting: RawBatting[];
  bowling: RawBowling[];
  extras: string;
}

export interface RawBatting {
  name: string;
  how_out: string;
  bowler: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strike_rate: number;
}

export interface RawBowling {
  name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  wides: number;
  no_balls: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
