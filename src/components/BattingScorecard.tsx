import type { Innings } from "@/lib/types";

interface Props {
  innings: Innings;
}

export default function BattingScorecard({ innings }: Props) {
  const batting = innings.batting_performances ?? [];
  const topScore = Math.max(...batting.map((b) => b.runs), 0);

  return (
    <div>
      <h3 className="text-sm font-bold text-black mb-3">Batting</h3>
      <div className="overflow-x-auto">
        <table className="scorecard-table">
          <thead>
            <tr>
              <th className="w-44">Batter</th>
              <th>Dismissal</th>
              <th className="text-right w-10">R</th>
              <th className="text-right w-10">B</th>
              <th className="text-right w-10">4s</th>
              <th className="text-right w-10">6s</th>
              <th className="text-right w-14">SR</th>
            </tr>
          </thead>
          <tbody>
            {batting.map((b) => (
              <tr key={b.id}>
                <td className="font-medium whitespace-nowrap">
                  {b.player_name}
                  {b.not_out && (
                    <span className="text-vv-violet font-bold ml-0.5">*</span>
                  )}
                </td>
                <td className="text-gray-500 text-xs">
                  {b.not_out ? "not out" : b.how_out || "not out"}
                </td>
                <td
                  className={`text-right font-bold tabular-nums ${
                    b.runs === topScore && topScore > 0
                      ? "text-vv-dark"
                      : "text-black"
                  }`}
                >
                  {b.runs}
                </td>
                <td className="text-right text-gray-600 tabular-nums">{b.balls}</td>
                <td className="text-right text-gray-600 tabular-nums">{b.fours}</td>
                <td className="text-right text-gray-600 tabular-nums">{b.sixes}</td>
                <td className="text-right text-gray-500 tabular-nums">
                  {(b.strike_rate ?? 0).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 text-sm font-semibold">
              <td colSpan={2}>
                Total
                {innings.extras > 0 && (
                  <span className="ml-2 font-normal text-gray-500 text-xs">
                    (Extras: {innings.extras})
                  </span>
                )}
              </td>
              <td colSpan={5} className="text-right tabular-nums">
                {innings.total_runs}/{innings.total_wickets} ({innings.total_overs}{" "}
                ov)
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
