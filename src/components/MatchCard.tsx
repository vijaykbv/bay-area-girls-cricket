import Link from "next/link";
import { format } from "date-fns";
import { Calendar, MapPin, Trophy } from "lucide-react";
import type { Match } from "@/lib/types";

interface MatchCardProps {
  match: Match;
  showLink?: boolean;
}

export default function MatchCard({ match, showLink = true }: MatchCardProps) {
  const isCompleted = match.status === "completed";
  const date = new Date(match.date);

  return (
    <div className="card p-4 hover:shadow-md transition-shadow">
      {/* Competition badge */}
      {match.competition && (
        <span className="stat-badge">{match.competition}</span>
      )}

      {/* Teams */}
      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="font-semibold text-black text-sm sm:text-base flex-1">
          {match.home_team?.name ?? "TBD"}
        </p>
        <span className="text-xs font-bold text-gray-400 shrink-0">vs</span>
        <p className="font-semibold text-black text-sm sm:text-base flex-1 text-right">
          {match.away_team?.name ?? "TBD"}
        </p>
      </div>

      {/* Result */}
      {isCompleted && match.result && (
        <div className="mt-2 flex items-center gap-1 text-xs text-vv-dark font-medium">
          <Trophy size={12} />
          <span>{match.result}</span>
        </div>
      )}

      {/* Meta */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {format(date, "EEE, d MMM yyyy")}
        </span>
        {match.venue && (
          <span className="flex items-center gap-1">
            <MapPin size={12} />
            {match.venue}
          </span>
        )}
      </div>

      {/* Link */}
      {showLink && isCompleted && (
        <Link
          href={`/match/${match.id}`}
          className="mt-3 inline-block text-xs font-semibold text-vv-violet hover:text-vv-dark hover:underline transition-colors"
        >
          View scorecard →
        </Link>
      )}
    </div>
  );
}
