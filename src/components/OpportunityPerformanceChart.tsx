/**
 * Scatter plot: player opportunity (x-axis) vs performance (y-axis).
 *
 * Opportunity = how much game time a player received:
 *   - Batting component (0–60): top of the order gets more; tail/no-bat gets less
 *   - Bowling component (0–40): relative to the team average overs per appearance
 *
 * Performance = how well they used that time:
 *   - Top-order batters: runs-per-innings + strike-rate
 *   - Bowlers: wickets-per-appearance + economy
 *   - Players who did both: average of the two scores
 *
 * Labels are rendered in a fixed column to the right of the chart area with
 * leader lines back to each dot, then deconflicted vertically so nothing overlaps.
 */

import type { TournamentPlayerStats } from "@/lib/analyze";
import { oversToDecimal } from "@/lib/analyze";

// ── Layout ────────────────────────────────────────────────────────────────────
const VB_W  = 760;
const VB_H  = 460;
const CL    = 52;    // chart left
const CR    = 430;   // chart right  (label column starts here)
const CT    = 36;    // chart top
const CB    = VB_H - 52;  // chart bottom
const CW    = CR - CL;
const CH    = CB - CT;

const LABEL_X    = CR + 22;   // left edge of label text
const LABEL_H    = 14;        // vertical space reserved per label
const LABEL_FONT = 11;

const toX = (v: number) => CL + (v / 100) * CW;
const toY = (v: number) => CB - (v / 100) * CH;

// ── Scoring ───────────────────────────────────────────────────────────────────

function opportunityScore(
  p: TournamentPlayerStats,
  teamAvgOversPerApp: number,
): number {
  let batComp = 0;
  if (p.battingPositions.length > 0) {
    const avgPos =
      p.battingPositions.reduce((a, b) => a + b, 0) / p.battingPositions.length;
    batComp = Math.max(0, ((11 - avgPos) / 10) * 60);
  }
  let bowlComp = 0;
  if (p.bowlingAppearances > 0 && teamAvgOversPerApp > 0) {
    const avgPerApp = oversToDecimal(p.totalOvers) / p.bowlingAppearances;
    bowlComp = Math.min(40, (avgPerApp / teamAvgOversPerApp) * 40);
  }
  return Math.min(100, batComp + bowlComp);
}

function performanceScore(p: TournamentPlayerStats): number {
  const hasBatted = p.battingInnings > 0 && p.totalBallsFaced > 0;
  const realOvers = oversToDecimal(p.totalOvers);
  const hasBowled = p.bowlingAppearances > 0 && realOvers > 0;
  if (!hasBatted && !hasBowled) return 0;

  let batPerf = 0;
  if (hasBatted) {
    const runsPerInn = p.totalRuns / p.battingInnings;
    const sr = (p.totalRuns / p.totalBallsFaced) * 100;
    batPerf = Math.min(50, (runsPerInn / 30) * 50) +
              Math.min(25, Math.max(0, ((sr - 70) / 80) * 25));
  }
  let bowlPerf = 0;
  if (hasBowled) {
    const avgWickets = p.totalWickets / p.bowlingAppearances;
    const economy    = p.totalBowlingRuns / realOvers;
    bowlPerf = Math.min(50, (avgWickets / 3) * 50) +
               Math.min(25, Math.max(0, ((8 - economy) / 4) * 25));
  }
  const raw =
    hasBatted && hasBowled ? (batPerf + bowlPerf) / 2 :
    hasBatted              ? batPerf : bowlPerf;
  return Math.min(100, (raw / 75) * 100);
}

// ── Label deconfliction ───────────────────────────────────────────────────────
// Spreads label Y positions apart so no two are closer than LABEL_H px.
// Works on a sorted-by-Y copy and propagates pushes outward.

