"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Loader2, AlertCircle } from "lucide-react";

interface BattingStats {
  matches: number;
  innings: number;
  runs: number;
  battingAvg: number;
  strikeRate: number;
  highScore: number;
  fifties: number;
  twentyFives: number;
}

interface BowlingStats {
  matches: number;
  wickets: number;
  economy: number;
  bowlingAvg: number;
  bbf: string;
  overs: number;
}

interface PlayerRow {
  id: string;
  name: string;
  batting: BattingStats | null;
  bowling: BowlingStats | null;
  status: "pending" | "loading" | "done" | "error";
}

function isBatter(batting: BattingStats | null): boolean {
  return !!batting && batting.innings >= 2;
}

function isBowler(bowling: BowlingStats | null): boolean {
  return !!bowling && (bowling.wickets >= 1 || bowling.overs >= 2);
}

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

const EMPTY_BATTING: BattingStats = {
  matches: 0, innings: 0, runs: 0,
  battingAvg: 0, strikeRate: 0, highScore: 0,
  fifties: 0, twentyFives: 0,
};

const EMPTY_BOWLING: BowlingStats = {
  matches: 0, wickets: 0, economy: 0,
  bowlingAvg: 0, bbf: "", overs: 0,
};

export default function ScoutTeamPage() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"idle" | "roster" | "players" | "analysis" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [teamName, setTeamName] = useState("");
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [analysis, setAnalysis] = useState("");
  const abortRef = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    abortRef.current = false;
    setPhase("roster");
    setErrorMsg("");
    setTeamName("");
    setPlayers([]);
    setCurrentPlayerIdx(0);
    setAnalysis("");

    // Step 1: fetch roster
    let rosterData: { teamName: string; players: { id: string; name: string }[]; clubId: string; baseUrl: string };
    try {
      const res = await fetch("/api/scout-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase("error");
        setErrorMsg(data.error ?? "Failed to fetch team roster.");
        return;
      }
      rosterData = data;
    } catch (err: unknown) {
      setPhase("error");
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Network error fetching roster: ${msg}`);
      return;
    }

    setTeamName(rosterData.teamName);
    const initialRows: PlayerRow[] = rosterData.players.map((p) => ({
      id: p.id,
      name: p.name,
      batting: null,
      bowling: null,
      status: "pending",
    }));
    setPlayers(initialRows);
    setPhase("players");

    // Step 2: fetch players in batches of 4 in parallel (paid ScrapingAnt plan)
    const BATCH_SIZE = 4;
    const { clubId, baseUrl } = rosterData;
    const filledRows = [...initialRows];

    for (let start = 0; start < filledRows.length; start += BATCH_SIZE) {
      if (abortRef.current) break;

      const end = Math.min(start + BATCH_SIZE, filledRows.length);
      for (let i = start; i < end; i++) {
        filledRows[i] = { ...filledRows[i], status: "loading" };
      }
      setCurrentPlayerIdx(start);
      setPlayers([...filledRows]);

      const results = await Promise.allSettled(
        filledRows.slice(start, end).map((p) =>
          fetch("/api/scout-team/player", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId: p.id, clubId, baseUrl }),
          }).then((r) => r.json())
        )
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const idx = start + i;
        if (result.status === "fulfilled" && !result.value.error) {
          filledRows[idx] = {
            ...filledRows[idx],
            batting: result.value.batting ?? EMPTY_BATTING,
            bowling: result.value.bowling ?? EMPTY_BOWLING,
            status: "done",
          };
        } else {
          filledRows[idx] = { ...filledRows[idx], batting: EMPTY_BATTING, bowling: EMPTY_BOWLING, status: "error" };
        }
      }

      setPlayers([...filledRows]);
    }

    if (abortRef.current) return;

    // Step 3: generate AI analysis
    setPhase("analysis");
    const playerSummaries = filledRows
      .map((p) => {
        const bat = p.batting;
        const bowl = p.bowling;
        const parts: string[] = [`${p.name}:`];
        if (bat && bat.innings >= 2) {
          parts.push(`batting — ${bat.innings} innings, ${bat.runs} runs, avg ${fmt(bat.battingAvg)}, SR ${fmt(bat.strikeRate)}, HS ${bat.highScore}`);
        }
        if (bowl && (bowl.wickets >= 1 || bowl.overs >= 2)) {
          parts.push(`bowling — ${fmt(bowl.overs)} overs, ${bowl.wickets} wkts, econ ${fmt(bowl.economy, 2)}${bowl.bbf ? ", BBF " + bowl.bbf : ""}`);
        }
        return parts.join(" | ");
      })
      .join("\n");

    try {
      const res = await fetch("/api/scout-team/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName: rosterData.teamName, playerSummaries }),
      });
      const data = await res.json();
      if (res.ok) {
        setAnalysis(data.analysis ?? "");
      }
    } catch {
      // analysis is optional — don't fail the whole page
    }

    setPhase("done");
  }

  const isLoading = phase === "roster" || phase === "players" || phase === "analysis";
  const showTable = phase === "players" || phase === "analysis" || phase === "done";

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-vv-violet mb-2"
          >
            <ArrowLeft size={14} />
            Back to Admin
          </Link>
          <h1 className="section-title text-3xl">Scout Opponent Team</h1>
          <p className="text-gray-500">
            Paste a CricClubs team page URL to generate a scouting report
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card p-6 space-y-5 border-t-4 border-vv-violet mb-8">
        <div>
          <label className="block text-sm font-semibold text-black mb-1">
            CricClubs Team URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://cricclubs.com/USACricketJunior/viewTeam.do?teamId=123&clubId=456"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vv-violet"
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            Example: https://cricclubs.com/LEAGUE/viewTeam.do?teamId=123&amp;clubId=456
          </p>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {phase === "roster" && "Fetching team roster..."}
              {phase === "players" && `Loading players ${currentPlayerIdx + 1}–${Math.min(currentPlayerIdx + 4, players.length)} of ${players.length}...`}
              {phase === "analysis" && "Generating scouting report..."}
            </>
          ) : (
            <>
              <Search size={16} />
              Analyze Team
            </>
          )}
        </button>

        {phase === "error" && (
          <div className="flex items-start gap-2 text-red-700 bg-red-50 rounded-lg p-4">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p className="text-sm">{errorMsg}</p>
          </div>
        )}
      </form>

      {/* Progress bar */}
      {phase === "players" && players.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Loading player profiles...</span>
            <span>{players.filter((p) => p.status === "done" || p.status === "error").length} / {players.length}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-vv-violet h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(players.filter((p) => p.status === "done" || p.status === "error").length / players.length) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Results table — shows progressively as players load */}
      {showTable && players.length > 0 && (
        <div className="space-y-8">
          <h2 className="section-title text-2xl">{teamName}</h2>

          <div className="card p-6">
            <h3 className="text-lg font-semibold text-black mb-4">Player Statistics</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left font-semibold text-gray-700 pb-2 pr-4">Player</th>
                    <th className="text-center font-semibold text-gray-700 pb-2 px-2">M</th>
                    <th className="text-center font-semibold text-gray-700 pb-2 px-2 text-blue-700">Runs</th>
                    <th className="text-center font-semibold text-gray-700 pb-2 px-2 text-blue-700">Avg</th>
                    <th className="text-center font-semibold text-gray-700 pb-2 px-2 text-blue-700">SR</th>
                    <th className="text-center font-semibold text-gray-700 pb-2 px-2 text-blue-700">HS</th>
                    <th className="text-center font-semibold text-gray-700 pb-2 px-2 text-amber-700">Wkts</th>
                    <th className="text-center font-semibold text-gray-700 pb-2 px-2 text-amber-700">Econ</th>
                    <th className="text-center font-semibold text-gray-700 pb-2 px-2 text-amber-700">BBF</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => {
                    const hasBat = isBatter(p.batting);
                    const hasBowl = isBowler(p.bowling);
                    const batHighlight =
                      hasBat && p.batting && (p.batting.battingAvg > 20 || p.batting.strikeRate > 100);
                    const bowlHighlight =
                      hasBowl && p.bowling && (p.bowling.wickets > 5 || (p.bowling.economy < 6 && p.bowling.economy > 0));

                    return (
                      <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="py-2 pr-4 font-medium text-gray-900">
                          <span className="flex items-center gap-2">
                            {p.name}
                            {p.status === "loading" && (
                              <Loader2 size={12} className="animate-spin text-gray-400" />
                            )}
                            {p.status === "error" && (
                              <span title="Failed to load" className="text-red-400 text-xs">!</span>
                            )}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center text-gray-600">
                          {p.status === "pending" || p.status === "loading" ? (
                            <span className="text-gray-300">—</span>
                          ) : (
                            Math.max(p.batting?.matches ?? 0, p.bowling?.matches ?? 0) || "—"
                          )}
                        </td>
                        {/* Batting */}
                        <td className={`py-2 px-2 text-center ${batHighlight ? "text-blue-700 font-semibold" : "text-gray-600"}`}>
                          {p.status === "pending" || p.status === "loading" ? <span className="text-gray-300">—</span> : hasBat ? p.batting!.runs : "—"}
                        </td>
                        <td className={`py-2 px-2 text-center ${batHighlight ? "text-blue-700 font-semibold" : "text-gray-600"}`}>
                          {p.status === "pending" || p.status === "loading" ? <span className="text-gray-300">—</span> : hasBat ? fmt(p.batting!.battingAvg) : "—"}
                        </td>
                        <td className={`py-2 px-2 text-center ${batHighlight ? "text-blue-700 font-semibold" : "text-gray-600"}`}>
                          {p.status === "pending" || p.status === "loading" ? <span className="text-gray-300">—</span> : hasBat ? fmt(p.batting!.strikeRate) : "—"}
                        </td>
                        <td className={`py-2 px-2 text-center ${batHighlight ? "text-blue-700 font-semibold" : "text-gray-600"}`}>
                          {p.status === "pending" || p.status === "loading" ? <span className="text-gray-300">—</span> : hasBat ? p.batting!.highScore : "—"}
                        </td>
                        {/* Bowling */}
                        <td className={`py-2 px-2 text-center ${bowlHighlight ? "text-amber-700 font-semibold" : "text-gray-600"}`}>
                          {p.status === "pending" || p.status === "loading" ? <span className="text-gray-300">—</span> : hasBowl ? p.bowling!.wickets : "—"}
                        </td>
                        <td className={`py-2 px-2 text-center ${bowlHighlight ? "text-amber-700 font-semibold" : "text-gray-600"}`}>
                          {p.status === "pending" || p.status === "loading" ? <span className="text-gray-300">—</span> : hasBowl ? fmt(p.bowling!.economy, 2) : "—"}
                        </td>
                        <td className={`py-2 px-2 text-center ${bowlHighlight ? "text-amber-700 font-semibold" : "text-gray-600"}`}>
                          {p.status === "pending" || p.status === "loading" ? <span className="text-gray-300">—</span> : hasBowl && p.bowling!.bbf ? p.bowling!.bbf : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              <span className="text-blue-700 font-semibold">Blue</span>: batting avg &gt; 20 or SR &gt; 100 &nbsp;|&nbsp;
              <span className="text-amber-700 font-semibold">Amber</span>: wickets &gt; 5 or economy &lt; 6
            </p>
          </div>

          {/* AI Scouting Report — shows after all players loaded */}
          {(phase === "analysis" || phase === "done") && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-black mb-4">AI Scouting Report</h3>
              {phase === "analysis" && !analysis ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 size={14} className="animate-spin" />
                  Generating report...
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {analysis || "No analysis available."}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
