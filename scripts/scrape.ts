/**
 * Local scraper script — run with: npm run scrape <scorecard-url>
 *
 * This script scrapes a CricClubs scorecard and saves it directly to Supabase.
 * Use this instead of the admin UI when running on a server where Playwright
 * is not available (e.g., Vercel).
 *
 * Usage:
 *   npm run scrape "https://cricclubs.com/strikersca/viewScorecard.do?matchId=1142&clubId=1095791"
 */

import "dotenv/config";
import { scrapeScorecard } from "../src/lib/scraper";
import { createClient } from "@supabase/supabase-js";

const url = process.argv[2];
if (!url) {
  console.error("Usage: npm run scrape <scorecard-url>");
  process.exit(1);
}

if (!url.includes("cricclubs.com")) {
  console.error("Only CricClubs URLs are supported.");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log(`Scraping: ${url}\n`);

  const data = await scrapeScorecard(url);

  console.log("Match:", data.match);
  console.log(`Innings found: ${data.innings.length}`);
  data.innings.forEach((inn) => {
    console.log(`  [${inn.innings_number}] ${inn.team}: ${inn.total} — ${inn.batting.length} batters, ${inn.bowling.length} bowlers`);
  });

  // Upsert teams
  async function upsertTeam(name: string) {
    const short_name = name.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 5);
    const { data: existing } = await supabase.from("teams").select("id").eq("name", name).single();
    if (existing) return existing.id as string;
    const { data: created } = await supabase.from("teams").insert({ name, short_name }).select("id").single();
    return created!.id as string;
  }

  const [homeTeamId, awayTeamId] = await Promise.all([
    upsertTeam(data.match.home_team),
    upsertTeam(data.match.away_team),
  ]);

  const { data: match, error: matchErr } = await supabase
    .from("matches")
    .insert({
      scorecard_url: url,
      date: data.match.date,
      venue: data.match.venue || null,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      result: data.match.result || null,
      competition: data.match.competition || null,
      match_type: data.match.match_type || "T20",
      status: "completed",
    })
    .select("id")
    .single();

  if (matchErr) throw matchErr;
  const matchId = match!.id as string;
  console.log(`\nMatch saved: ${matchId}`);

  for (const inn of data.innings) {
    const teamId = inn.team === data.match.home_team ? homeTeamId : awayTeamId;
    const totalMatch = inn.total.match(/(\d+)[\/-](\d+)/);
    const total_runs = totalMatch ? parseInt(totalMatch[1]) : 0;
    const total_wickets = totalMatch ? parseInt(totalMatch[2]) : 0;
    const oversMatch = inn.total.match(/\(?([\d.]+)\s*ov/i);
    const total_overs = oversMatch ? parseFloat(oversMatch[1]) : 0;

    const { data: inningsRow, error: innErr } = await supabase
      .from("innings")
      .insert({ match_id: matchId, team_id: teamId, innings_number: inn.innings_number, total_runs, total_wickets, total_overs, extras: 0 })
      .select("id")
      .single();

    if (innErr) throw innErr;
    const inningsId = inningsRow!.id as string;

    for (let i = 0; i < inn.batting.length; i++) {
      const b = inn.batting[i];
      const { data: player } = await supabase.from("players").select("id").ilike("name", b.name).single();
      const notOut = !b.how_out || b.how_out.toLowerCase() === "not out" || b.how_out.trim() === "";
      await supabase.from("batting_performances").insert({
        innings_id: inningsId, player_id: player?.id ?? null, player_name: b.name,
        batting_order: i + 1, runs: b.runs, balls: b.balls, fours: b.fours, sixes: b.sixes,
        strike_rate: b.strike_rate, how_out: b.how_out || "not out", bowler_name: b.bowler || null, not_out: notOut,
      });
    }

    for (const b of inn.bowling) {
      const { data: player } = await supabase.from("players").select("id").ilike("name", b.name).single();
      await supabase.from("bowling_performances").insert({
        innings_id: inningsId, player_id: player?.id ?? null, player_name: b.name,
        overs: b.overs, maidens: b.maidens, runs: b.runs, wickets: b.wickets,
        economy: b.economy, wides: b.wides, no_balls: b.no_balls,
      });
    }

    console.log(`Innings ${inn.innings_number} saved (${inn.batting.length} batters, ${inn.bowling.length} bowlers)`);
  }

  console.log(`\nDone! View at: /match/${matchId}`);
}

run().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
