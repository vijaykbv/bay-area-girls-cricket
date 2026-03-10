import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { name, teamName, games } = await req.json();

  if (!name || !teamName || !Array.isArray(games) || games.length === 0) {
    return NextResponse.json(
      { error: "name, teamName, and games are required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const { data: tournament, error: tErr } = await supabase
    .from("tournaments")
    .insert({ name, team_name: teamName })
    .select()
    .single();

  if (tErr || !tournament) {
    return NextResponse.json(
      { error: tErr?.message ?? "Failed to create tournament" },
      { status: 500 }
    );
  }

  const { error: gErr } = await supabase.from("tournament_games").insert(
    games.map((g: {
      gameNumber: number;
      opponent: string | null;
      date: string | null;
      competition: string | null;
      url: string;
      teamReport: unknown;
      managerNotes?: string;
      narrative?: string | null;
    }) => ({
      tournament_id: tournament.id,
      game_number: g.gameNumber,
      opponent: g.opponent,
      date: g.date,
      competition: g.competition,
      scorecard_url: g.url,
      team_report: g.teamReport,
      manager_notes: g.managerNotes ?? null,
      ai_narrative: g.narrative ?? null,
    }))
  );

  if (gErr) {
    return NextResponse.json({ error: gErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: tournament.id });
}
