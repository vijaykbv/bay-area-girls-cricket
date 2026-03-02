import type { MatchReport, TeamReport, PlayerSummary, NoteType, OpportunityFlag } from "@/lib/analyze";
import StrikeRateChart from "@/components/StrikeRateChart";

const NOTE_STYLES: Record<NoteType, string> = {
  positive: "bg-green-50 border-green-200 text-green-800",
  concern:  "bg-amber-50  border-amber-200  text-amber-800",
  info:     "bg-gray-50   border-gray-200   text-gray-700",
};

const NOTE_ICONS: Record<NoteType, string> = {
  positive: "✓",
  concern:  "⚠",
  info:     "·",
};

export default function MatchAnalysis({
  report,
  context,
}: {
  report: MatchReport;
  context?: "tournament";
}) {
  if (report.teams.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
        Selection &amp; Role Analysis
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        {context === "tournament"
          ? "Role analysis — top-order batters (1–4) must not bowl; bowlers are judged on wickets & economy only."
          : "Based on Hub selection criteria — top-order batters (1–4) must not bowl; bowlers are judged on wickets & economy only."}
      </p>
      <div className={context === "tournament" ? "space-y-6" : "grid grid-cols-1 lg:grid-cols-2 gap-6"}>
        {report.teams.map((team) => (
          <TeamCard key={team.teamName} team={team} context={context} />
        ))}
      </div>
    </section>
  );
}

function TeamCard({ team, context }: { team: TeamReport; context?: "tournament" }) {
  const noteText = (text: string) =>
    context === "tournament"
      ? text.replace(/\bHub\b/g, "tournament").replace(/\bhub\b/g, "tournament")
      : text;
  return (
    <div className="card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-black leading-tight">{team.teamName}</h3>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
            team.rulesFollowed
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {team.rulesFollowed ? "✓ Rules followed" : "⚠ Rule conflict"}
        </span>
      </div>

      {/* Top-order batters */}
      {team.topOrder.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            Top Order (1–4) — Batters only
          </p>
          <div className="space-y-1.5">
            {team.topOrder.map((p) => (
              <BatterRow key={p.name} p={p} isTopOrder />
            ))}
          </div>
        </div>
      )}

      {/* Bowlers */}
      {(team.bowlers.length > 0 || team.bowlerOnly.length > 0) && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            Bowlers (5+) — Wickets are everything
          </p>
          <div className="space-y-1.5">
            {team.bowlers.map((p) => (
              <BowlerRow key={p.name} p={p} />
            ))}
            {team.bowlerOnly.map((p) => (
              <BowlerRow key={p.name} p={p} />
            ))}
          </div>
        </div>
      )}

      {/* Middle order exposure players */}
      {team.middleOrderOnly.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            Middle Order — Game exposure
          </p>
          <div className="space-y-1.5">
            {team.middleOrderOnly.map((p) => (
              <BatterRow key={p.name} p={p} isTopOrder={false} />
            ))}
          </div>
        </div>
      )}

      {/* Rule conflicts */}
      {team.ruleConflicts.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-1">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wide">
            ⚠ Rule Conflicts
          </p>
          {team.ruleConflicts.map((c) => (
            <p key={c.name} className="text-xs text-red-700">
              {c.name} batted at #{c.battingPos} AND bowled {c.overs} overs
            </p>
          ))}
        </div>
      )}

      {/* Opportunity concentration */}
      {team.opportunityFlags.length > 0 && (
        <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">
              ⚑ Opportunity Concentration
            </p>
            <p className="text-xs text-orange-500 shrink-0">
              avg {team.avgBallsFaced}b · avg {team.avgOversBowled}ov
            </p>
          </div>
          <p className="text-xs text-orange-600">
            These players received above-average batting time <em>and</em> bowling load — others got less.
          </p>
          <div className="space-y-1.5 pt-0.5">
            {team.opportunityFlags.map((f) => (
              <OpportunityRow key={f.name} f={f} />
            ))}
          </div>
        </div>
      )}

      {/* Strike rate chart */}
      {team.medianStrikeRate > 0 && (() => {
        const allBatters = [
          ...team.topOrder.map((p) => ({ ...p, isTopOrder: true })),
          ...team.bowlers.map((p) => ({ ...p, isTopOrder: false })),
          ...team.middleOrderOnly.map((p) => ({ ...p, isTopOrder: false })),
        ]
          .filter((p) => (p.balls ?? 0) >= 6)
          .sort((a, b) => (a.battingPosition ?? 0) - (b.battingPosition ?? 0))
          .map((p) => ({
            name: p.name,
            position: p.battingPosition ?? 0,
            strikeRate: p.strikeRate ?? 0,
            runs: p.runs ?? 0,
            balls: p.balls ?? 0,
            notOut: p.notOut ?? false,
            isTopOrder: p.isTopOrder,
          }));
        return (
          <StrikeRateChart batters={allBatters} medianSR={team.medianStrikeRate} />
        );
      })()}

      {/* Performance notes */}
      {team.notes.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-gray-100">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
            Coach Notes
          </p>
          {(["positive", "info", "concern"] as NoteType[]).map((type) => {
            const filtered = team.notes.filter((n) => n.type === type);
            return filtered.map((n, i) => (
              <div
                key={`${type}-${i}`}
                className={`text-xs px-3 py-2 rounded-lg border ${NOTE_STYLES[type]}`}
              >
                <span className="font-semibold">
                  {NOTE_ICONS[type]} {n.player}:
                </span>{" "}
                {noteText(n.note)}
              </div>
            ));
          })}
        </div>
      )}
    </div>
  );
}

