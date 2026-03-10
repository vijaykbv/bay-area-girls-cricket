"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Trash2, Save, Send, Eye, EyeOff } from "lucide-react";
import { HubSeason, HubStanding, HubUpdate, HubTopPerformer } from "@/lib/types";

type Tab = "standings" | "updates" | "performers";

const DEFAULT_CATEGORIES = ["Top Batter", "Top Bowler", "Best Economy", "Player of the Week"];

const UPDATE_TYPES = [
  { value: "preview", label: "Preview" },
  { value: "saturday", label: "Saturday Update" },
  { value: "sunday", label: "Sunday Wrap" },
];

interface PerformerRow {
  category: string;
  player_name: string;
  team_name: string;
  value: string;
  match_context: string;
}

interface StandingRow extends Omit<HubStanding, "id" | "season_id" | "updated_at"> {
  _key: number;
}

export default function AdminHubLeaguePage() {
  const [tab, setTab] = useState<Tab>("standings");
  const [season, setSeason] = useState<HubSeason | null>(null);
  const [loading, setLoading] = useState(true);

  // Standings state
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [standingsSaving, setStandingsSaving] = useState(false);
  const [standingsMsg, setStandingsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Updates state
  const [updates, setUpdates] = useState<HubUpdate[]>([]);
  const [weekNum, setWeekNum] = useState(1);
  const [updateType, setUpdateType] = useState<"preview" | "saturday" | "sunday">("preview");
  const [updateTitle, setUpdateTitle] = useState("");
  const [updateContent, setUpdateContent] = useState("");
  const [updatesSaving, setUpdatesSaving] = useState(false);
  const [updatesMsg, setUpdatesMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Performers state
  const [perfWeek, setPerfWeek] = useState(1);
  const [performers, setPerformers] = useState<PerformerRow[]>([]);
  const [perfSaving, setPerfSaving] = useState(false);
  const [perfMsg, setPerfMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [nextKey, setNextKey] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/hub-league");
    if (res.ok) {
      const data = await res.json();
      setSeason(data.season);
      const rows: StandingRow[] = (data.standings ?? []).map(
        (s: HubStanding, i: number) => ({
          _key: i,
          team_name: s.team_name,
          played: s.played,
          won: s.won,
          lost: s.lost,
          tied: s.tied,
          no_result: s.no_result,
          points: s.points,
          nrr: s.nrr,
        })
      );
      setStandings(rows);
      setNextKey(rows.length);

      // Load all updates
      const updRes = await fetch(
        `/api/hub-league/updates-list?season_id=${data.season?.id ?? ""}`
      );
      // Fallback: use allUpdates from GET if extra endpoint not available
      setUpdates([...(data.pastUpdates ?? []), ...(data.latestUpdate ? [data.latestUpdate] : [])]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    // Initialize performers with default categories
    setPerformers(
      DEFAULT_CATEGORIES.map((cat) => ({
        category: cat,
        player_name: "",
        team_name: "",
        value: "",
        match_context: "",
      }))
    );
  }, [loadData]);

  // --- Standings ---
  function addStandingRow() {
    setStandings((prev) => [
      ...prev,
      { _key: nextKey, team_name: "", played: 0, won: 0, lost: 0, tied: 0, no_result: 0, points: 0, nrr: 0 },
    ]);
    setNextKey((k) => k + 1);
  }

  function removeStandingRow(key: number) {
    setStandings((prev) => prev.filter((r) => r._key !== key));
  }

  function updateStanding(key: number, field: keyof StandingRow, value: string | number) {
    setStandings((prev) =>
      prev.map((r) => (r._key === key ? { ...r, [field]: value } : r))
    );
  }

  async function saveStandings() {
    if (!season) return;
    setStandingsSaving(true);
    setStandingsMsg(null);
    const res = await fetch("/api/hub-league/standings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ season_id: season.id, standings }),
    });
    const data = await res.json();
    setStandingsMsg(res.ok ? { ok: true, text: "Standings saved!" } : { ok: false, text: data.error });
    setStandingsSaving(false);
  }

  // --- Updates ---
  async function submitUpdate(publish: boolean) {
    if (!season || !updateTitle || !updateContent) return;
    setUpdatesSaving(true);
    setUpdatesMsg(null);
    const res = await fetch("/api/hub-league/updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        season_id: season.id,
        week_number: weekNum,
        type: updateType,
        title: updateTitle,
        content: updateContent,
        published: publish,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setUpdatesMsg({ ok: true, text: publish ? "Published!" : "Saved as draft." });
      setUpdates((prev) => [data, ...prev]);
      setUpdateTitle("");
      setUpdateContent("");
    } else {
      setUpdatesMsg({ ok: false, text: data.error });
    }
    setUpdatesSaving(false);
  }

  async function togglePublish(update: HubUpdate) {
    const res = await fetch(`/api/hub-league/updates/${update.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !update.published }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUpdates((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    }
  }

  // --- Performers ---
  function addPerformerRow() {
    setPerformers((prev) => [
      ...prev,
      { category: "", player_name: "", team_name: "", value: "", match_context: "" },
    ]);
  }

  function removePerformerRow(i: number) {
    setPerformers((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updatePerformer(i: number, field: keyof PerformerRow, value: string) {
    setPerformers((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  async function savePerformers() {
    if (!season) return;
    setPerfSaving(true);
    setPerfMsg(null);
    const filtered = performers.filter((p) => p.player_name && p.category);
    const res = await fetch("/api/hub-league/performers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ season_id: season.id, week_number: perfWeek, performers: filtered }),
    });
    const data = await res.json();
    setPerfMsg(res.ok ? { ok: true, text: "Performers saved!" } : { ok: false, text: data.error });
    setPerfSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-vv-violet" size={32} />
      </div>
    );
  }

  const sortedUpdates = [...updates].sort(
    (a, b) => b.week_number - a.week_number || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900">Hub League Admin</h1>
        {season && (
          <p className="text-gray-500 mt-1">
            {season.name} · {season.age_group}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8 w-fit">
        {(["standings", "updates", "performers"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
              tab === t ? "bg-white shadow text-vv-violet" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "updates" ? "Weekly Post" : t === "performers" ? "Top Performers" : "Standings"}
          </button>
        ))}
      </div>

      {/* ── Standings Tab ── */}
      {tab === "standings" && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {["Team", "P", "W", "L", "T", "NR", "Pts", "NRR", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 font-semibold text-gray-500 border-b border-gray-200"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row._key} className="border-b border-gray-100">
                    <td className="px-2 py-1">
                      <input
                        className="border border-gray-200 rounded px-2 py-1 w-36 text-sm"
                        value={row.team_name}
                        onChange={(e) => updateStanding(row._key, "team_name", e.target.value)}
                        placeholder="Team name"
                      />
                    </td>
                    {(["played", "won", "lost", "tied", "no_result", "points"] as const).map((f) => (
                      <td key={f} className="px-2 py-1">
                        <input
                          type="number"
                          className="border border-gray-200 rounded px-2 py-1 w-14 text-sm text-center"
                          value={row[f]}
                          onChange={(e) => updateStanding(row._key, f, parseInt(e.target.value) || 0)}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="0.001"
                        className="border border-gray-200 rounded px-2 py-1 w-20 text-sm text-center"
                        value={row.nrr}
                        onChange={(e) => updateStanding(row._key, "nrr", parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <button
                        onClick={() => removeStandingRow(row._key)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={addStandingRow}
              className="flex items-center gap-1 text-sm text-vv-violet hover:underline"
            >
              <Plus size={14} /> Add Team
            </button>
            <button
              onClick={saveStandings}
              disabled={standingsSaving}
              className="btn-primary flex items-center gap-2 ml-auto"
            >
              {standingsSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Standings
            </button>
          </div>
          {standingsMsg && (
            <p className={`mt-3 text-sm ${standingsMsg.ok ? "text-green-600" : "text-red-600"}`}>
              {standingsMsg.text}
            </p>
          )}
        </div>
      )}

      {/* ── Weekly Post Tab ── */}
      {tab === "updates" && (
        <div className="space-y-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">New Post</h2>
            <div className="flex gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Week</label>
                <input
                  type="number"
                  min={1}
                  value={weekNum}
                  onChange={(e) => setWeekNum(parseInt(e.target.value) || 1)}
                  className="border border-gray-200 rounded-lg px-3 py-2 w-20 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Type</label>
                <select
                  value={updateType}
                  onChange={(e) => setUpdateType(e.target.value as typeof updateType)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {UPDATE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Title</label>
              <input
                type="text"
                value={updateTitle}
                onChange={(e) => setUpdateTitle(e.target.value)}
                placeholder="e.g. Week 1 Preview"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Content</label>
              <textarea
                value={updateContent}
                onChange={(e) => setUpdateContent(e.target.value)}
                rows={8}
                placeholder="Write your update here..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => submitUpdate(false)}
                disabled={updatesSaving || !updateTitle || !updateContent}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-40"
              >
                {updatesSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Draft
              </button>
              <button
                onClick={() => submitUpdate(true)}
                disabled={updatesSaving || !updateTitle || !updateContent}
                className="btn-primary flex items-center gap-2"
              >
                {updatesSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Publish
              </button>
            </div>
            {updatesMsg && (
              <p className={`text-sm ${updatesMsg.ok ? "text-green-600" : "text-red-600"}`}>
                {updatesMsg.text}
              </p>
            )}
          </div>

          {/* Existing posts */}
          {sortedUpdates.length > 0 && (
            <div>
              <h2 className="font-semibold text-gray-700 mb-3">All Posts</h2>
              <div className="space-y-2">
                {sortedUpdates.map((u) => (
                  <div
                    key={u.id}
                    className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3"
                  >
                    <span className="text-xs text-gray-400 w-14 shrink-0">Wk {u.week_number}</span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                        u.type === "preview"
                          ? "bg-violet-100 text-violet-700"
                          : u.type === "saturday"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {u.type === "preview" ? "Preview" : u.type === "saturday" ? "Saturday" : "Sunday"}
                    </span>
                    <span className="text-sm text-gray-800 font-medium flex-1 truncate">{u.title}</span>
                    <button
                      onClick={() => togglePublish(u)}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
                        u.published
                          ? "bg-green-50 text-green-700 hover:bg-red-50 hover:text-red-600"
                          : "bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-700"
                      }`}
                    >
                      {u.published ? <Eye size={12} /> : <EyeOff size={12} />}
                      {u.published ? "Published" : "Draft"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Top Performers Tab ── */}
      {tab === "performers" && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Week</label>
              <input
                type="number"
                min={1}
                value={perfWeek}
                onChange={(e) => setPerfWeek(parseInt(e.target.value) || 1)}
                className="border border-gray-200 rounded-lg px-3 py-2 w-20 text-sm"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["Category", "Player Name", "Team", "Value", "Context (optional)", ""].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-semibold text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {performers.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-2 py-1">
                      <input
                        className="border border-gray-200 rounded px-2 py-1 w-40 text-sm"
                        value={row.category}
                        onChange={(e) => updatePerformer(i, "category", e.target.value)}
                        placeholder="Category"
                        list="categories-list"
                      />
                      <datalist id="categories-list">
                        {DEFAULT_CATEGORIES.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="border border-gray-200 rounded px-2 py-1 w-36 text-sm"
                        value={row.player_name}
                        onChange={(e) => updatePerformer(i, "player_name", e.target.value)}
                        placeholder="Player name"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="border border-gray-200 rounded px-2 py-1 w-32 text-sm"
                        value={row.team_name}
                        onChange={(e) => updatePerformer(i, "team_name", e.target.value)}
                        placeholder="Team"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="border border-gray-200 rounded px-2 py-1 w-24 text-sm"
                        value={row.value}
                        onChange={(e) => updatePerformer(i, "value", e.target.value)}
                        placeholder="45 runs"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        className="border border-gray-200 rounded px-2 py-1 w-44 text-sm"
                        value={row.match_context}
                        onChange={(e) => updatePerformer(i, "match_context", e.target.value)}
                        placeholder="vs Team X"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <button
                        onClick={() => removePerformerRow(i)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={addPerformerRow}
              className="flex items-center gap-1 text-sm text-vv-violet hover:underline"
            >
              <Plus size={14} /> Add Row
            </button>
            <button
              onClick={savePerformers}
              disabled={perfSaving}
              className="btn-primary flex items-center gap-2 ml-auto"
            >
              {perfSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Performers
            </button>
          </div>
          {perfMsg && (
            <p className={`text-sm ${perfMsg.ok ? "text-green-600" : "text-red-600"}`}>
              {perfMsg.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
