/**
 * Horizontal dot-plot of batting strike rates with team median as reference.
 * Pure SVG — renders server-side, no JS required.
 */

// ── Layout constants ──────────────────────────────────────────────────────────
const VB_W   = 420;   // viewBox width
const NAME_X = 105;   // right edge of name label
const CL     = 112;   // chart left
const CR     = 368;   // chart right
const CW     = CR - CL; // chart draw width
const ROW_H  = 26;
const TOP_P  = 6;
const BOT_P  = 30;    // space for axis labels

// ── Colour helpers ────────────────────────────────────────────────────────────
function dotFill(sr: number, median: number): string {
  if (sr > median * 1.30) return "#16a34a";   // well above → green
  if (sr > median * 1.0)  return "#8A5CB8";   // above → vv-dark
  if (sr > median * 0.75) return "#9ca3af";   // near → gray
  return "#d97706";                            // well below → amber
}

function trackFill(sr: number, median: number): string {
  if (sr > median * 1.30) return "#dcfce7";
  if (sr > median * 1.0)  return "#f3eefa";
  if (sr > median * 0.75) return "#f9fafb";
  return "#fffbeb";
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ChartBatter {
  name: string;
  position: number;
  strikeRate: number;
  runs: number;
  balls: number;
  notOut: boolean;
  isTopOrder: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function StrikeRateChart({
  batters,
  medianSR,
}: {
  batters: ChartBatter[];
  medianSR: number;
}) {
  const eligible = batters.filter((b) => b.balls >= 6);
  if (eligible.length === 0 || medianSR === 0) return null;

  const maxSR = Math.max(...eligible.map((b) => b.strikeRate), medianSR * 1.6, 130);
  const toX   = (sr: number) => CL + Math.min(1, sr / maxSR) * CW;
  const medX  = toX(medianSR);

  const svgH  = TOP_P + eligible.length * ROW_H + BOT_P;
  const ticks = [0, 50, 100, 150].filter((v) => v <= maxSR + 10);

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
        Strike Rate vs Team Median
      </p>
      <svg
        viewBox={`0 0 ${VB_W} ${svgH}`}
        className="w-full overflow-visible"
        aria-label="Strike rate distribution chart"
      >
        {/* ── Tick grid lines ────────────────────────────────────────── */}
        {ticks.map((v) => {
          const x = toX(v);
          return (
            <g key={v}>
              <line
                x1={x} y1={TOP_P}
                x2={x} y2={svgH - BOT_P}
                stroke="#f3f4f6" strokeWidth="1"
              />
              <text
                x={x} y={svgH - BOT_P + 11}
                textAnchor="middle" fontSize="8" fill="#d1d5db"
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* ── Median reference line ───────────────────────────────────── */}
        <line
          x1={medX} y1={TOP_P - 2}
          x2={medX} y2={svgH - BOT_P}
          stroke="#B896D4" strokeWidth="1.5" strokeDasharray="4 3"
        />
        {/* Median label below axis */}
        <text
          x={medX} y={svgH - BOT_P + 12}
          textAnchor="middle" fontSize="8"
          fill="#B896D4" fontWeight="600"
        >
          {medianSR % 1 === 0 ? medianSR : medianSR.toFixed(1)}
        </text>
        <text
          x={medX} y={svgH - BOT_P + 21}
          textAnchor="middle" fontSize="7" fill="#B896D4"
        >
          median
        </text>

        {/* ── Batter rows ─────────────────────────────────────────────── */}
        {eligible.map((b, i) => {
          const cy    = TOP_P + i * ROW_H + ROW_H / 2;
          const dotX  = toX(b.strikeRate);
          const fill  = dotFill(b.strikeRate, medianSR);
          const track = trackFill(b.strikeRate, medianSR);
          const firstName = b.name.split(" ")[0];

          return (
            <g key={b.name}>
              {/* Position badge */}
              <text
                x={22} y={cy + 4}
                textAnchor="middle" fontSize="8.5" fill="#d1d5db"
              >
                #{b.position}
              </text>

              {/* Player first name */}
              <text
                x={30} y={cy + 4}
                fontSize="9.5" fill="#374151"
                fontWeight={b.isTopOrder ? "700" : "400"}
              >
                {firstName}
              </text>

              {/* Track background */}
              <rect
                x={CL} y={cy - 7}
                width={CW} height={14}
                fill={track} rx="3"
              />

              {/* Filled bar from 0 to SR */}
              <rect
                x={CL} y={cy - 5}
                width={Math.max(0, dotX - CL)} height={10}
                fill={fill} opacity="0.25" rx="2"
              />

              {/* Connector line: median → dot */}
              <line
                x1={medX} y1={cy}
                x2={dotX} y2={cy}
                stroke={fill} strokeWidth="2" opacity="0.55"
              />

              {/* Dot */}
              <circle cx={dotX} cy={cy} r={5} fill={fill} />

              {/* Not-out ring */}
              {b.notOut && (
                <circle
                  cx={dotX} cy={cy} r={7.5}
                  fill="none" stroke={fill} strokeWidth="1.2" opacity="0.5"
                />
              )}

              {/* SR value to the right */}
              <text
                x={CR + 7} y={cy + 4}
                fontSize="9" fill={fill} fontWeight="600"
              >
                {b.strikeRate % 1 === 0
                  ? b.strikeRate
                  : b.strikeRate.toFixed(1)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-green-600" />
          Well above median
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-vv-dark" />
          Above median
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
          Near median
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
          Well below median
        </span>
        <span className="flex items-center gap-1 text-gray-400">
          <span>○ = not out</span>
        </span>
      </div>
    </div>
  );
}