function deconflict(
  items: Array<{ dotY: number }>,
  minGap: number,
  lo: number,
  hi: number,
): number[] {
  // Start each label at its dot's Y, clamped to chart bounds
  let positions = items.map((it) => Math.min(Math.max(it.dotY, lo), hi));

  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    // Forward pass: push down
    for (let i = 1; i < positions.length; i++) {
      const gap = positions[i] - positions[i - 1];
      if (gap < minGap) {
        positions[i] = positions[i - 1] + minGap;
        moved = true;
      }
    }
    // Backward pass: push up
    for (let i = positions.length - 2; i >= 0; i--) {
      const gap = positions[i + 1] - positions[i];
      if (gap < minGap) {
        positions[i] = positions[i + 1] - minGap;
        moved = true;
      }
    }
    // Clamp to bounds
    positions = positions.map((p) => Math.min(Math.max(p, lo), hi));
    if (!moved) break;
  }
  return positions;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OpportunityPerformanceChart({
  players,
}: {
  players: TournamentPlayerStats[];
}) {
  const bowlers = players.filter((p) => p.bowlingAppearances > 0);
  const totalRealOvers = bowlers.reduce((s, p) => s + oversToDecimal(p.totalOvers), 0);
  const totalApps = bowlers.reduce((s, p) => s + p.bowlingAppearances, 0);
  const teamAvgOversPerApp = totalApps > 0 ? totalRealOvers / totalApps : 3;

  const points = players
    .filter((p) => p.gamesAppeared > 0)
    .map((p) => {
      const avgPos =
        p.battingPositions.length > 0
          ? p.battingPositions.reduce((a, b) => a + b, 0) / p.battingPositions.length
          : 99;
      const role =
        p.battingPositions.length > 0 && p.bowlingAppearances > 0 ? "both" :
        avgPos <= 4 ? "batter" : "bowler";
      return {
        name: p.name,
        role,
        opp:  opportunityScore(p, teamAvgOversPerApp),
        perf: performanceScore(p),
      };
    });

  if (points.length === 0) return null;

  const DOT_COLOR: Record<string, string> = {
    batter: "#7c3aed",
    bowler: "#16a34a",
    both:   "#2563eb",
  };

  // Sort points by dot Y (top → bottom) for deconfliction ordering
  const sorted = [...points]
    .map((pt, i) => ({ ...pt, origIdx: i, dotY: toY(pt.perf) }))
    .sort((a, b) => a.dotY - b.dotY);

  // Deconflict label Y positions
  const labelYs = deconflict(sorted, LABEL_H, CT + LABEL_H / 2, CB - LABEL_H / 2);

  // Quadrant boundaries
  const q1 = 1 / 3;
  const q2 = 2 / 3;

  return (
    <div className="card p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
        Opportunity vs Performance
      </p>
      <p className="text-xs text-gray-400 mb-3">
        Opportunity combines batting position and bowling load. Performance scores
        runs &amp; strike rate for batters; wickets &amp; economy for bowlers.
      </p>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full"
        aria-label="Opportunity vs performance scatter chart"
      >
        {/* ── Quadrant backgrounds ─────────────────────────────────────── */}
        <rect x={CL}           y={CB - q1*CH} width={q1*CW}      height={q1*CH} fill="#f9fafb" />
        <rect x={CL}           y={CT}          width={q1*CW}      height={q1*CH} fill="#faf5ff" />
        <rect x={CL + q2*CW}   y={CB - q1*CH} width={(1-q2)*CW} height={q1*CH} fill="#fffbeb" />
        <rect x={CL + q2*CW}   y={CT}          width={(1-q2)*CW} height={q1*CH} fill="#f0fdf4" />

        {/* ── Grid lines ──────────────────────────────────────────────── */}
        {[q1, q2].map((f) => (
          <line key={`v${f}`} x1={CL + f*CW} y1={CT} x2={CL + f*CW} y2={CB}
            stroke="#e5e7eb" strokeWidth={1} strokeDasharray="4 4" />
        ))}
        {[q1, q2].map((f) => (
          <line key={`h${f}`} x1={CL} y1={CB - f*CH} x2={CR} y2={CB - f*CH}
            stroke="#e5e7eb" strokeWidth={1} strokeDasharray="4 4" />
        ))}

        {/* ── Axis borders ─────────────────────────────────────────────── */}
        <line x1={CL} y1={CT} x2={CL} y2={CB} stroke="#d1d5db" strokeWidth={1} />
        <line x1={CL} y1={CB} x2={CR} y2={CB} stroke="#d1d5db" strokeWidth={1} />

        {/* ── X-axis band labels ───────────────────────────────────────── */}
        {(["Low", "Average", "High"] as const).map((lbl, i) => (
          <text key={lbl} x={CL + ((2*i + 1) / 6) * CW} y={CB + 16}
            textAnchor="middle" fontSize={11} fill="#9ca3af">{lbl}</text>
        ))}
        <text x={CL + CW/2} y={VB_H - 6} textAnchor="middle"
          fontSize={11} fill="#6b7280" fontWeight="600">Opportunity</text>

        {/* ── Y-axis band labels ───────────────────────────────────────── */}
        {(["Low", "Average", "High"] as const).map((lbl, i) => (
          <text key={lbl} x={CL - 8} y={CB - ((2*i + 1) / 6) * CH}
            textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#9ca3af">
            {lbl}
          </text>
        ))}
        <text x={14} y={CT + CH/2} textAnchor="middle"
          fontSize={11} fill="#6b7280" fontWeight="600"
          transform={`rotate(-90, 14, ${CT + CH/2})`}>Performance</text>

        {/* ── Quadrant corner labels ───────────────────────────────────── */}
        <text x={CL + 5}         y={CT + 13}  fontSize={9} fill="#a78bfa">Under-utilised</text>
        <text x={CL + q2*CW + 5} y={CT + 13}  fontSize={9} fill="#16a34a">Delivering</text>
        <text x={CL + 5}         y={CB - 5}   fontSize={9} fill="#9ca3af">Limited exposure</text>
        <text x={CL + q2*CW + 5} y={CB - 5}   fontSize={9} fill="#d97706">Not converting</text>

        {/* ── Leader lines ─────────────────────────────────────────────── */}
        {sorted.map((pt, i) => {
          const cx = toX(pt.opp);
          const cy = pt.dotY;
          const ly = labelYs[i];
          const color = DOT_COLOR[pt.role];

          // Elbow: horizontal from dot to CR+8, then vertical to label Y
          const elbowX = CR + 8;
          return (
            <polyline
              key={`line-${pt.name}`}
              points={`${cx},${cy} ${elbowX},${cy} ${elbowX},${ly} ${LABEL_X - 4},${ly}`}
              fill="none"
              stroke={color}
              strokeWidth={0.8}
              strokeOpacity={0.35}
            />
          );
        })}

        {/* ── Dots ─────────────────────────────────────────────────────── */}
        {sorted.map((pt) => {
          const cx = toX(pt.opp);
          const cy = pt.dotY;
          const color = DOT_COLOR[pt.role];
          return (
            <g key={`dot-${pt.name}`}>
              <title>{`${pt.name} — Opportunity: ${pt.opp.toFixed(0)}, Performance: ${pt.perf.toFixed(0)}`}</title>
              <circle cx={cx} cy={cy} r={5.5}
                fill={color} fillOpacity={0.85} stroke="white" strokeWidth={1.5} />
            </g>
          );
        })}

        {/* ── Labels (in deconflicted column) ──────────────────────────── */}
        {sorted.map((pt, i) => {
          const color = DOT_COLOR[pt.role];
          const ly = labelYs[i];
          return (
            <text
              key={`label-${pt.name}`}
              x={LABEL_X}
              y={ly + LABEL_FONT * 0.35}
              fontSize={LABEL_FONT}
              fill={color}
              fontWeight="500"
              dominantBaseline="middle"
            >
              {pt.name}
            </text>
          );
        })}
      </svg>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-700 inline-block" />
          Top-order batter
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-700 inline-block" />
          Bowler
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-700 inline-block" />
          Both roles
        </span>
      </div>
    </div>
  );
}
