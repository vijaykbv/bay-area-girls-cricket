"use client";

import { useState } from "react";
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

interface PlayerResult {
  name: string;
  batting: BattingStats;
  bowling: BowlingStats;
}

interface ScoutResult {
  teamName: string;
  players: PlayerResult[];
  analysis: string;
}

function isBatter(p: PlayerResult): boolean {
  return p.batting.innings >= 2;
}

function isBowler(p: PlayerResult): boolean {
  return p.bowling.wickets >= 1 || p.bowling.overs >= 2;
}

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

export default function ScoutTeamPage() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<ScoutResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setStatus("loading");
    setErrorMsg("");
    setResult(null);

    try {
      const res = await fetch("/api/scout-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "Analysis failed. Check the URL and try again.");
      } else {
        setResult(data as ScoutResult);
        setStatus("success");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

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
          disabled={status === "loading"}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {status === "loading" ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Analyzing team...
            </>
          ) : (
            <>
              <Search size={16} />
              Analyze Team
            </>
          )}
        </button>

        {status === "loading" && (
          <p className="text-sm text-gray-500 text-center">
            Analyzing team... This takes about 2 minutes
          </p>
        )}

        {status === "error" && (
          <div className="flex items-start gap-2 text-red-700 bg-red-50 rounded-lg p-4">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p className="text-sm">{errorMsg}</p>
          </div>
        )}
      </form>

      {/* Results */}
      {status === "success" && result && (
        <div className="space-y-8">
          <h2 className="section-title text-2xl">{result.teamName}</h2>

          {/* Player Stats Table */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-black mb-4">Player Statistics</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left font-semibold text-gray-700 pb-2 pr-4">Player</th>
                    <th className="text-center font-semibold text-gray-700 pb-2 px-2">Matches</th>
                    <th className="text-center font-semibold text-gray-700 pb-2 px-2 text-blue-700">
                      Bat Runs
                    </th>
                    <th className="text-center font-semibold text-gray-700 pb-2 px-2 text-blue-700">
                      Bat Avg
                    </th>
                    <th className="text-center font-semibold text-gray-700 pb-2 px-2 text-blue-700">
                      Bat SR
                    </th>
                    <th className="text-center font-semibold text-gray-700 pb-2 px-2 text-blue-700">
                      HS
                    </th>
                    <th className="text-center font-semibold text-gray-700 pb-2 px-2 text-amber-700">
                      Wkts
                    </th>
                    <th className="text-center font-semibold text-gray-700 pb-2 px-2 text-amber-700">
                      Econ
                    </th>
                    <th className="text-center font-semibold text-gray-700 pb-2 px-2 text-amber-700">
                      BBF
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.players.map((p, i) => {
                    const hasBat = isBatter(p);
                    const hasBowl = isBowler(p);
                    const batHighlight =
                      hasBat && (p.batting.battingAvg > 20 || p.batting.strikeRate > 100);
                    const bowlHighlight =
                      hasBowl && (p.bowling.wickets > 5 || (p.bowling.economy < 6 && p.bowling.economy > 0));

                    return (
                      <tr
                        key={i}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >
                        <td className="py-2 pr-4 font-medium text-gray-900">{p.name}</td>
                        <td className="py-2 px-2 text-center text-gray-600">
                          {Math.max(p.batting.matches, p.bowling.matches) || "—"}
                        </td>
                        {/* Batting columns */}
                        <td
                          className={`py-2 px-2 text-center ${batHighlight ? "text-blue-700 font-semibold" : "text-gray-600"}`}
                        >
                          {hasBat ? p.batting.runs : "—"}
                        </td>
                        <td
                          className={`py-2 px-2 text-center ${batHighlight ? "text-blue-700 font-semibold" : "text-gray-600"}`}
                        >
                          {hasBat ? fmt(p.batting.battingAvg) : "—"}
                        </td>
                        <td
                          className={`py-2 px-2 text-center ${batHighlight ? "text-blue-700 font-semibold" : "text-gray-600"}`}
                        >
                          {hasBat ? fmt(p.batting.strikeRate) : "—"}
                        </td>
                        <td
                          className={`py-2 px-2 text-center ${batHighlight ? "text-blue-700 font-semibold" : "text-gray-600"}`}
                        >
                          {hasBat ? p.batting.highScore : "—"}
                        </td>
                        {/* Bowling columns */}
                        <td
                          className={`py-2 px-2 text-center ${bowlHighlight ? "text-amber-700 font-semibold" : "text-gray-600"}`}
                        >
                          {hasBowl ? p.bowling.wickets : "—"}
                        </td>
                        <td
                          className={`py-2 px-2 text-center ${bowlHighlight ? "text-amber-700 font-semibold" : "text-gray-600"}`}
                        >
                          {hasBowl ? fmt(p.bowling.economy, 2) : "—"}
                        </td>
                        <td
                          className={`py-2 px-2 text-center ${bowlHighlight ? "text-amber-700 font-semibold" : "text-gray-600"}`}
                        >
                          {hasBowl && p.bowling.bbf ? p.bowling.bbf : "—"}
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

          {/* AI Scouting Report */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-black mb-4">
              AI Scouting Report
            </h3>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
              {result.analysis}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
