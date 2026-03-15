import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase";
import type { Innings, BattingPerformance, BowlingPerformance } from "@/lib/types";

export const maxDuration = 60;

const anthropic = new Anthropic();

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
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
        return `  ${b.player_name} — ${b.runs}(${b.balls}) SR ${b.strike_rate.toFixed(0)}, ${dismissal}`;
      })
      .join("\n");

    const bowlingLines = bowling
      .map((b) => `  ${b.player_name} — ${b.overs} ov, ${b.wickets}wkt, ${b.runs}r, econ ${b.economy.toFixed(2)}`)
      .join("\n");

    return `${inn.team?.name} (${inn.total_runs}/${inn.total_wickets} in ${inn.total_overs} overs)\nBatting:\n${battingLines}\nBowling:\n${bowlingLines}`;
  });

  const prompt = `You are a cricket coach's assistant. Write a concise match summary for a girls youth cricket game.

Match: ${match.home_team?.name} vs ${match.away_team?.name}
${match.date ? `Date: ${match.date}` : ""}${match.competition ? `\nCompetition: ${match.competition}` : ""}${match.result ? `\nResult: ${match.result}` : ""}

Scorecard:
${sections.join("\n\n")}

Write a match summary with exactly these three sections. Use the section headers exactly as shown:

**Match Result**
One sentence on how the game was won/lost and the margin.

**Standout Performances**
3–4 bullet points naming specific players and their contributions (batting and bowling). Be precise — include actual numbers.

**Team Summary**
2–3 sentences describing each team's overall performance and one thing each team did well or struggled with.

Keep it under 200 words total. Be direct and factual.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const summary =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
