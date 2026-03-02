/**
 * Two scatter plots — batting and bowling — rendered inside one card.
 *
 * Each dot is numbered. A legend grid below the chart maps numbers to names.
 * This guarantees no label overlap regardless of how many players cluster
 * at the same performance level.
 *
 * Batting chart:
 *   Opportunity = batting position (pos 1 → 100, pos 11 → 0)
 *   Performance = runs-per-innings + strike-rate
 *
 * Bowling chart:
 *   Opportunity = overs relative to team average (team-avg → 50)
 *   Performance = wickets-per-appearance + economy
 */

import type { TournamentPlayerStats } from "@/lib/analyze";
import { oversToDecimal } from "@/lib/analyze";

// ── Layout ────────────────────────────────────────────────────────────────────
const VB_W = 520;
const VB_H = 420;
const CL   = 52;
const CR   = 500;
const CT   = 36;
const CB   = 370;
const CW   = CR - CL;   // 448
const CH   = CB - CT;   // 334

const toX = (v: number) => CL + (v / 100) * CW;
const toY = (v: number) => CB - (v / 100) * CH;

// 4 equal bands
const q1 = 1 / 4;
const q2 = 2 / 4;
const q3 = 3 / 4;

// ── Scoring ───────────────────────────────────────────────────────────────────

function battingOpportunity(p: TournamentPlayerStats): number {
  if (p.battingPositions.length === 0) return 0;
  const avgPos = p.battingPositions.reduce((a, b) => a + b, 0) / p.battingPositions.length;
  return Math.min(100, Math.max(0, ((11 - avgPos) / 10) * 100));
}

function battingPerformance(p: TournamentPlayerStats): number {
  if (p.battingInnings === 0 || p.totalBallsFaced === 0) return 0;
  const runsPerInn = p.totalRuns / p.battingInnings;
  const sr = (p.totalRuns / p.totalBallsFaced) * 100;
  const raw = Math.min(50, (runsPerInn / 30) * 50) +
              Math.min(25, Math.max(0, ((sr - 70) / 80) * 25));
  return Math.min(100, (raw / 75) * 100);
}

function bowlingOpportunity(p: TournamentPlayerStats, teamAvgOversPerApp: number): number {
  if (p.bowlingAppearances === 0 || teamAvgOversPerApp === 0) return 0;
  const avgPerApp = oversToDecimal(p.totalOvers) / p.bowlingAppearances;
  // Team-average maps to 50 so "got your fair share" sits at the Average/Above-Avg boundary
  return Math.min(100, (avgPerApp / teamAvgOversPerApp) * 50);
}

function bowlingPerformance(p: TournamentPlayerStats): number {
  const realOvers = oversToDecimal(p.totalOvers);
  if (p.bowlingAppearances === 0 || realOvers === 0) return 0;
  const avgWickets = p.totalWickets / p.bowlingAppearances;
  const economy    = p.totalBowlingRuns / realOvers;
  const raw = Math.min(50, (avgWickets / 3) * 50) +
              Math.min(25, Math.max(0, ((8 - economy) / 4) * 25));
  return Math.min(100, (raw / 75) * 100);
}

// ── ScatterPlot ───────────────────────────────────────────────────────────────

interface PlotPoint { name: string; opp: number; perf: number; }

