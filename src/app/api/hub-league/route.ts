import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();

  const { data: season } = await supabase
    .from("hub_seasons")
    .select("*")
    .eq("active", true)
    .single();

  if (!season) {
    return NextResponse.json({ season: null, standings: [], latestUpdate: null, performers: [] });
  }

  const [standingsRes, updatesRes, performersRes] = await Promise.all([
    supabase
      .from("hub_standings")
      .select("*")
      .eq("season_id", season.id)
      .order("points", { ascending: false })
      .order("nrr", { ascending: false }),
    supabase
      .from("hub_updates")
      .select("*")
      .eq("season_id", season.id)
      .eq("published", true)
      .order("week_number", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("hub_top_performers")
      .select("*")
      .eq("season_id", season.id)
      .order("week_number", { ascending: false }),
  ]);

  const allUpdates = updatesRes.data ?? [];
  const latestUpdate = allUpdates[0] ?? null;
  const pastUpdates = latestUpdate ? allUpdates.slice(1) : allUpdates;

  const allPerformers = performersRes.data ?? [];
  const maxWeek = allPerformers.length > 0 ? Math.max(...allPerformers.map((p) => p.week_number)) : 0;
  const performers = allPerformers.filter((p) => p.week_number === maxWeek);

  return NextResponse.json({
    season,
    standings: standingsRes.data ?? [],
    latestUpdate,
    pastUpdates,
    performers,
  });
}
