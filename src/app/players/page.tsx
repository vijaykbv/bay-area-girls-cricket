import { createServerClient } from "@/lib/supabase";
import type { Player } from "@/lib/types";
import type { Metadata } from "next";
import Image from "next/image";
import { User } from "lucide-react";

export const metadata: Metadata = { title: "Players" };
export const revalidate = 3600;

async function getPlayers(): Promise<Player[]> {
  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("players")
      .select("*, team:teams(*)")
      .order("name");
    return (data as Player[]) ?? [];
  } catch {
    return [];
  }
}

const roleColors: Record<string, string> = {
  batsman:        "bg-blue-100 text-blue-700",
  bowler:         "bg-red-100 text-red-700",
  "all-rounder":  "bg-vv-light text-vv-dark",
  "wicket-keeper":"bg-amber-100 text-amber-700",
};

export default async function PlayersPage() {
  const players = await getPlayers();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="section-title text-3xl">Players</h1>
      <p className="text-gray-500 mb-8">Meet the talented cricketers of Bay Area Girls Cricket.</p>

      {players.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <User size={48} className="mx-auto mb-3 opacity-30" />
          <p>No players added yet. Import match data or add players via the admin panel.</p>
        </div>
      ) : (
        <div className="grid gap-5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {players.map((player) => (
            <div key={player.id} className="card p-4 text-center hover:shadow-md transition-shadow">
              {player.photo_url ? (
                <Image
                  src={player.photo_url}
                  alt={player.name}
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full object-cover mx-auto mb-3 ring-2 ring-vv-violet"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center mx-auto mb-3 ring-2 ring-vv-violet">
                  <span className="text-2xl font-bold text-vv-violet">
                    {player.name.charAt(0)}
                  </span>
                </div>
              )}
              <p className="font-semibold text-sm text-black leading-tight">{player.name}</p>
              {player.team && (
                <p className="text-xs text-gray-500 mt-0.5">{player.team.name}</p>
              )}
              <span
                className={`mt-2 inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                  roleColors[player.role] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {player.role}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
