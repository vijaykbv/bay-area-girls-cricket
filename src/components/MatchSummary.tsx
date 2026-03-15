"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

function renderSummary(text: string) {
  // Split on bold headers like **Match Result** and render as sections
  const lines = text.split("\n").filter((l) => l.trim());
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    const headerMatch = line.match(/^\*\*(.+)\*\*$/);
    if (headerMatch) {
      elements.push(
        <p key={i} className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-4 first:mt-0">
          {headerMatch[1]}
        </p>
      );
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      elements.push(
        <p key={i} className="text-sm text-gray-700 leading-relaxed pl-3 border-l-2 border-vv-violet/30">
          {line.replace(/^[-•]\s/, "")}
        </p>
      );
    } else {
      elements.push(
        <p key={i} className="text-sm text-gray-700 leading-relaxed">
          {line}
        </p>
      );
    }
  });

  return elements;
}

export default function MatchSummary({ matchId }: { matchId: string }) {
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    fetch(`/api/matches/${matchId}/summary`)
      .then((r) => r.json())
      .then((data) => {
        if (data.summary) {
          setSummary(data.summary);
          setStatus("done");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [matchId]);

  if (status === "error") return null;

  return (
    <div className="card p-5 sm:p-6 mb-8 border-l-4 border-vv-violet">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-vv-violet shrink-0" />
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Match Summary
        </p>
      </div>

      {status === "loading" ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <Loader2 size={14} className="animate-spin" />
          Generating summary…
        </div>
      ) : (
        <div className="space-y-2">
          {renderSummary(summary)}
        </div>
      )}
    </div>
  );
}
