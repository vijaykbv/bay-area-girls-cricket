import Link from "next/link";
import { createServerClient } from "@/lib/supabase";
import type { Tournament } from "@/lib/types";
import { Trophy, ChevronRight } from "lucide-react";

export const revalidate = 3600;

async function getTournaments(): Promise<Tournament[]> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("tournaments")
      .select("*, tournament_games(id)")
      .order("created_at", { ascending: false });
    return (data as Tournament[]) ?? [];
  } catch {
    return [];
  }
}

export default async function TournamentsPage() {
  const tournaments = await getTournaments();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Trophy size={28} className="text-vv-violet" />
        <h1 className="section-title text-3xl">Tournaments</h1>
      </div>

      {tournaments.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <p className="text-lg">No tournaments saved yet.</p>
          <p className="text-sm mt-2">
            Use the{" "}
            <Link href="/admin/tournament" className="text-vv-violet hover:underline">
              Admin Tournament page
            </Link>{" "}
            to analyse and save a tournament.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => {
            const gameCount = (t.tournament_games as { id: string }[] | undefined)?.length ?? 0;
            const date = new Date(t.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            return (
              <Link
                key={t.id}
                href={`/tournaments/${t.id}`}
                className="card p-5 flex items-center justify-between hover:border-vv-violet border border-transparent transition-colors group"
              >
                <div>
                  <p className="font-semibold text-lg group-hover:text-vv-violet transition-colors">
                    {t.name}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {t.team_name} · {gameCount} game{gameCount !== 1 ? "s" : ""} · {date}
                  </p>
                </div>
                <ChevronRight size={20} className="text-gray-400 group-hover:text-vv-violet shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
