import { createServerClient } from "@/lib/supabase";
import BattingScorecard from "@/components/BattingScorecard";
import BowlingScorecard from "@/components/BowlingScorecard";
import MatchAnalysis from "@/components/MatchAnalysis";
import MatchAIAnalysis from "@/components/MatchAIAnalysis";
import MatchSummary from "@/components/MatchSummary";
import PlayersOfMatch from "@/components/PlayersOfMatch";
import { analyzeMatch, computePlayersOfMatch } from "@/lib/analyze";
import type { Match, Innings } from "@/lib/types";
import type { Metadata } from "next";
import { format } from "date-fns";
import { Calendar, MapPin, Trophy, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

export const revalidate = 3600;

async function getMatch(id: string): Promise<Match | null> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("matches")
      .select("*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)")
      .eq("id", id)
      .single();
    return (data as Match) ?? null;
  } catch {
    return null;
  }
}

async function getInnings(matchId: string): Promise<Innings[]> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("innings")
      .select("*, team:teams(*), batting_performances(*), bowling_performances(*)")
      .eq("match_id", matchId)
      .order("innings_number");
    return (data as Innings[]) ?? [];
  } catch {
    return [];
  }
}

/** Infer result from innings data when not stored explicitly */
function inferResult(innings: Innings[]): string {
  const inn1 = innings.find((i) => i.innings_number === 1);
  const inn2 = innings.find((i) => i.innings_number === 2);
  if (!inn1 || !inn2) return "";

  const team1 = inn1.team?.name ?? "Team 1";
  const team2 = inn2.team?.name ?? "Team 2";

  if (inn2.total_runs > inn1.total_runs) {
    const w = 10 - inn2.total_wickets;
    return `${team2} won by ${w} wicket${w !== 1 ? "s" : ""}`;
  } else if (inn1.total_runs > inn2.total_runs) {
    const r = inn1.total_runs - inn2.total_runs;
    return `${team1} won by ${r} run${r !== 1 ? "s" : ""}`;
  }
  return "Match tied";
}

/** Parse YYYY-MM-DD safely without timezone shift */
function parseMatchDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const match = await getMatch(params.id);
  if (!match) return { title: "Match Not Found" };
  return {
    title: `${match.home_team?.name} vs ${match.away_team?.name} — ${format(parseMatchDate(match.date), "d MMM yyyy")}`,
  };
}

export default async function MatchPage({
  params,
}: {
  params: { id: string };
}) {
  const [match, innings] = await Promise.all([
    getMatch(params.id),
    getInnings(params.id),
  ]);

  if (!match) notFound();

  const result = match.result || inferResult(innings);
  const inn1 = innings.find((i) => i.innings_number === 1);
  const inn2 = innings.find((i) => i.innings_number === 2);
  const analysisReport = analyzeMatch(innings);
  const potm = computePlayersOfMatch(innings);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* ── Match header card ─────────────────────────────────── */}
      <div className="card mb-8 overflow-hidden">
        {/* Black meta bar */}
        <div className="bg-black px-6 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
          {match.competition && (
            <span className="text-vv-violet font-semibold uppercase tracking-wide">
              {match.competition}
            </span>
          )}
          {match.match_type && <span>· {match.match_type}</span>}
          <span className="flex items-center gap-1 sm:ml-auto">
            <Calendar size={12} />
            {format(parseMatchDate(match.date), "EEEE, d MMMM yyyy")}
          </span>
          {match.venue && (
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {match.venue}
            </span>
          )}
          {match.scorecard_url && (
            <a
              href={match.scorecard_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-vv-violet hover:text-vv-light transition-colors"
            >
              <ExternalLink size={12} /> Source
            </a>
          )}
        </div>

        {/* Score summary */}
        <div className="px-6 py-7">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
            {/* Home team */}
            <div>
              <p className="font-bold text-black text-base sm:text-lg leading-tight">
                {match.home_team?.name ?? "Home Team"}
              </p>
              {inn1 ? (
                <p className="text-3xl sm:text-4xl font-black text-black mt-1 tabular-nums">
                  {inn1.total_runs}
                  <span className="text-gray-400">/{inn1.total_wickets}</span>
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({inn1.total_overs} ov)
                  </span>
                </p>
              ) : (
                <p className="text-gray-400 mt-1 text-sm">Yet to bat</p>
              )}
            </div>

            {/* VS divider */}
            <div className="flex flex-col items-center">
              <span className="text-gray-300 font-bold text-lg">vs</span>
            </div>

            {/* Away team */}
            <div className="text-right">
              <p className="font-bold text-black text-base sm:text-lg leading-tight">
                {match.away_team?.name ?? "Away Team"}
              </p>
              {inn2 ? (
                <p className="text-3xl sm:text-4xl font-black text-black mt-1 tabular-nums">
                  {inn2.total_runs}
                  <span className="text-gray-400">/{inn2.total_wickets}</span>
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({inn2.total_overs} ov)
                  </span>
                </p>
              ) : (
                <p className="text-gray-400 mt-1 text-sm text-right">Yet to bat</p>
              )}
            </div>
          </div>

          {/* Result banner */}
          {result && (
            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm font-semibold text-vv-dark">
              <Trophy size={16} className="text-vv-violet shrink-0" />
              {result}
            </div>
          )}
        </div>
      </div>

      {/* ── Auto-generated match summary ──────────────────────── */}
      {innings.length > 0 && <MatchSummary matchId={params.id} />}

      {/* ── Players of the Match ──────────────────────────────── */}
      <PlayersOfMatch players={potm} />

      {/* ── Innings ───────────────────────────────────────────── */}
      {innings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          Scorecard data not available for this match.
        </div>
      ) : (
        <div className="space-y-8">
          {innings.map((inn) => (
            <section key={inn.id}>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                {inn.innings_number === 1 ? "1st" : "2nd"} Innings —{" "}
                {inn.team?.name}
              </h2>
              <div className="card p-5 sm:p-6 space-y-6">
                <BattingScorecard innings={inn} />
                <BowlingScorecard innings={inn} />
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── Selection & role analysis ─────────────────────────── */}
      <MatchAnalysis report={analysisReport} />

      {/* ── AI coaching analysis ──────────────────────────────── */}
      <MatchAIAnalysis matchId={params.id} />
    </div>
  );
}
