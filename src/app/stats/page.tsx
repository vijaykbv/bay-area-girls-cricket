"use client";

import { useState, useEffect } from "react";
import type { PlayerStats, BowlingStats } from "@/lib/types";
import { BarChart3 } from "lucide-react";

type Tab = "batting" | "bowling";

export default function StatsPage() {
  const [tab, setTab] = useState<Tab>("batting");
  const [batting, setBatting] = useState<PlayerStats[]>([]);
  const [bowling, setBowling] = useState<BowlingStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        setBatting(data.batting ?? []);
        setBowling(data.bowling ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="section-title text-3xl">Statistics</h1>
      <p className="text-gray-500 mb-6">Batting and bowling averages across all matches.</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(["batting", "bowling"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 transition-colors -mb-px ${
              tab === t
                ? "border-vv-violet text-vv-violet"
                : "border-transparent text-gray-500 hover:text-black"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading statistics...</div>
      ) : tab === "batting" ? (
        <BattingStatsTable data={batting} />
      ) : (
        <BowlingStatsTable data={bowling} />
      )}
    </div>
  );
}

function BattingStatsTable({ data }: { data: PlayerStats[] }) {
  if (data.length === 0)
    return (
      <div className="text-center py-20 text-gray-400">
        <BarChart3 size={48} className="mx-auto mb-3 opacity-30" />
        <p>No batting data yet.</p>
      </div>
    );

  return (
    <div className="overflow-x-auto">
      <table className="scorecard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th className="text-right">M</th>
            <th className="text-right">Inn</th>
            <th className="text-right">Runs</th>
            <th className="text-right">HS</th>
            <th className="text-right">Avg</th>
            <th className="text-right">SR</th>
            <th className="text-right">50s</th>
            <th className="text-right">100s</th>
            <th className="text-right">4s</th>
            <th className="text-right">6s</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p, i) => (
            <tr key={p.player_id}>
              <td className="text-gray-400 text-xs">{i + 1}</td>
              <td className="font-semibold">{p.player_name}</td>
              <td className="text-right">{p.matches}</td>
              <td className="text-right">{p.innings}</td>
              <td className="text-right font-bold text-vv-violet">{p.runs}</td>
              <td className="text-right">{p.highest_score}</td>
              <td className="text-right">{p.average ?? "-"}</td>
              <td className="text-right">{p.strike_rate ?? "-"}</td>
              <td className="text-right">{p.fifties}</td>
              <td className="text-right">{p.hundreds}</td>
              <td className="text-right">{p.fours}</td>
              <td className="text-right">{p.sixes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BowlingStatsTable({ data }: { data: BowlingStats[] }) {
  if (data.length === 0)
    return (
      <div className="text-center py-20 text-gray-400">
        <BarChart3 size={48} className="mx-auto mb-3 opacity-30" />
        <p>No bowling data yet.</p>
      </div>
    );

  return (
    <div className="overflow-x-auto">
      <table className="scorecard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th className="text-right">M</th>
            <th className="text-right">Inn</th>
            <th className="text-right">O</th>
            <th className="text-right">W</th>
            <th className="text-right">Runs</th>
            <th className="text-right">Best</th>
            <th className="text-right">Avg</th>
            <th className="text-right">Econ</th>
            <th className="text-right">SR</th>
            <th className="text-right">5W</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p, i) => (
            <tr key={p.player_id}>
              <td className="text-gray-400 text-xs">{i + 1}</td>
              <td className="font-semibold">{p.player_name}</td>
              <td className="text-right">{p.matches}</td>
              <td className="text-right">{p.innings}</td>
              <td className="text-right">{p.overs}</td>
              <td className="text-right font-bold text-vv-violet">{p.wickets}</td>
              <td className="text-right">{p.runs}</td>
              <td className="text-right">{p.best_bowling}</td>
              <td className="text-right">{p.average ?? "-"}</td>
              <td className="text-right">{p.economy ?? "-"}</td>
              <td className="text-right">{p.strike_rate ?? "-"}</td>
              <td className="text-right">{p.five_wickets}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
