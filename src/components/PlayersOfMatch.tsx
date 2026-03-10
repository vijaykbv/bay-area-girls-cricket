import type { PlayerOfMatchResult } from "@/lib/analyze";

const RANK_CONFIG = [
  {
    border: "border-amber-400",
    headerBg: "bg-amber-400",
    badge: "🥇",
    label: "Player of the Match",
  },
  {
    border: "border-gray-300",
    headerBg: "bg-gray-400",
    badge: "🥈",
    label: "2nd Best",
  },
  {
    border: "border-amber-700",
    headerBg: "bg-amber-700",
    badge: "🥉",
    label: "3rd Best",
  },
];

export default function PlayersOfMatch({
  players,
}: {
  players: PlayerOfMatchResult[];
}) {
  if (players.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
        Players of the Match
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {players.map((p, i) => {
          const cfg = RANK_CONFIG[i] ?? RANK_CONFIG[2];
          const hasBat  = p.runs !== undefined;
          const hasBowl = p.wickets !== undefined || p.overs !== undefined;

          return (
            <div
              key={p.name}
              className={`bg-white rounded-xl border-2 ${cfg.border} overflow-hidden shadow-sm`}
            >
              {/* Coloured header strip */}
              <div className={`${cfg.headerBg} px-3 py-1.5 flex items-center gap-2`}>
                <span className="text-base">{cfg.badge}</span>
                <span className="text-white text-xs font-bold uppercase tracking-wide">
                  {cfg.label}
                </span>
              </div>

              <div className="p-4">
                {/* Name + team */}
                <p className="font-bold text-gray-900 text-base leading-tight">{p.name}</p>
                <p className="text-xs text-gray-500 mb-3">{p.team}</p>

                {/* Stat chips */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {hasBat && (
                    <>
                      <StatChip
                        value={`${p.runs}${p.notOut ? "*" : ""}`}
                        label={`${p.balls}b`}
                        highlight
                      />
                      {p.strikeRate !== undefined && (
                        <StatChip value={`SR ${Math.round(p.strikeRate)}`} />
                      )}
                    </>
                  )}
                  {hasBowl && p.wickets !== undefined && (
                    <StatChip
                      value={`${p.wickets}/${p.bowlingRuns ?? 0}`}
                      label={`${p.overs}ov`}
                      highlight
                    />
                  )}
                  {p.economy !== undefined && (
                    <StatChip value={`Econ ${p.economy.toFixed(1)}`} />
                  )}
                </div>

                {/* Headline reason */}
                <p className="text-xs text-gray-600 italic leading-snug">{p.headline}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StatChip({
  value,
  label,
  highlight,
}: {
  value: string;
  label?: string;
  highlight?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${
        highlight
          ? "bg-vv-violet text-white"
          : "bg-gray-100 text-gray-700"
      }`}
    >
      {value}
      {label && <span className="opacity-70 font-normal">{label}</span>}
    </span>
  );
}
