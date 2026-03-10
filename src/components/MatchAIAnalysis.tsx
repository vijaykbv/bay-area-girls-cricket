"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function MatchAIAnalysis({ matchId }: { matchId: string }) {
  const [notes, setNotes] = useState("");
  const [narrative, setNarrative] = useState("");
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle");

  async function handleGenerate() {
    if (!notes.trim()) return;
    setStatus("generating");
    setNarrative("");
    try {
      const res = await fetch(`/api/matches/${matchId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setNarrative(data.narrative);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="card p-5 sm:p-6 mt-8">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
        AI Coaching Analysis
      </p>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          if (status === "done" || status === "error") setStatus("idle");
        }}
        placeholder="Add your observations from this game — things the scorecard doesn't capture…"
        rows={4}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-vv-violet resize-y"
      />
      <div className="flex justify-end mt-2">
        <button
          onClick={handleGenerate}
          disabled={!notes.trim() || status === "generating"}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg bg-vv-violet text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {status === "generating" && <Loader2 size={13} className="animate-spin" />}
          {status === "generating" ? "Generating…" : "Generate Analysis"}
        </button>
      </div>

      {status === "error" && (
        <p className="mt-3 text-sm text-red-600">Failed to generate analysis. Please try again.</p>
      )}

      {status === "done" && narrative && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-sm text-gray-700 leading-relaxed">{narrative}</p>
        </div>
      )}
    </div>
  );
}
