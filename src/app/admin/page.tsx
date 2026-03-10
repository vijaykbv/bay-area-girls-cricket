"use client";

import { useState } from "react";
import Link from "next/link";
import { Upload, CheckCircle, AlertCircle, Loader2, ExternalLink, BarChart2, Trophy } from "lucide-react";

export default function AdminPage() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [matchId, setMatchId] = useState("");

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!url) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Import failed. Check the URL and try again.");
      } else {
        setStatus("success");
        setMatchId(data.matchId);
        setMessage("Scorecard imported successfully!");
        setUrl("");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="section-title text-3xl">Import Scorecard</h1>
          <p className="text-gray-500">
            Paste a CricClubs scorecard URL to import match data.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <Link
            href="/admin/hub-league"
            className="flex items-center gap-2 text-sm font-semibold text-vv-violet hover:underline"
          >
            <Trophy size={16} />
            Hub League
          </Link>
          <Link
            href="/admin/tournament"
            className="flex items-center gap-2 text-sm font-semibold text-vv-violet hover:underline"
          >
            <BarChart2 size={16} />
            Tournament Analysis
          </Link>
        </div>
      </div>

      <form onSubmit={handleImport} className="card p-6 space-y-5 border-t-4 border-vv-violet">
        <div>
          <label className="block text-sm font-semibold text-black mb-1">
            CricClubs Scorecard URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://cricclubs.com/strikersca/viewScorecard.do?matchId=..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-vv-violet"
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            Example: https://cricclubs.com/strikersca/viewScorecard.do?matchId=1142&clubId=1095791
          </p>
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {status === "loading" ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Scraping & importing...
            </>
          ) : (
            <>
              <Upload size={16} />
              Import Scorecard
            </>
          )}
        </button>

        {status === "success" && (
          <div className="flex items-start gap-2 text-vv-dark bg-vv-light rounded-lg p-4">
            <CheckCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">{message}</p>
              {matchId && (
                <a
                  href={`/match/${matchId}`}
                  className="text-sm underline mt-1 inline-flex items-center gap-1"
                >
                  View scorecard <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-start gap-2 text-red-700 bg-red-50 rounded-lg p-4">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p className="text-sm">{message}</p>
          </div>
        )}
      </form>

      <div className="mt-6 card p-4 border border-vv-violet/30 bg-vv-xlight">
        <p className="text-sm font-semibold text-black">Important notes</p>
        <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-1">
          <li>The importer uses a real browser (Playwright) to load the page</li>
          <li>It may take 15–30 seconds to scrape and save a scorecard</li>
          <li>Only CricClubs URLs are supported</li>
          <li>Duplicate imports of the same URL will create duplicate entries</li>
        </ul>
      </div>
    </div>
  );
}
