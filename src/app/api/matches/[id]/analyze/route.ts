import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase";
import type { Innings, BattingPerformance, BowlingPerformance } from "@/lib/types";

const anthropic = new Anthropic();

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { notes } = await req.json();
  if (!notes?.trim()) {
    return NextResponse.json({ error: "notes are required" }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI analysis not configured" }, { status: 503 });
  }

  const supabase = createServerClient();

  const [{ data: match }, { data: inningsRows }] = await Promise.all([
    supabase
      .from("matches")
      .select("*, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)")
      .eq("id", params.id)
      .single(),
    supabase
      .from("innings")
      .select("*, team:teams(name), batting_performances(*), bowling_performances(*)")
      .eq("match_id", params.id)
      .order("innings_number"),
  ]);

  if (!match || !inningsRows?.length) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const innings = inningsRows as Innings[];

  const sections = innings.map((inn) => {
    const batting = (inn.batting_performances ?? []) as BattingPerformance[];
    const bowling = (inn.bowling_performances ?? []) as BowlingPerformance[];

    const battingLines = batting
      .sort((a, b) => a.batting_order - b.batting_order)
      .map((b) => {
        const dismissal = b.not_out ? "not out" : b.bowler_name ? `b ${b.bowler_name}` : "out";
        return `  ${b.player_name} — ${b.runs} runs off ${b.balls} balls (SR ${b.strike_rate.toFixed(0)}), ${dismissal}`;
      })
      .join("\n");

    const bowlingLines = bowling
      .map((b) => `  ${b.player_name} — ${b.overs} overs, ${b.wickets} wkt${b.wickets !== 1 ? "s" : ""}, ${b.runs} runs (econ ${b.economy.toFixed(2)})`)
      .join("\n");

    return `${inn.team?.name ?? "Team"} innings:\nBatting:\n${battingLines}\nBowling:\n${bowlingLines}`;
  });

  const prompt = `You are a cricket coach's assistant helping analyze a match for a girls cricket team.

Match: ${match.home_team?.name} vs ${match.away_team?.name}${match.date ? `\nDate: ${match.date}` : ""}${match.competition ? `\nCompetition: ${match.competition}` : ""}${match.result ? `\nResult: ${match.result}` : ""}

Scorecard:
${sections.join("\n\n")}

Coach's Observations:
${notes.trim()}

Write a brief coaching analysis (3–5 sentences) that weaves in the coach's specific observations, highlights the most impactful performances, and identifies one or two concrete development areas. Be encouraging and specific. Write in flowing prose — no bullet points.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const narrative =
    response.content[0].type === "text" ? response.content[0].text : "";

  return NextResponse.json({ narrative });
}