function BatterRow({
  p,
  isTopOrder,
}: {
  p: PlayerSummary;
  isTopOrder: boolean;
}) {
  const hasBalls = (p.balls ?? 0) >= 6;
  const srColor =
    hasBalls && isTopOrder
      ? (p.strikeRate ?? 0) < 80
        ? "text-amber-600"
        : (p.strikeRate ?? 0) >= 110
        ? "text-green-700"
        : "text-gray-500"
      : "text-gray-500";

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-gray-300 text-xs tabular-nums w-6 shrink-0">
          #{p.battingPosition}
        </span>
        <span className="font-medium truncate">{p.name}</span>
        {p.notOut && (
          <span className="text-vv-violet font-bold text-xs">*</span>
        )}
        {p.overs && (
          <span className="text-xs text-red-500 font-semibold shrink-0">
            [also bowled]
          </span>
        )}
      </div>
      <div className="text-right shrink-0 text-xs tabular-nums">
        <span className="font-semibold text-black">{p.runs ?? 0}</span>
        <span className="text-gray-400"> ({p.balls ?? 0}b)</span>
        {hasBalls && (
          <span className={`ml-1 ${srColor}`}>
            SR {(p.strikeRate ?? 0).toFixed(0)}
          </span>
        )}
      </div>
    </div>
  );
}

function BowlerRow({ p }: { p: PlayerSummary }) {
  const wkColor =
    (p.wickets ?? 0) >= 3
      ? "text-green-700 font-bold"
      : (p.wickets ?? 0) === 0
      ? "text-amber-600"
      : "text-black font-semibold";

  const econColor =
    (p.economy ?? 0) <= 4.5
      ? "text-green-700"
      : (p.economy ?? 0) >= 7
      ? "text-amber-600"
      : "text-gray-500";

  // Build dismissal tier chips only when we have breakdown data
  const tierChips: { label: string; color: string }[] = [];
  if ((p.topOrderWickets ?? 0) > 0)
    tierChips.push({ label: `${p.topOrderWickets} top`, color: "text-vv-dark" });
  if ((p.middleOrderWickets ?? 0) > 0)
    tierChips.push({ label: `${p.middleOrderWickets} mid`, color: "text-gray-500" });
  if ((p.lowerOrderWickets ?? 0) > 0)
    tierChips.push({ label: `${p.lowerOrderWickets} low`, color: "text-gray-400" });

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-1.5 min-w-0">
        {p.battingPosition ? (
          <span className="text-gray-300 text-xs tabular-nums w-6 shrink-0">
            #{p.battingPosition}
          </span>
        ) : (
          <span className="text-gray-200 text-xs w-6 shrink-0">—</span>
        )}
        <span className="font-medium truncate">{p.name}</span>
        {p.notOut && (
          <span className="text-vv-violet font-bold text-xs">*</span>
        )}
      </div>
      <div className="text-right shrink-0 text-xs tabular-nums space-x-2">
        {p.battingPosition && (
          <span className="text-gray-400">
            bat {p.runs ?? 0}
            {p.notOut ? "*" : ""}({p.balls ?? 0}b)
          </span>
        )}
        <span className={wkColor}>
          {p.wickets ?? 0}/{p.bowlingRuns ?? 0}
        </span>
        <span className="text-gray-400">({p.overs ?? 0}ov)</span>
        <span className={econColor}>Econ {(p.economy ?? 0).toFixed(2)}</span>
        {tierChips.length > 0 && (
          <span className="text-gray-300">·</span>
        )}
        {tierChips.map((chip) => (
          <span key={chip.label} className={chip.color}>
            {chip.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function OpportunityRow({ f }: { f: OpportunityFlag }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-orange-300 tabular-nums w-6 shrink-0">#{f.battingPosition}</span>
        <span className="font-medium text-orange-900 truncate">{f.name}</span>
      </div>
      <div className="shrink-0 flex items-center gap-2 tabular-nums text-orange-700">
        <span>
          <span className="font-semibold">{f.balls}b</span>
          <span className="text-orange-400"> bat (avg {f.avgBalls})</span>
        </span>
        <span className="text-orange-300">·</span>
        <span>
          <span className="font-semibold">{f.overs}ov</span>
          <span className="text-orange-400"> bowl (avg {f.avgOvers})</span>
        </span>
      </div>
    </div>
  );
}
