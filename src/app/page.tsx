import Link from "next/link";
import { createServerClient } from "@/lib/supabase";
import MatchCard from "@/components/MatchCard";
import Chatbot from "@/components/Chatbot";
import type { Match } from "@/lib/types";
import { ArrowRight, Users, Trophy, BarChart3, Medal } from "lucide-react";

export const revalidate = 3600;

async function getRecentMatches(): Promise<Match[]> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("matches")
      .select("*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)")
      .eq("status", "completed")
      .order("date", { ascending: false })
      .limit(3);
    return (data as Match[]) ?? [];
  } catch {
    return [];
  }
}

async function getUpcomingMatches(): Promise<Match[]> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("matches")
      .select("*, home_team:teams!home_team_id(*), away_team:teams!away_team_id(*)")
      .eq("status", "scheduled")
      .gte("date", new Date().toISOString().split("T")[0])
      .order("date", { ascending: true })
      .limit(3);
    return (data as Match[]) ?? [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [recentMatches, upcomingMatches] = await Promise.all([
    getRecentMatches(),
    getUpcomingMatches(),
  ]);

  return (
    <>
      {/* Hero */}
      <section className="relative bg-black text-white overflow-hidden">
        {/* Violet glow accent */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 60% 50%, #B896D4, transparent)",
          }}
        />
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 39px,#B896D4 39px,#B896D4 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,#B896D4 39px,#B896D4 40px)",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="max-w-2xl">
            <p className="text-vv-violet font-semibold text-sm uppercase tracking-widest mb-3">
              San Francisco Bay Area
            </p>
            <h1 className="text-4xl sm:text-6xl font-extrabold leading-tight tracking-tight">
              Bay Area<br />
              <span className="text-vv-violet">Girls Cricket</span>
            </h1>
            <p className="mt-5 text-lg text-gray-300 max-w-xl leading-relaxed">
              Empowering young women through the sport of cricket — building skills,
              confidence, and community across the Bay Area.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/players" className="btn-primary">
                Meet the Players
              </Link>
              <Link
                href="/results"
                className="border border-vv-violet text-vv-violet hover:bg-vv-violet hover:text-white font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                View Results
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick nav strip */}
      <section className="bg-vv-violet py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-8 text-white text-center">
            {[
              { icon: <Users size={18} />, label: "Players", href: "/players" },
              { icon: <Trophy size={18} />, label: "Matches", href: "/results" },
              { icon: <BarChart3 size={18} />, label: "Statistics", href: "/stats" },
              { icon: <Medal size={18} />, label: "Tournaments", href: "/tournaments" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-2 text-sm font-semibold hover:underline"
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Upcoming matches */}
        {upcomingMatches.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Upcoming Matches</h2>
              <Link
                href="/schedule"
                className="flex items-center gap-1 text-sm text-vv-violet font-semibold hover:underline"
              >
                Full schedule <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingMatches.map((match) => (
                <MatchCard key={match.id} match={match} showLink={false} />
              ))}
            </div>
          </section>
        )}

        {/* Recent results */}
        {recentMatches.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Recent Results</h2>
              <Link
                href="/results"
                className="flex items-center gap-1 text-sm text-vv-violet font-semibold hover:underline"
              >
                All results <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="bg-black rounded-2xl text-white p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 border border-vv-violet/30">
          <div>
            <h2 className="text-2xl font-bold">Track Player Statistics</h2>
            <p className="text-gray-400 mt-1">
              Batting averages, bowling figures, and match-by-match analysis.
            </p>
          </div>
          <Link
            href="/stats"
            className="shrink-0 bg-vv-violet hover:bg-vv-dark text-white font-bold px-6 py-3 rounded-xl transition-colors"
          >
            View Statistics
          </Link>
        </section>
      </div>

      <Chatbot />
    </>
  );
}
