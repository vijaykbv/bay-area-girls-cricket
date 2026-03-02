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
 */

import type { TournamentPlayerStats } from "@/lib/analyze";
import { oversToDecimal } from "@/lib/analyze";

// ── Layout ────────────────────────────────────────────────────────────────────
const VB_W = 560;
const VB_H = 420;
const CL   = 55;              // chart left
const CR   = VB_W - 30;       // chart right
const CT   = 36;              // chart top
const CB   = VB_H - 52;       // chart bottom
const CW   = CR - CL;         // chart width
const CH   = CB - CT;         // chart height

const toX = (v: number) => CL + (v / 100) * CW;
const toY = (v: number) => CB - (v / 100) * CH;  // 0 = bottom, 100 = top

// ── Scoring ───────────────────────────────────────────────────────────────────

function opportunityScore(
  p: TournamentPlayerStats,
  teamAvgOversPerApp: number
): number {
  // Batting component (0–60): position 1 → 60, position 11 → ~6, no bat → 0
  let batComp = 0;
  if (p.battingPositions.length > 0) {
    const avgPos =
      p.battingPositions.reduce((a, b) => a + b, 0) / p.battingPositions.length;
    batComp = Math.max(0, ((11 - avgPos) / 10) * 60);
  }

  // Bowling component (0–40): overs per appearance vs team average
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
    // Runs: 30+ is solid → 50 pts max. SR: 70→0 to 150→25 pts.
    const runsScore = Math.min(50, (runsPerInn / 30) * 50);
    const srScore   = Math.min(25, Math.max(0, ((sr - 70) / 80) * 25));
    batPerf = runsScore + srScore; // 0–75
  }

  let bowlPerf = 0;
  if (hasBowled) {
    const avgWickets = p.totalWickets / p.bowlingAppearances;
    const economy    = p.totalBowlingRuns / realOvers;
    // Wickets: 3/game → 50 pts max. Economy: ≤4 → 25 pts, ≥8 → 0 pts.
    const wktScore  = Math.min(50, (avgWickets / 3) * 50);
    const econScore = Math.min(25, Math.max(0, ((8 - economy) / 4) * 25));
    bowlPerf = wktScore + econScore; // 0–75
  }

  const raw =
    hasBatted && hasBowled
      ? (batPerf + bowlPerf) / 2
      : hasBatted
      ? batPerf
      : bowlPerf;

  return Math.min(100, (raw / 75) * 100);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OpportunityPerformanceChart({
  players,
}: {
  players: TournamentPlayerStats[];
}) {
  // Team average overs per bowling appearance (used to normalise bowling load)
  const bowlers = players.filter((p) => p.bowlingAppearances > 0);
  const totalRealOvers = bowlers.reduce(
    (s, p) => s + oversToDecimal(p.totalOvers),
    0
  );
  const totalApps = bowlers.reduce((s, p) => s + p.bowlingAppearances, 0);
  const teamAvgOversPerApp = totalApps > 0 ? totalRealOvers / totalApps : 3;

  const points = players
    .filter((p) => p.gamesAppeared > 0)
    .map((p) => {
      const avgPos =
        p.battingPositions.length > 0
          ? p.battingPositions.reduce((a, b) => a + b, 0) /
            p.battingPositions.length
          : 99;
      const role =
        p.battingPositions.length > 0 && p.bowlingAppearances > 0
          ? "both"
          : avgPos <= 4
          ? "batter"
          : "bowler";

      // Abbreviated label: first name + last initial
      const parts = p.name.trim().split(/\s+/);
      const label =
        parts.length > 1
          ? `${parts[0]} ${parts[parts.length - 1][0]}.`
          : parts[0];

      return {
        name: p.name,
        label,
        role,
        opp:  opportunityScore(p, teamAvgOversPerApp),
        perf: performanceScore(p),
      };
    });

  if (points.length === 0) return null;

  // Quadrant boundaries (thirds of each axis)
  const q1 = 1 / 3;
  const q2 = 2 / 3;

  const DOT_COLOR: Record<string, string> = {
    batter: "#7c3aed",
    bowler: "#16a34a",
    both:   "#2563eb",
  };

  return (
    <div className="card p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
        Opportunity vs Performance
      </p>
      <p className="text-xs text-gray-400 mb-3">
        Opportunity combines batting position and bowling load. Performance scores runs &amp; strike rate for batters; wickets &amp; economy for bowlers.
      </p>

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full"
        aria-label="Opportunity vs performance scatter chart"
      >
        {/* ── Quadrant backgrounds ─────────────────────────────────────── */}
        {/* Low opp + low perf */}
        <rect x={CL}              y={CB - q1 * CH} width={q1 * CW} height={q1 * CH} fill="#f9fafb" />
        {/* Low opp + high perf (under-utilised) */}
        <rect x={CL}              y={CT}            width={q1 * CW} height={q1 * CH} fill="#faf5ff" />
        {/* High opp + low perf (not converting) */}
        <rect x={CL + q2 * CW}    y={CB - q1 * CH} width={(1 - q2) * CW} height={q1 * CH} fill="#fffbeb" />
        {/* High opp + high perf (delivering) */}
        <rect x={CL + q2 * CW}    y={CT}            width={(1 - q2) * CW} height={q1 * CH} fill="#f0fdf4" />

        {/* ── Grid lines (dashed, at 1/3 and 2/3) ────────────────────── */}
        {[q1, q2].map((f) => (
          <line key={`v${f}`} x1={CL + f * CW} y1={CT} x2={CL + f * CW} y2={CB}
            stroke="#e5e7eb" strokeWidth={1} strokeDasharray="4 4" />
        ))}
        {[q1, q2].map((f) => (
          <line key={`h${f}`} x1={CL} y1={CB - f * CH} x2={CR} y2={CB - f * CH}
            stroke="#e5e7eb" strokeWidth={1} strokeDasharray="4 4" />
        ))}

        {/* ── Axis borders ─────────────────────────────────────────────── */}
        <line x1={CL} y1={CT} x2={CL} y2={CB} stroke="#d1d5db" strokeWidth={1} />
        <line x1={CL} y1={CB} x2={CR} y2={CB} stroke="#d1d5db" strokeWidth={1} />

        {/* ── X-axis band labels (Low / Average / High) ───────────────── */}
        {(["Low", "Average", "High"] as const).map((lbl, i) => (
          <text key={lbl} x={CL + ((2 * i + 1) / 6) * CW} y={CB + 16}
            textAnchor="middle" fontSize={11} fill="#9ca3af">
            {lbl}
          </text>
        ))}
        <text x={CL + CW / 2} y={VB_H - 6} textAnchor="middle"
          fontSize={11} fill="#6b7280" fontWeight="600">
          Opportunity
        </text>

        {/* ── Y-axis band labels (Low / Average / High) ───────────────── */}
        {(["Low", "Average", "High"] as const).map((lbl, i) => (
          <text key={lbl} x={CL - 8} y={CB - ((2 * i + 1) / 6) * CH}
            textAnchor="end" dominantBaseline="middle" fontSize={11} fill="#9ca3af">
            {lbl}
          </text>
        ))}
        <text x={14} y={CT + CH / 2} textAnchor="middle"
          fontSize={11} fill="#6b7280" fontWeight="600"
          transform={`rotate(-90, 14, ${CT + CH / 2})`}>
          Performance
        </text>

        {/* ── Quadrant corner labels ───────────────────────────────────── */}
        <text x={CL + 5}           y={CT + 13}  fontSize={9} fill="#a78bfa">Under-utilised</text>
        <text x={CL + q2 * CW + 5} y={CT + 13}  fontSize={9} fill="#16a34a">Delivering</text>
        <text x={CL + 5}           y={CB - 5}   fontSize={9} fill="#9ca3af">Limited exposure</text>
        <text x={CL + q2 * CW + 5} y={CB - 5}   fontSize={9} fill="#d97706">Not converting</text>

        {/* ── Player dots + labels ─────────────────────────────────────── */}
        {points.map((pt) => {
          const cx = toX(pt.opp);
          const cy = toY(pt.perf);
          const fill = DOT_COLOR[pt.role];
          return (
            <g key={pt.name}>
              <title>{`${pt.name} — Opportunity: ${pt.opp.toFixed(0)}, Performance: ${pt.perf.toFixed(0)}`}</title>
              <circle cx={cx} cy={cy} r={6}
                fill={fill} fillOpacity={0.85} stroke="white" strokeWidth={1.5} />
              <text x={cx + 10} y={cy + 4} fontSize={10} fill="#374151">
                {pt.label}
              </text>
            </g>
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
