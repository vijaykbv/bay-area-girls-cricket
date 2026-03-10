import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { scrapeScorecard } from "@/lib/scraper";

export const maxDuration = 60;
import { analyzeMatch, formatMatchReport, inningsToTeamInputs } from "@/lib/analyze";
import type { ScorecardData, Innings } from "@/lib/types";

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return url.startsWith("https://") && !url.includes("your_supabase") && !url.includes("placeholder");
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured. Please fill in NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local and restart the server." },
      { status: 503 }
    );
  }

  const { url } = await req.json();
  if (!url || !url.includes("cricclubs.com")) {
    return NextResponse.json({ error: "Invalid CricClubs URL" }, { status: 400 });
  }

  try {
    const data = await scrapeScorecard(url);
    console.log("Scraped match data:", JSON.stringify(data.match, null, 2));
    console.log("Innings found:", data.innings.length);
    const result = await saveScorecard(data, url);

    // ── Background analysis — runs after save, prints to server console ──
    runAnalysisInBackground(result.matchId, data.match.home_team, data.match.away_team);

    return NextResponse.json({ success: true, matchId: result.matchId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Scrape/save error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function saveScorecard(data: ScorecardData, url: string) {
  const supabase = createServerClient();

  async function upsertTeam(name: string): Promise<string> {
    const short_name = name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 5);

    const { data: existing } = await supabase
      .from("teams")
      .select("id")
      .eq("name", name)
      .single();
    if (existing?.id) return existing.id as string;

    const { data: created, error } = await supabase
      .from("teams")
      .insert({ name, short_name })
      .select("id")
      .single();
    if (error) throw new Error(`Failed to create team "${name}": ${error.message}`);
    if (!created?.id) throw new Error(`Team insert returned no id for "${name}"`);
    return created.id as string;
  }

  const [homeTeamId, awayTeamId] = await Promise.all([
    upsertTeam(data.match.home_team),
    upsertTeam(data.match.away_team),
  ]);

  // Delete any existing match for this URL so re-imports update cleanly
  const { data: existing } = await supabase
    .from("matches")
    .select("id")
    .eq("scorecard_url", url);
  if (existing && existing.length > 0) {
    const ids = existing.map((m: { id: string }) => m.id);
    await supabase.from("matches").delete().in("id", ids);
  }

  // Normalise date to YYYY-MM-DD
  const matchDate = parseDate(data.match.date);

  const { data: match, error: matchErr } = await supabase
    .from("matches")
    .insert({
      scorecard_url: url,
      date: matchDate,
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

  if (matchErr) throw new Error(`Failed to save match: ${matchErr.message}`);
  if (!match?.id) throw new Error("Match insert returned no id");
  const matchId = match.id as string;

  for (const inn of data.innings) {
    const teamId = inn.team === data.match.home_team ? homeTeamId : awayTeamId;

    // CricClubs format: "Total (9 wickets, 22.2 overs ) 86"
    // Fallback format:  "86/9 (22.2 ov)"
    const wicketsWordMatch = inn.total.match(/(\d+)\s*wickets?/i);
    const runsAtEndMatch   = inn.total.match(/\)\s*(\d+)\s*$/);
    const slashMatch       = inn.total.match(/(\d+)[/](\d+)/);
    const oversMatch       = inn.total.match(/([\d.]+)\s*overs?/i) ||
                             inn.total.match(/([\d.]+)\s*ov\b/i);

    const total_runs    = runsAtEndMatch  ? parseInt(runsAtEndMatch[1])
                        : slashMatch      ? parseInt(slashMatch[1])
                        : 0;
    const total_wickets = wicketsWordMatch ? parseInt(wicketsWordMatch[1])
                        : slashMatch       ? parseInt(slashMatch[2])
                        : 0;
    const total_overs   = oversMatch ? parseFloat(oversMatch[1]) : 0;
    // Parse extras total from e.g. "Extras (b 1 lb 0 w 10 nb 0 ) 11"
    const extrasMatch = inn.extras.match(/\)\s*(\d+)\s*$/);
    const extras = extrasMatch ? parseInt(extrasMatch[1]) : 0;

    const { data: inningsRow, error: innErr } = await supabase
      .from("innings")
      .insert({
        match_id: matchId,
        team_id: teamId,
        innings_number: inn.innings_number,
        total_runs,
        total_wickets,
        total_overs,
        extras,
      })
      .select("id")
      .single();

    if (innErr) throw new Error(`Failed to save innings ${inn.innings_number}: ${innErr.message}`);
    if (!inningsRow?.id) throw new Error(`Innings insert returned no id`);
    const inningsId = inningsRow.id as string;

    for (let i = 0; i < inn.batting.length; i++) {
      const b = inn.batting[i];
      const { data: player } = await supabase
        .from("players")
        .select("id")
        .ilike("name", b.name)
        .maybeSingle();

      const notOut =
        !b.how_out ||
        b.how_out.toLowerCase() === "not out" ||
        b.how_out.trim() === "";

      const { error: batErr } = await supabase.from("batting_performances").insert({
        innings_id: inningsId,
        player_id: player?.id ?? null,
        player_name: b.name,
        batting_order: i + 1,
        runs: b.runs,
        balls: b.balls,
        fours: b.fours,
        sixes: b.sixes,
        strike_rate: b.strike_rate,
        how_out: b.how_out || "not out",
        bowler_name: b.bowler || null,
        not_out: notOut,
      });
      if (batErr) console.warn(`Batting insert warning for ${b.name}: ${batErr.message}`);
    }

    for (const b of inn.bowling) {
      const { data: player } = await supabase
        .from("players")
        .select("id")
        .ilike("name", b.name)
        .maybeSingle();

      const { error: bowlErr } = await supabase.from("bowling_performances").insert({
        innings_id: inningsId,
        player_id: player?.id ?? null,
        player_name: b.name,
        overs: b.overs,
        maidens: b.maidens,
        runs: b.runs,
        wickets: b.wickets,
        economy: b.economy,
        wides: b.wides,
        no_balls: b.no_balls,
      });
      if (bowlErr) console.warn(`Bowling insert warning for ${b.name}: ${bowlErr.message}`);
    }
  }

  return { matchId };
}

/** Parse various date formats into YYYY-MM-DD for Postgres */
function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString().split("T")[0];

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // Try native Date parse (handles "Mar 01, 2025", "01/03/2025", etc.)
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];

  // Fallback to today
  return new Date().toISOString().split("T")[0];
}

/**
 * Fetch the saved innings from DB and print a role/selection analysis to the
 * server console. Runs asynchronously so it doesn't block the HTTP response.
 */
function runAnalysisInBackground(matchId: string, homeTeam: string, awayTeam: string) {
  const supabase = createServerClient();

  Promise.resolve(
    supabase
      .from("innings")
      .select("*, team:teams(*), batting_performances(*), bowling_performances(*)")
      .eq("match_id", matchId)
      .order("innings_number")
  ).then(({ data, error }) => {
    if (error || !data) {
      console.warn("[Analysis] Could not fetch innings for analysis:", error?.message);
      return;
    }
    const report = analyzeMatch(data as Innings[]);
    const title = `${homeTeam} vs ${awayTeam}`;
    console.log(formatMatchReport(report, title));
  }).catch((err: unknown) => {
    console.warn("[Analysis] Unexpected error:", err);
  });
}
