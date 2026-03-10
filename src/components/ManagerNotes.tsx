"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";

interface Props {
  initialNotes: string | null;
  endpoint: string;
  label?: string;
}

export default function ManagerNotes({
  initialNotes,
  endpoint,
  label = "Manager Notes",
}: Props) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  async function handleSave() {
    setStatus("saving");
    try {
      await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("idle");
    }
  }

  return (
    <div className="mt-6 pt-5 border-t border-gray-100">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
        {label}
      </p>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          if (status === "saved") setStatus("idle");
        }}
        placeholder="Add your observations from this game — things the scorecard doesn't capture…"
        rows={4}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-vv-violet resize-y"
      />
      <div className="flex justify-end mt-2">
        <button
          onClick={handleSave}
          disabled={status === "saving"}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg bg-vv-violet text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {status === "saving" && <Loader2 size={13} className="animate-spin" />}
          {status === "saved" && <Check size={13} />}
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save Notes"}
        </button>
      </div>
    </div>
  );
}
