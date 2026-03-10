"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  Save,
} from "lucide-react";
import MatchAnalysis from "@/components/MatchAnalysis";
import OpportunityPerformanceChart from "@/components/OpportunityPerformanceChart";
import {
  aggregateTournamentTeam,
  oversToDecimal,
  type TeamReport,
  type TournamentPlayerStats,
} from "@/lib/analyze";

interface GameInput {
  url: string;
  notes: string;
}

interface GameResult {
  gameNumber: number;
  url: string;
  notes: string;
  opponent: string | null;
  date: string | null;
  competition: string | null;
  teamReport: TeamReport | null;
  narrative: string | null;
  error: string | null;
  status: "pending" | "loading" | "done" | "error";
}

export default function TournamentPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [gameInputs, setGameInputs] = useState<GameInput[]>([{ url: "", notes: "" }, { url: "", notes: "" }]);
  const [isRunning, setIsRunning] = useState(false);
  const [games, setGames] = useState<GameResult[]>([]);
  const [expandedGames, setExpandedGames] = useState<Set<number>>(new Set());
  const [tournamentStats, setTournamentStats] = useState<
    TournamentPlayerStats[] | null
  >(null);
  const [tournamentName, setTournamentName] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  function addGame() {
    setGameInputs([...gameInputs, { url: "", notes: "" }]);
  }

  function removeGame(idx: number) {
    setGameInputs(gameInputs.filter((_, i) => i !== idx));
  }

  function updateGameUrl(idx: number, value: string) {
    setGameInputs(gameInputs.map((g, i) => (i === idx ? { ...g, url: value } : g)));
  }

  function updateGameNotes(idx: number, value: string) {
    setGameInputs(gameInputs.map((g, i) => (i === idx ? { ...g, notes: value } : g)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validInputs = gameInputs.filter((g) => g.url.trim());
    if (!teamName.trim() || validInputs.length === 0) return;

    setIsRunning(true);
    setTournamentStats(null);
    setSaveStatus("idle");
    setTournamentName("");

    const initial: GameResult[] = validInputs.map((input, i) => ({
      gameNumber: i + 1,
      url: input.url,
      notes: input.notes,
      opponent: null,
      date: null,
      competition: null,
      teamReport: null,
      narrative: null,
      error: null,
      status: "pending",
    }));
    setGames(initial);

    const completed: TeamReport[] = [];
    let firstCompetition = "";

    for (let i = 0; i < validInputs.length; i++) {
      setGames((prev) =>
        prev.map((g) =>
          g.gameNumber === i + 1 ? { ...g, status: "loading" } : g
        )
      );

      try {
        const res = await fetch("/api/analyze-game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            teamName: teamName.trim(),
            url: validInputs[i].url,
            notes: validInputs[i].notes,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          setGames((prev) =>
            prev.map((g) =>
              g.gameNumber === i + 1
                ? { ...g, status: "error", error: data.error ?? "Failed" }
                : g
            )
          );
        } else {
          completed.push(data.teamReport);
          if (!firstCompetition && data.competition) firstCompetition = data.competition;
          setGames((prev) =>
            prev.map((g) =>
              g.gameNumber === i + 1
                ? {
                    ...g,
                    status: "done",
                    teamReport: data.teamReport,
                    narrative: data.narrative ?? null,
                    opponent: data.opponent,
                    date: data.date,
                    competition: data.competition,
                  }
                : g
            )
          );
          setExpandedGames((prev) => new Set(Array.from(prev).concat(i + 1)));
        }
      } catch {
        setGames((prev) =>
          prev.map((g) =>
            g.gameNumber === i + 1
              ? { ...g, status: "error", error: "Network error" }
              : g
          )
        );
      }
    }

    if (completed.length > 0) {
      setTournamentStats(aggregateTournamentTeam(completed));
      if (firstCompetition) setTournamentName(firstCompetition);
    }

    setIsRunning(false);
  }

  function toggleGame(gameNumber: number) {
    setExpandedGames((prev) => {
      const arr = Array.from(prev);
      if (prev.has(gameNumber)) return new Set(arr.filter((n) => n !== gameNumber));
      return new Set(arr.concat(gameNumber));
    });
  }

  async function handleSave() {
    const completed = games.filter((g) => g.status === "done" && g.teamReport);
    if (!tournamentName.trim() || completed.length === 0) return;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tournamentName.trim(),
          teamName,
          games: completed.map((g) => ({
            gameNumber: g.gameNumber,
            opponent: g.opponent,
            date: g.date,
            competition: g.competition,
            url: g.url,
            teamReport: g.teamReport,
            managerNotes: g.notes,
            narrative: g.narrative,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaveStatus("saved");
      router.push(`/tournaments/${data.id}`);
    } catch (err) {
      console.error(err);
      setSaveStatus("idle");
      alert(err instanceof Error ? err.message : "Save failed");
    }
  }

  const batters = tournamentStats?.filter((p) => p.battingInnings > 0) ?? [];
  const bowlers = (tournamentStats ?? [])
    .filter((p) => p.bowlingAppearances > 0)
    .sort((a, b) => b.totalWickets - a.totalWickets);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="section-title text-3xl">Tournament Analysis</h1>
      <p className="text-gray-500 mb-8">
        Enter a team name and one scorecard URL per match. Each game is scraped
        and analysed in sequence — results appear as they complete.
      </p>

      {/* ── Form ── */}
      <form
        onSubmit={handleSubmit}
        className="card p-6 space-y-5 border-t-4 border-vv-violet mb-10"
      >
        <div>
          <label className="block text-sm font-semibold text-black mb-1">
            Team Name
          </label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g. Strikers Jaguars"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vv-violet"
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            Partial match is fine — case insensitive
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-black mb-2">
            Matches
          </label>
          <div className="space-y-4">
            {gameInputs.map((game, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-gray-400 w-5 shrink-0 text-right font-medium">
                    {idx + 1}
                  </span>
                  <input
                    type="url"
                    value={game.url}
                    onChange={(e) => updateGameUrl(idx, e.target.value)}
                    placeholder="https://cricclubs.com/.../viewScorecard.do?matchId=..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vv-violet"
                  />
                  {gameInputs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGame(idx)}
                      className="text-gray-400 hover:text-red-500 p-1 shrink-0"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <textarea
                  value={game.notes}
                  onChange={(e) => updateGameNotes(idx, e.target.value)}
                  placeholder="Notes from this game — things the scorecard doesn't capture…"
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-vv-violet resize-y ml-7"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addGame}
            className="mt-2 flex items-center gap-1 text-sm text-vv-violet font-semibold hover:underline"
          >
            <Plus size={14} /> Add match
          </button>
        </div>

        <button
          type="submit"
          disabled={isRunning}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {isRunning ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Analysing…
            </>
          ) : (
            "Analyse Tournament"
          )}
        </button>
      </form>

      {/* ── Results ── */}
      {games.length > 0 && (
        <div className="space-y-10">
          {/* Progress strip */}
          <div className="flex flex-wrap gap-2">
            {games.map((g) => (
              <div
                key={g.gameNumber}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${
                  g.status === "done"
                    ? "bg-green-100 text-green-700"
                    : g.status === "loading"
                    ? "bg-vv-light text-vv-dark"
                    : g.status === "error"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {g.status === "done" && <CheckCircle size={12} />}
                {g.status === "loading" && (
                  <Loader2 size={12} className="animate-spin" />
                )}
                {g.status === "error" && <AlertCircle size={12} />}
                {g.status === "pending" && <Clock size={12} />}
                Game {g.gameNumber}
                {g.opponent && ` vs ${g.opponent}`}
              </div>
            ))}
          </div>

          {/* Tournament summary */}
          {tournamentStats && (
            <section>
              <h2 className="section-title text-2xl mb-1">
                Tournament Summary
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                {teamName} ·{" "}
                {games.filter((g) => g.status === "done").length} games
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Batting table */}
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
                            ? (
                                (p.totalRuns / p.totalBallsFaced) *
                                100
                              ).toFixed(0)
                            : "—";
                        return (
                          <tr
                            key={p.name}
                            className="border-b border-gray-50 last:border-0"
                          >
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
                            <td className="py-1.5 text-right text-gray-500">
                              {p.battingInnings}
                            </td>
                            <td className="py-1.5 text-right font-semibold">
                              {p.totalRuns}
                              {p.notOuts > 0 && (
                                <span className="text-gray-400 text-xs">
                                  *
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 text-right text-gray-500">
                              {p.totalBallsFaced}
                            </td>
                            <td className="py-1.5 text-right">{sr}</td>
                            <td className="py-1.5 text-right text-gray-500">
                              {avg}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Bowling table */}
                <div className="card p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                    Bowling
                  </p>
                  {bowlers.length === 0 ? (
                    <p className="text-sm text-gray-400">No bowling data yet.</p>
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
                            realOvers > 0
                              ? (p.totalBowlingRuns / realOvers).toFixed(2)
                              : "—";
                          const avg =
                            p.totalWickets > 0
                              ? (p.totalBowlingRuns / p.totalWickets).toFixed(1)
                              : "—";
                          return (
                            <tr
                              key={p.name}
                              className="border-b border-gray-50 last:border-0"
                            >
                              <td className="py-1.5 font-medium">{p.name}</td>
                              <td className="py-1.5 text-right text-gray-500">
                                {p.bowlingAppearances}
                              </td>
                              <td className="py-1.5 text-right font-semibold">
                                {p.totalWickets}
                              </td>
                              <td className="py-1.5 text-right text-gray-500">
                                {p.totalOvers.toFixed(1)}
                              </td>
                              <td className="py-1.5 text-right">{econ}</td>
                              <td className="py-1.5 text-right text-gray-500">
                                {avg}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Rule compliance summary */}
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
                            {p.name} — top-order batter bowled in{" "}
                            {p.ruleConflicts} game
                            {p.ruleConflicts !== 1 ? "s" : ""}
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              )}
              <OpportunityPerformanceChart players={tournamentStats} />
            </section>
          )}

          {/* Save Tournament */}
          {tournamentStats && (
            <div className="card p-6 border-t-4 border-vv-violet space-y-4">
              <h2 className="text-lg font-bold">Save to Public Site</h2>
              <div>
                <label className="block text-sm font-semibold text-black mb-1">
                  Tournament Name
                </label>
                <input
                  type="text"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="e.g. SD Open Spring 2025"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vv-violet"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saveStatus === "saving" || saveStatus === "saved" || !tournamentName.trim()}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {saveStatus === "saving" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving…
                  </>
                ) : saveStatus === "saved" ? (
                  <>
                    <CheckCircle size={16} />
                    Saved — redirecting…
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Tournament
                  </>
                )}
              </button>
            </div>
          )}

          {/* Game by game */}
          <section>
            <h2 className="section-title text-2xl mb-4">Game by Game</h2>
            <div className="space-y-3">
              {games.map((game) => (
                <div
                  key={game.gameNumber}
                  className="card overflow-hidden border border-gray-200"
                >
                  {/* Header row */}
                  <button
                    onClick={() =>
                      game.status === "done" && toggleGame(game.gameNumber)
                    }
                    disabled={game.status !== "done"}
                    className="w-full flex items-center justify-between px-4 py-3 text-left disabled:cursor-default"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-gray-400 uppercase shrink-0">
                        Game {game.gameNumber}
                      </span>

                      {game.status === "pending" && (
                        <span className="flex items-center gap-1 text-sm text-gray-400">
                          <Clock size={13} /> Queued
                        </span>
                      )}
                      {game.status === "loading" && (
                        <span className="flex items-center gap-1 text-sm text-gray-500">
                          <Loader2 size={13} className="animate-spin" />{" "}
                          Scraping scorecard…
                        </span>
                      )}
                      {game.status === "done" && (
                        <span className="text-sm font-semibold truncate">
                          vs {game.opponent}
                          {game.date && (
                            <span className="text-gray-400 font-normal">
                              {" "}
                              · {game.date}
                            </span>
                          )}
                          {game.competition && (
                            <span className="text-gray-400 font-normal">
                              {" "}
                              · {game.competition}
                            </span>
                          )}
                        </span>
                      )}
                      {game.status === "error" && (
                        <span className="flex items-center gap-1 text-sm text-red-600">
                          <AlertCircle size={13} /> Failed
                        </span>
                      )}
                    </div>

                    {game.status === "done" &&
                      (expandedGames.has(game.gameNumber) ? (
                        <ChevronUp size={16} className="shrink-0 text-gray-400" />
                      ) : (
                        <ChevronDown size={16} className="shrink-0 text-gray-400" />
                      ))}
                  </button>

                  {/* Error detail */}
                  {game.status === "error" && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <p className="text-sm text-red-600">{game.error}</p>
                      <p className="mt-1 text-xs text-gray-400 break-all">
                        {game.url}
                      </p>
                    </div>
                  )}

                  {/* Expanded analysis */}
                  {game.status === "done" &&
                    expandedGames.has(game.gameNumber) &&
                    game.teamReport && (
                      <div className="px-4 pb-6 border-t border-gray-100">
                        {game.narrative && (
                          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                              AI Coaching Analysis
                            </p>
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {game.narrative}
                            </p>
                          </div>
                        )}
                        <MatchAnalysis
                          report={{ teams: [game.teamReport] }}
                          context="tournament"
                        />
                      </div>
                    )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