function ScatterPlot({
  title,
  subtitle,
  xLabel,
  points,
  color,
}: {
  title: string;
  subtitle: string;
  xLabel: string;
  points: PlotPoint[];
  color: string;
}) {
  if (points.length === 0) return null;

  // Assign numbers alphabetically so the legend is easy to scan
  const numbered = [...points]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((pt, i) => ({ ...pt, num: i + 1 }));

  const DOT_R = 9; // radius — large enough for two-digit numbers

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-0.5">
        {title}
      </p>
      <p className="text-xs text-gray-400 mb-2">{subtitle}</p>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full"
        aria-label={`${title} opportunity vs performance scatter chart`}
      >
        {/* ── Quadrant backgrounds ─────────────────────────────────────── */}
        <rect x={CL}          y={CB - q1*CH} width={q1*CW}     height={q1*CH} fill="#f9fafb" />
        <rect x={CL}          y={CT}          width={q1*CW}     height={q1*CH} fill="#faf5ff" />
        <rect x={CL + q3*CW}  y={CB - q1*CH} width={(1-q3)*CW} height={q1*CH} fill="#fffbeb" />
        <rect x={CL + q3*CW}  y={CT}          width={(1-q3)*CW} height={q1*CH} fill="#f0fdf4" />

        {/* ── Grid lines ──────────────────────────────────────────────── */}
        {[q1, q2, q3].map((f) => (
          <line key={`v${f}`} x1={CL + f*CW} y1={CT} x2={CL + f*CW} y2={CB}
            stroke="#e5e7eb" strokeWidth={1} strokeDasharray="4 4" />
        ))}
        {[q1, q2, q3].map((f) => (
          <line key={`h${f}`} x1={CL} y1={CB - f*CH} x2={CR} y2={CB - f*CH}
            stroke="#e5e7eb" strokeWidth={1} strokeDasharray="4 4" />
        ))}

        {/* ── Axis borders ─────────────────────────────────────────────── */}
        <line x1={CL} y1={CT} x2={CL} y2={CB} stroke="#d1d5db" strokeWidth={1} />
        <line x1={CL} y1={CB} x2={CR} y2={CB} stroke="#d1d5db" strokeWidth={1} />

        {/* ── X-axis band labels ───────────────────────────────────────── */}
        {(["Low", "Average", "Above Avg", "High"] as const).map((lbl, i) => (
          <text key={lbl} x={CL + ((2*i + 1) / 8) * CW} y={CB + 16}
            textAnchor="middle" fontSize={10} fill="#9ca3af">{lbl}</text>
        ))}
        <text x={CL + CW/2} y={VB_H - 6} textAnchor="middle"
          fontSize={11} fill="#6b7280" fontWeight="600">{xLabel}</text>

        {/* ── Y-axis band labels ───────────────────────────────────────── */}
        {(["Low", "Average", "Above Avg", "High"] as const).map((lbl, i) => (
          <text key={lbl} x={CL - 8} y={CB - ((2*i + 1) / 8) * CH}
            textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#9ca3af">
            {lbl}
          </text>
        ))}
        <text x={14} y={CT + CH/2} textAnchor="middle"
          fontSize={11} fill="#6b7280" fontWeight="600"
          transform={`rotate(-90, 14, ${CT + CH/2})`}>Performance</text>

        {/* ── Quadrant corner labels ───────────────────────────────────── */}
        <text x={CL + 5}         y={CT + 13} fontSize={9} fill="#a78bfa">Under-utilised</text>
        <text x={CL + q3*CW + 5} y={CT + 13} fontSize={9} fill="#16a34a">Delivering</text>
        <text x={CL + 5}         y={CB - 5}  fontSize={9} fill="#9ca3af">Limited exposure</text>
        <text x={CL + q3*CW + 5} y={CB - 5}  fontSize={9} fill="#d97706">Not converting</text>

        {/* ── Numbered dots ────────────────────────────────────────────── */}
        {numbered.map((pt) => {
          const cx = toX(pt.opp);
          const cy = toY(pt.perf);
          return (
            <g key={pt.name}>
              <title>{`${pt.num}. ${pt.name} — Opportunity: ${pt.opp.toFixed(0)}, Performance: ${pt.perf.toFixed(0)}`}</title>
              <circle cx={cx} cy={cy} r={DOT_R}
                fill={color} fillOpacity={0.85} stroke="white" strokeWidth={1.5} />
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                fontSize={pt.num >= 10 ? 7 : 8} fill="white" fontWeight="bold">
                {pt.num}
              </text>
            </g>
          );
        })}
      </svg>

      {/* ── Legend grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 mt-2">
        {numbered.map((pt) => (
          <div key={pt.name} className="flex items-center gap-1.5 text-xs min-w-0">
            <span
              className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: color, fontSize: pt.num >= 10 ? 9 : 10 }}
            >
              {pt.num}
            </span>
            <span className="truncate text-gray-700">{pt.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OpportunityPerformanceChart({
  players,
}: {
  players: TournamentPlayerStats[];
}) {
  const bowlingPlayers = players.filter((p) => p.bowlingAppearances > 0);
  const totalRealOvers = bowlingPlayers.reduce(
    (s, p) => s + oversToDecimal(p.totalOvers), 0
  );
  const totalApps = bowlingPlayers.reduce((s, p) => s + p.bowlingAppearances, 0);
  const teamAvgOversPerApp = totalApps > 0 ? totalRealOvers / totalApps : 3;

  const battingPoints: PlotPoint[] = players
    .filter((p) => p.battingInnings > 0 && p.totalBallsFaced > 0)
    .map((p) => ({
      name: p.name,
      opp:  battingOpportunity(p),
      perf: battingPerformance(p),
    }));

  const bowlingPoints: PlotPoint[] = players
    .filter((p) => p.bowlingAppearances > 0 && oversToDecimal(p.totalOvers) > 0)
    .map((p) => ({
      name: p.name,
      opp:  bowlingOpportunity(p, teamAvgOversPerApp),
      perf: bowlingPerformance(p),
    }));

  if (battingPoints.length === 0 && bowlingPoints.length === 0) return null;

  return (
    <div className="card p-5 space-y-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
          Opportunity vs Performance
        </p>
        <p className="text-xs text-gray-400">
          Each dot is numbered — find the player in the legend below the chart.
          Batting scores position &amp; runs/SR; bowling scores overs load &amp; wickets/economy.
        </p>
      </div>

      <ScatterPlot
        title="Batting"
        subtitle="Opportunity = batting position (top order → higher). Performance = runs per innings + strike rate."
        xLabel="Batting opportunity (position)"
        points={battingPoints}
        color="#7c3aed"
      />

      <ScatterPlot
        title="Bowling"
        subtitle="Opportunity = overs bowled relative to team average. Performance = wickets per appearance + economy."
        xLabel="Bowling opportunity (overs load)"
        points={bowlingPoints}
        color="#16a34a"
      />
    </div>
  );
}
