import { createServerClient } from "@/lib/supabase";
import MatchCard from "@/components/MatchCard";
import type { Match } from "@/lib/types";
import type { Metadata } from "next";
import { Trophy } from "lucide-react";

export const metadata: Metadata = { title: "Results" };
export const revalidate = 3600;

async function getResults(): Promise<Match[]> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("matches")
      .select("*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)")
      .eq("status", "completed")
      .order("date", { ascending: false });
    return (data as Match[]) ?? [];
  } catch {
    return [];
  }
}

export default async function ResultsPage() {
  const matches = await getResults();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="section-title text-3xl">Results</h1>
      <p className="text-gray-500 mb-8">All completed match results and scorecards.</p>

      {matches.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Trophy size={48} className="mx-auto mb-3 opacity-30" />
          <p>No results yet. Import scorecards via the admin panel.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}
