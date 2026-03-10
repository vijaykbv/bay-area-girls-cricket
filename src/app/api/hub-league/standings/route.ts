import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function PUT(req: NextRequest) {
  const { season_id, standings } = await req.json();

  if (!season_id || !Array.isArray(standings)) {
    return NextResponse.json({ error: "season_id and standings array required" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Delete existing standings for season, then insert fresh
  await supabase.from("hub_standings").delete().eq("season_id", season_id);

  const rows = standings.map((s: {
    team_name: string;
    played: number;
    won: number;
    lost: number;
    tied: number;
    no_result: number;
    points: number;
    nrr: number;
  }) => ({
    season_id,
    team_name: s.team_name,
    played: s.played ?? 0,
    won: s.won ?? 0,
    lost: s.lost ?? 0,
    tied: s.tied ?? 0,
    no_result: s.no_result ?? 0,
    points: s.points ?? 0,
    nrr: s.nrr ?? 0,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("hub_standings").insert(rows);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
