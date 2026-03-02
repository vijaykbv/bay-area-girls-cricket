/**
 * Two scatter plots — batting and bowling — rendered inside one card.
 *
 * Batting chart:
 *   Opportunity = batting position (pos 1 → 100, pos 11 → 0)
 *   Performance = runs-per-innings + strike-rate
 *
 * Bowling chart:
 *   Opportunity = overs relative to team average (team-avg overs → 50)
 *   Performance = wickets-per-appearance + economy
 *
 * Separating the charts prevents all-rounders from clustering in the
 * middle and lets each discipline be judged on its own terms.
 */

import type { TournamentPlayerStats } from "@/lib/analyze";
import { oversToDecimal } from "@/lib/analyze";

// ── Layout ────────────────────────────────────────────────────────────────────
const VB_W  = 760;
const VB_H  = 440;
const CL    = 52;           // chart left
const CR    = 430;          // chart right (label column starts here)
const CT    = 36;           // chart top
const CB    = VB_H - 50;   // chart bottom
const CW    = CR - CL;
const CH    = CB - CT;

const LABEL_X    = CR + 22;  // left edge of label text
const LABEL_H    = 14;       // vertical space reserved per label
const LABEL_FONT = 11;

const toX = (v: number) => CL + (v / 100) * CW;
const toY = (v: number) => CB - (v / 100) * CH;

// Band boundaries: 4 equal bands (Low / Average / Above Avg / High)
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

/**
 * Bowling opportunity: team-average overs per appearance maps to 50
 * so a bowler getting their "fair share" sits at the Average/Above-Avg boundary.
 */
function bowlingOpportunity(p: TournamentPlayerStats, teamAvgOversPerApp: number): number {
  if (p.bowlingAppearances === 0 || teamAvgOversPerApp === 0) return 0;
  const avgPerApp = oversToDecimal(p.totalOvers) / p.bowlingAppearances;
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

// ── Label deconfliction ───────────────────────────────────────────────────────

function deconflict(
  items: Array<{ dotY: number }>,
  minGap: number,
  lo: number,
  hi: number,
): number[] {
  let positions = items.map((it) => Math.min(Math.max(it.dotY, lo), hi));
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] - positions[i - 1] < minGap) {
        positions[i] = positions[i - 1] + minGap;
        moved = true;
      }
    }
    for (let i = positions.length - 2; i >= 0; i--) {
      if (positions[i + 1] - positions[i] < minGap) {
        positions[i] = positions[i + 1] - minGap;
        moved = true;
      }
    }
    positions = positions.map((p) => Math.min(Math.max(p, lo), hi));
    if (!moved) break;
  }
  return positions;
}

// ── ScatterPlot ───────────────────────────────────────────────────────────────

interface PlotPoint {
  name: string;
  opp: number;
  perf: number;
}

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

  const withY = points.map((pt) => ({ ...pt, dotY: toY(pt.perf) }));
  const sorted = [...withY].sort((a, b) => a.dotY - b.dotY);
  const labelYs = deconflict(sorted, LABEL_H, CT + LABEL_H / 2, CB - LABEL_H / 2);

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-0.5">
        {title}
      </p>
      <p className="text-xs text-gray-400 mb-2">{subtitle}</p>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full"
        aria-label={`${title} opportunity vs performance chart`}
      >
        {/* ── Quadrant backgrounds ─────────────────────────────────────── */}
        <rect x={CL}          y={CB - q1*CH} width={q1*CW}      height={q1*CH} fill="#f9fafb" />
        <rect x={CL}          y={CT}          width={q1*CW}      height={q1*CH} fill="#faf5ff" />
        <rect x={CL + q3*CW}  y={CB - q1*CH} width={(1-q3)*CW}  height={q1*CH} fill="#fffbeb" />
        <rect x={CL + q3*CW}  y={CT}          width={(1-q3)*CW}  height={q1*CH} fill="#f0fdf4" />

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

        {/* ── Leader lines ─────────────────────────────────────────────── */}
        {sorted.map((pt, i) => {
          const elbowX = CR + 8;
          return (
            <polyline
              key={`line-${pt.name}`}
              points={`${toX(pt.opp)},${pt.dotY} ${elbowX},${pt.dotY} ${elbowX},${labelYs[i]} ${LABEL_X - 4},${labelYs[i]}`}
              fill="none"
              stroke={color}
              strokeWidth={0.8}
              strokeOpacity={0.35}
            />
          );
        })}

        {/* ── Dots ─────────────────────────────────────────────────────── */}
        {sorted.map((pt) => (
          <g key={`dot-${pt.name}`}>
            <title>{`${pt.name} — Opportunity: ${pt.opp.toFixed(0)}, Performance: ${pt.perf.toFixed(0)}`}</title>
            <circle cx={toX(pt.opp)} cy={pt.dotY} r={5.5}
              fill={color} fillOpacity={0.85} stroke="white" strokeWidth={1.5} />
          </g>
        ))}

        {/* ── Labels ───────────────────────────────────────────────────── */}
        {sorted.map((pt, i) => (
          <text
            key={`label-${pt.name}`}
            x={LABEL_X}
            y={labelYs[i] + LABEL_FONT * 0.35}
            fontSize={LABEL_FONT}
            fill={color}
            fontWeight="500"
            dominantBaseline="middle"
          >
            {pt.name}
          </text>
        ))}
      </svg>
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
    <div className="card p-5 space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
          Opportunity vs Performance
        </p>
        <p className="text-xs text-gray-400">
          Batting: position-based opportunity, judged on runs &amp; strike rate.
          Bowling: overs relative to team average, judged on wickets &amp; economy.
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
