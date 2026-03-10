import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase";
import { aggregateTournamentTeam, oversToDecimal, type TeamReport } from "@/lib/analyze";
import MatchAnalysis from "@/components/MatchAnalysis";
import OpportunityPerformanceChart from "@/components/OpportunityPerformanceChart";
import { AlertCircle, Trophy } from "lucide-react";
import type { Tournament, TournamentGame } from "@/lib/types";

export const revalidate = 3600;

async function getTournament(id: string): Promise<Tournament | null> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("tournaments")
      .select("*, tournament_games(*)")
      .eq("id", id)
      .order("game_number", { referencedTable: "tournament_games", ascending: true })
      .single();
    return data as Tournament | null;
  } catch {
    return null;
  }
}

export default async function TournamentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const tournament = await getTournament(params.id);
  if (!tournament) notFound();

  const games = (tournament.tournament_games ?? []) as TournamentGame[];
  const teamReports: TeamReport[] = games.map((g) => g.team_report as TeamReport);
  const tournamentStats = aggregateTournamentTeam(teamReports);

  const batters = tournamentStats.filter((p) => p.battingInnings > 0);
  const bowlers = tournamentStats
    .filter((p) => p.bowlingAppearances > 0)
    .sort((a, b) => b.totalWickets - a.totalWickets);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Trophy size={28} className="text-vv-violet shrink-0 mt-1" />
        <div>
          <h1 className="section-title text-3xl">{tournament.name}</h1>
          <p className="text-gray-500 mt-1">
            {tournament.team_name} · {games.length} game{games.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Tournament Summary */}
      <section>
        <h2 className="section-title text-2xl mb-4">Tournament Summary</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Batting */}
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              Batting
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b">
                  <th className="text-left pb-1 font-medium">Player</th>
                  <th className="text-right pb-1 font-medium">Inn</th>
                  <th className="text-right pb-1 font-medium">Runs</th>
                  <th className="text-right pb-1 font-medium">Balls</th>
                  <th className="text-right pb-1 font-medium">SR</th>
                  <th className="text-right pb-1 font-medium">Avg</th>
                </tr>
              </thead>
              <tbody>
                {batters.map((p) => {
                  const dismissals = p.battingInnings - p.notOuts;
                  const avg =
                    dismissals > 0
                      ? (p.totalRuns / dismissals).toFixed(1)
                      : p.totalRuns > 0
                      ? "n/o"
                      : "—";
                  const sr =
                    p.totalBallsFaced > 0
                      ? ((p.totalRuns / p.totalBallsFaced) * 100).toFixed(0)
                      : "—";
                  return (
                    <tr key={p.name} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5 font-medium">
                        {p.name}
                        {p.ruleConflicts > 0 && (
                          <span
                            className="ml-1 text-xs text-red-500"
                            title="Rule conflict: top-order batter bowled"
                          >
                            ⚠
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-right text-gray-500">{p.battingInnings}</td>
                      <td className="py-1.5 text-right font-semibold">
                        {p.totalRuns}
                        {p.notOuts > 0 && <span className="text-gray-400 text-xs">*</span>}
                      </td>
                      <td className="py-1.5 text-right text-gray-500">{p.totalBallsFaced}</td>
                      <td className="py-1.5 text-right">{sr}</td>
                      <td className="py-1.5 text-right text-gray-500">{avg}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bowling */}
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
              Bowling
            </p>
            {bowlers.length === 0 ? (
              <p className="text-sm text-gray-400">No bowling data.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b">
                    <th className="text-left pb-1 font-medium">Player</th>
                    <th className="text-right pb-1 font-medium">Inn</th>
                    <th className="text-right pb-1 font-medium">Wkts</th>
                    <th className="text-right pb-1 font-medium">Overs</th>
                    <th className="text-right pb-1 font-medium">Econ</th>
                    <th className="text-right pb-1 font-medium">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {bowlers.map((p) => {
                    const realOvers = oversToDecimal(p.totalOvers);
                    const econ =
                      realOvers > 0 ? (p.totalBowlingRuns / realOvers).toFixed(2) : "—";
                    const avg =
                      p.totalWickets > 0
                        ? (p.totalBowlingRuns / p.totalWickets).toFixed(1)
                        : "—";
                    return (
                      <tr key={p.name} className="border-b border-gray-50 last:border-0">
                        <td className="py-1.5 font-medium">{p.name}</td>
                        <td className="py-1.5 text-right text-gray-500">{p.bowlingAppearances}</td>
                        <td className="py-1.5 text-right font-semibold">{p.totalWickets}</td>
                        <td className="py-1.5 text-right text-gray-500">
                          {p.totalOvers.toFixed(1)}
                        </td>
                        <td className="py-1.5 text-right">{econ}</td>
                        <td className="py-1.5 text-right text-gray-500">{avg}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Rule conflicts */}
        {tournamentStats.some((p) => p.ruleConflicts > 0) && (
          <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Rule conflicts detected</p>
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                {tournamentStats
                  .filter((p) => p.ruleConflicts > 0)
                  .map((p) => (
                    <li key={p.name}>
                      {p.name} — top-order batter bowled in {p.ruleConflicts} game
                      {p.ruleConflicts !== 1 ? "s" : ""}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        )}

        <OpportunityPerformanceChart players={tournamentStats} />
      </section>

      {/* Game by game */}
      <section>
        <h2 className="section-title text-2xl mb-4">Game by Game</h2>
        <div className="space-y-6">
          {games.map((game) => (
            <div key={game.id} className="card overflow-hidden border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-bold text-gray-400 uppercase mb-0.5">
                  Game {game.game_number}
                </p>
                <p className="text-sm font-semibold">
                  {game.opponent ? `vs ${game.opponent}` : "Unknown opponent"}
                  {game.date && (
                    <span className="text-gray-400 font-normal"> · {game.date}</span>
                  )}
                  {game.competition && (
                    <span className="text-gray-400 font-normal"> · {game.competition}</span>
                  )}
                </p>
              </div>
              <div className="px-4 pb-6">
                {game.ai_narrative && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      AI Coaching Analysis
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {game.ai_narrative}
                    </p>
                  </div>
                )}
                <MatchAnalysis
                  report={{ teams: [game.team_report as TeamReport] }}
                  context="tournament"
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
