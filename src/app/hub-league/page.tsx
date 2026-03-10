import { createServerClient } from "@/lib/supabase";
import { HubSeason, HubStanding, HubUpdate, HubTopPerformer } from "@/lib/types";

export const revalidate = 300;

const TYPE_LABELS: Record<string, string> = {
  preview: "Preview",
  saturday: "Saturday Update",
  sunday: "Sunday Wrap",
};

const TYPE_COLORS: Record<string, string> = {
  preview: "bg-violet-100 text-violet-800",
  saturday: "bg-blue-100 text-blue-800",
  sunday: "bg-green-100 text-green-800",
};

function formatNRR(nrr: number) {
  return (nrr >= 0 ? "+" : "") + nrr.toFixed(3);
}

async function fetchHubData() {
  const supabase = createServerClient();

  const { data: season } = await supabase
    .from("hub_seasons")
    .select("*")
    .eq("active", true)
    .single();

  if (!season) return { season: null, standings: [], allUpdates: [], performers: [] };

  const [standingsRes, updatesRes, performersRes] = await Promise.all([
    supabase
      .from("hub_standings")
      .select("*")
      .eq("season_id", season.id)
      .order("points", { ascending: false })
      .order("nrr", { ascending: false }),
    supabase
      .from("hub_updates")
      .select("*")
      .eq("season_id", season.id)
      .eq("published", true)
      .order("week_number", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("hub_top_performers")
      .select("*")
      .eq("season_id", season.id)
      .order("week_number", { ascending: false }),
  ]);

  const allPerformers = performersRes.data ?? [];
  const maxWeek = allPerformers.length > 0 ? Math.max(...allPerformers.map((p) => p.week_number)) : 0;
  const performers = allPerformers.filter((p) => p.week_number === maxWeek);

  return {
    season: season as HubSeason,
    standings: (standingsRes.data ?? []) as HubStanding[],
    allUpdates: (updatesRes.data ?? []) as HubUpdate[],
    performers: performers as HubTopPerformer[],
    maxWeek,
  };
}

export default async function HubLeaguePage() {
  const { season, standings, allUpdates, performers, maxWeek } = await fetchHubData();

  const latestUpdate = allUpdates[0] ?? null;
  const pastUpdates = allUpdates.slice(1);

  // Group past updates by week
  const pastByWeek: Record<number, HubUpdate[]> = {};
  for (const u of pastUpdates) {
    if (!pastByWeek[u.week_number]) pastByWeek[u.week_number] = [];
    pastByWeek[u.week_number].push(u);
  }
  const pastWeeks = Object.keys(pastByWeek)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-black relative overflow-hidden py-16 px-4">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(139,92,246,0.18) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-4xl">🏏</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-3">
            Bay Area Hub League
          </h1>
          {season && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="bg-violet-700 text-white text-sm font-semibold px-3 py-1 rounded-full">
                {season.age_group}
              </span>
              <span className="text-violet-300 text-sm font-medium">{season.name}</span>
            </div>
          )}
          <p className="text-gray-400 text-lg">
            Your weekly destination for Hub cricket — previews, results, and standings.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-12">
        {/* Latest Update */}
        {latestUpdate ? (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
              Latest Update
            </h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    TYPE_COLORS[latestUpdate.type] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {TYPE_LABELS[latestUpdate.type] ?? latestUpdate.type}
                </span>
                <span className="text-xs text-gray-400">Week {latestUpdate.week_number}</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{latestUpdate.title}</h3>
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                {latestUpdate.content}
              </div>
            </div>
          </section>
        ) : (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
              Latest Update
            </h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center text-gray-400">
              No updates published yet. Check back after the first match weekend.
            </div>
          </section>
        )}

        {/* Standings */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
            Standings
          </h2>
          {standings.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Team</th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-600">P</th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-600">W</th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-600">L</th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-600">T</th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-600">NR</th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-600">Pts</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">NRR</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, i) => (
                    <tr
                      key={row.id}
                      className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{row.team_name}</td>
                      <td className="text-center px-3 py-3 text-gray-600">{row.played}</td>
                      <td className="text-center px-3 py-3 text-gray-600">{row.won}</td>
                      <td className="text-center px-3 py-3 text-gray-600">{row.lost}</td>
                      <td className="text-center px-3 py-3 text-gray-600">{row.tied}</td>
                      <td className="text-center px-3 py-3 text-gray-600">{row.no_result}</td>
                      <td className="text-center px-3 py-3 font-bold text-violet-700">{row.points}</td>
                      <td
                        className={`text-right px-4 py-3 font-mono text-sm ${
                          row.nrr >= 0 ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {formatNRR(row.nrr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center text-gray-400">
              Standings will appear once the season begins.
            </div>
          )}
        </section>

        {/* Top Performers */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
            {maxWeek ? `Week ${maxWeek} Top Performers` : "Top Performers"}
          </h2>
          {performers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {performers.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-1"
                >
                  <span className="text-xs font-bold uppercase tracking-wide text-violet-600">
                    {p.category}
                  </span>
                  <p className="text-lg font-bold text-gray-900">{p.player_name}</p>
                  <p className="text-sm text-gray-500">{p.team_name}</p>
                  <p className="text-2xl font-extrabold text-violet-700 mt-1">{p.value}</p>
                  {p.match_context && (
                    <p className="text-xs text-gray-400 mt-1">{p.match_context}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center text-gray-400">
              Top performer awards will be posted after each match week.
            </div>
          )}
        </section>

        {/* Past Updates */}
        {pastWeeks.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
              Past Updates
            </h2>
            <div className="space-y-4">
              {pastWeeks.map((week) => (
                <details key={week} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group">
                  <summary className="px-6 py-4 flex items-center justify-between cursor-pointer select-none font-semibold text-gray-700 hover:bg-gray-50 transition-colors list-none">
                    <span>Week {week}</span>
                    <span className="text-gray-400 group-open:rotate-180 transition-transform text-lg">▾</span>
                  </summary>
                  <div className="px-6 pb-5 space-y-4 border-t border-gray-50 pt-4">
                    {pastByWeek[week].map((u) => (
                      <div key={u.id}>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              TYPE_COLORS[u.type] ?? "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {TYPE_LABELS[u.type] ?? u.type}
                          </span>
                          <span className="font-medium text-gray-800 text-sm">{u.title}</span>
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{u.content}</p>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
