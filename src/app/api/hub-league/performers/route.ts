import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { season_id, week_number, performers } = await req.json();

  if (!season_id || !week_number || !Array.isArray(performers)) {
    return NextResponse.json({ error: "season_id, week_number, performers required" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Replace existing performers for this week
  await supabase
    .from("hub_top_performers")
    .delete()
    .eq("season_id", season_id)
    .eq("week_number", week_number);

  const rows = performers.map((p: {
    category: string;
    player_name: string;
    team_name: string;
    value: string;
    match_context?: string;
  }) => ({
    season_id,
    week_number,
    category: p.category,
    player_name: p.player_name,
    team_name: p.team_name,
    value: p.value,
    match_context: p.match_context ?? null,
  }));

  const { error } = await supabase.from("hub_top_performers").insert(rows);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
