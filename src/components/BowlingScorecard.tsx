import type { Innings } from "@/lib/types";

interface Props {
  innings: Innings;
}

export default function BowlingScorecard({ innings }: Props) {
  const bowling = innings.bowling_performances ?? [];
  if (bowling.length === 0) return null;

  const bestWickets = Math.max(...bowling.map((b) => b.wickets), 0);

  return (
    <div>
      <h3 className="text-sm font-bold text-black mb-3">Bowling</h3>
      <div className="overflow-x-auto">
        <table className="scorecard-table">
          <thead>
            <tr>
              <th className="w-44">Bowler</th>
              <th className="text-right w-10">O</th>
              <th className="text-right w-10">M</th>
              <th className="text-right w-10">R</th>
              <th className="text-right w-10">W</th>
              <th className="text-right w-16">Econ</th>
              <th className="text-right w-10">WD</th>
              <th className="text-right w-10">NB</th>
            </tr>
          </thead>
          <tbody>
            {bowling.map((b) => (
              <tr key={b.id}>
                <td className="font-medium whitespace-nowrap">{b.player_name}</td>
                <td className="text-right tabular-nums">{b.overs}</td>
                <td className="text-right text-gray-600 tabular-nums">{b.maidens}</td>
                <td className="text-right tabular-nums">{b.runs}</td>
                <td
                  className={`text-right font-bold tabular-nums ${
                    b.wickets === bestWickets && bestWickets > 0
                      ? "text-vv-dark"
                      : "text-black"
                  }`}
                >
                  {b.wickets}
                </td>
                <td className="text-right text-gray-500 tabular-nums">
                  {(b.economy ?? 0).toFixed(2)}
                </td>
                <td className="text-right text-gray-600 tabular-nums">{b.wides}</td>
                <td className="text-right text-gray-600 tabular-nums">{b.no_balls}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
