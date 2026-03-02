/**
 * Selection & role analysis based on Hub selection criteria:
 * - Positions 1–4: pure batters. Must NOT bowl. Judged on runs + strike rate.
 * - Positions 5+: bowlers / lower order. Judged on wickets, average, economy.
 * - No all-rounders: hub selectors don't care about dual contributions.
 * - Fitness and fielding are non-negotiable (not assessed here — no data).
 */

import type { Innings, ScorecardData, InningsData } from "./types";

// ── Internal normalised types ─────────────────────────────────────────────────

export interface BatterInput {
  name: string;
  position: number;
  runs: number;
  balls: number;
  strikeRate: number;
  notOut: boolean;
  /** Abbreviated bowler name stored on dismissal row (e.g. "Arush P") */
  bowlerName?: string;
}

export interface BowlerInput {
  name: string;
  overs: number;
  wickets: number;
  runs: number;
  economy: number;
}

export interface TeamInput {
  name: string;
  batters: BatterInput[];
  bowlers: BowlerInput[];
  /** The opposing team's batters — used to compute which batting positions each bowler dismissed */
  opposingBatters: BatterInput[];
}

// ── Output types ──────────────────────────────────────────────────────────────

export type NoteType = "positive" | "concern" | "info";

export interface PerformanceNote {
  player: string;
  note: string;
  type: NoteType;
}

export interface PlayerSummary {
  name: string;
  battingPosition?: number;
  runs?: number;
  balls?: number;
  strikeRate?: number;
  notOut?: boolean;
  overs?: number;
  wickets?: number;
  bowlingRuns?: number;
  economy?: number;
  /** Dismissal breakdown by batting-position tier */
  topOrderWickets?: number;
  middleOrderWickets?: number;
  lowerOrderWickets?: number;
}

export interface OpportunityFlag {
  name: string;
  battingPosition: number;
  balls: number;
  avgBalls: number;
  overs: number;
  avgOvers: number;
}

export interface TeamReport {
  teamName: string;
  /** Batted positions 1–4 */
  topOrder: PlayerSummary[];
  /** Batted 5+ AND bowled */
  bowlers: PlayerSummary[];
  /** Batted 5+ but did NOT bowl (exposure / non-bowling middle order) */
  middleOrderOnly: PlayerSummary[];
  /** Bowled but didn't appear in batting (last men in / didn't bat) */
  bowlerOnly: PlayerSummary[];
  /** Top-4 batters who also appeared in bowling — rule violation */
  ruleConflicts: Array<{ name: string; battingPos: number; overs: number }>;
  notes: PerformanceNote[];
  rulesFollowed: boolean;
  /** Median SR across all batters who faced ≥6 balls */
  medianStrikeRate: number;
  /** Players who bowled more than average overs AND faced more than average balls */
  opportunityFlags: OpportunityFlag[];
  /** Team averages used for opportunity calculation */
  avgBallsFaced: number;
  avgOversBowled: number;
}

export interface MatchReport {
  teams: TeamReport[];
}

// ── Thresholds ────────────────────────────────────────────────────────────────

// SR thresholds are now relative to the team's median SR (not fixed values)
const SR_WELL_BELOW_MEDIAN  = 0.75;  // < 75% of median → concern for top order
const SR_WELL_ABOVE_MEDIAN  = 1.30;  // > 130% of median → positive
const MIN_BALLS_FOR_SR      = 6;     // minimum balls faced to include in SR analysis

const TOP_ORDER_RUNS_GOOD  = 30;   // 30+ from top order: solid contribution
const BOWLER_WICKETS_GREAT = 3;    // 3+ wickets: outstanding
const BOWLER_ECON_GREAT    = 4.5;  // below this: very tight
const BOWLER_ECON_CONCERN  = 7.0;  // above this: too expensive
const MIN_OVERS_TO_JUDGE   = 2;    // don't flag 0 wickets from 1 over

// ── Adapters from DB Innings[] ────────────────────────────────────────────────

/**
 * Convert DB Innings[] to TeamInput[] for analysis.
 * Team batting in innings 1 bowled in innings 2, and vice-versa.
 */
export function inningsToTeamInputs(innings: Innings[]): TeamInput[] {
  const inn1 = innings.find((i) => i.innings_number === 1);
  const inn2 = innings.find((i) => i.innings_number === 2);
  if (!inn1 || !inn2) return [];

  const mapBatters = (perfs: typeof inn1.batting_performances): BatterInput[] =>
    (perfs ?? [])
      .sort((a, b) => a.batting_order - b.batting_order)
      .map((b) => ({
        name: b.player_name,
        position: b.batting_order,
        runs: b.runs,
        balls: b.balls,
        strikeRate: b.strike_rate ?? 0,
        notOut: b.not_out,
        bowlerName: b.bowler_name ?? undefined,
      }));

  const mapBowlers = (perfs: typeof inn1.bowling_performances): BowlerInput[] =>
    (perfs ?? []).map((b) => ({
      name: b.player_name,
      overs: b.overs,
      wickets: b.wickets,
      runs: b.runs,
      economy: b.economy ?? 0,
    }));

  const team1Batters = mapBatters(inn1.batting_performances);
  const team2Batters = mapBatters(inn2.batting_performances);

  return [
    {
      name: inn1.team?.name ?? "Team 1",
      batters: team1Batters,
      bowlers: mapBowlers(inn2.bowling_performances),
      // Team 1's bowlers bowled to Team 2's batters (inn2)
      opposingBatters: team2Batters,
    },
    {
      name: inn2.team?.name ?? "Team 2",
      batters: team2Batters,
      bowlers: mapBowlers(inn1.bowling_performances),
      // Team 2's bowlers bowled to Team 1's batters (inn1)
      opposingBatters: team1Batters,
    },
  ];
}

// ── Core analysis ─────────────────────────────────────────────────────────────

export function analyzeMatch(innings: Innings[]): MatchReport {
  const teams = inningsToTeamInputs(innings);
  return { teams: teams.map(analyzeTeam) };
}

export function analyzeTeam(team: TeamInput): TeamReport {
  const notes: PerformanceNote[] = [];
  const ruleConflicts: TeamReport["ruleConflicts"] = [];

  const bowlerMap = new Map(
    team.bowlers.map((b) => [norm(b.name), b])
  );
  const batterMap = new Map(
    team.batters.map((b) => [norm(b.name), b])
  );

  // ── Median SR across all batters who faced enough balls ───────────────────
  const medianStrikeRate = calcMedian(
    team.batters
      .filter((b) => b.balls >= MIN_BALLS_FOR_SR)
      .map((b) => b.strikeRate)
  );

  const topOrder: PlayerSummary[] = [];
  const bowlers: PlayerSummary[] = [];
  const middleOrderOnly: PlayerSummary[] = [];
  const seenBowlers = new Set<string>();

  // ── Analyse each batter ───────────────────────────────────────────────────

  for (const batter of team.batters) {
    const bowlerData = bowlerMap.get(norm(batter.name));
    seenBowlers.add(norm(batter.name));

    const summary: PlayerSummary = {
      name: batter.name,
      battingPosition: batter.position,
      runs: batter.runs,
      balls: batter.balls,
      strikeRate: batter.strikeRate,
      notOut: batter.notOut,
      overs: bowlerData?.overs,
      wickets: bowlerData?.wickets,
      bowlingRuns: bowlerData?.runs,
      economy: bowlerData?.economy,
    };

    if (batter.position <= 4) {
      // ── Top-order batter ────────────────────────────────────────────────
      topOrder.push(summary);

      if (bowlerData) {
        ruleConflicts.push({
          name: batter.name,
          battingPos: batter.position,
          overs: bowlerData.overs,
        });
        notes.push({
          player: batter.name,
          note: `Batted at #${batter.position} AND bowled ${bowlerData.overs} overs — top-order batters should not bowl per Hub rules.`,
          type: "concern",
        });
      }

      // SR notes for top-order batters, relative to team median
      if (batter.balls >= MIN_BALLS_FOR_SR && medianStrikeRate > 0) {
        const pct = Math.round((batter.strikeRate / medianStrikeRate) * 100);
        if (batter.strikeRate < medianStrikeRate * SR_WELL_BELOW_MEDIAN) {
          notes.push({
            player: batter.name,
            note: `SR ${batter.strikeRate.toFixed(0)} is ${pct}% of the team median (${medianStrikeRate.toFixed(0)}). Top-order batters must bat faster — risk being moved down.`,
            type: "concern",
          });
        } else if (batter.strikeRate > medianStrikeRate * SR_WELL_ABOVE_MEDIAN) {
          notes.push({
            player: batter.name,
            note: `SR ${batter.strikeRate.toFixed(0)} is ${pct}% of the team median (${medianStrikeRate.toFixed(0)}). Exactly the intent from the top order.`,
            type: "positive",
          });
        }
      }

      if (batter.runs >= TOP_ORDER_RUNS_GOOD) {
        notes.push({
          player: batter.name,
          note: `${batter.runs}${batter.notOut ? "*" : ""} runs — meaningful top-order contribution.`,
          type: "positive",
        });
      } else if (batter.runs < 10 && batter.balls >= 6) {
        notes.push({
          player: batter.name,
          note: `${batter.runs} runs from ${batter.balls} balls — not enough to register with selectors.`,
          type: "concern",
        });
      }
    } else {
      // ── Middle / lower order ────────────────────────────────────────────
      if (bowlerData) {
        bowlers.push(summary);
      } else {
        middleOrderOnly.push(summary);
      }

      // For lower-order batters, only note standout SR (positive only — bowlers
      // aren't penalised for low batting SR; Hub only cares about their wickets)
      if (batter.balls >= MIN_BALLS_FOR_SR && medianStrikeRate > 0 &&
          batter.strikeRate > medianStrikeRate * SR_WELL_ABOVE_MEDIAN) {
        const pct = Math.round((batter.strikeRate / medianStrikeRate) * 100);
        notes.push({
          player: batter.name,
          note: `SR ${batter.strikeRate.toFixed(0)} — ${pct}% of team median (${medianStrikeRate.toFixed(0)}). Strong lower-order hitting.`,
          type: "positive",
        });
      }
    }
  }

  // ── Bowlers who didn't appear in batting (or batted very late / DNB) ─────
  const bowlerOnly: PlayerSummary[] = [];
  for (const bowler of team.bowlers) {
    if (seenBowlers.has(norm(bowler.name))) continue;
    bowlerOnly.push({
      name: bowler.name,
      overs: bowler.overs,
      wickets: bowler.wickets,
      bowlingRuns: bowler.runs,
      economy: bowler.economy,
    });
  }

  // ── Dismissal breakdown: which batting tiers did each bowler dismiss? ─────
  type Tier = { top: number; mid: number; low: number };
  const dismissalMap = new Map<string, Tier>();

  for (const opposing of team.opposingBatters) {
    if (opposing.notOut || !opposing.bowlerName) continue;
    const matched = team.bowlers.find((b) =>
      bowlerNamesMatch(b.name, opposing.bowlerName!)
    );
    if (!matched) continue;
    const key = norm(matched.name);
    if (!dismissalMap.has(key)) dismissalMap.set(key, { top: 0, mid: 0, low: 0 });
    const t = dismissalMap.get(key)!;
    if (opposing.position <= 4) t.top++;
    else if (opposing.position <= 7) t.mid++;
    else t.low++;
  }

  // Attach counts to existing PlayerSummary entries
  for (const ps of [...bowlers, ...bowlerOnly]) {
    const tier = dismissalMap.get(norm(ps.name));
    if (tier) {
      ps.topOrderWickets    = tier.top;
      ps.middleOrderWickets = tier.mid;
      ps.lowerOrderWickets  = tier.low;
    }
  }

  // ── Bowling performance notes ─────────────────────────────────────────────
  const allBowlers = [...team.bowlers];
  for (const bowler of allBowlers) {
    // Skip top-4 batters — already noted their conflict above
    const batter = batterMap.get(norm(bowler.name));
    if (batter && batter.position <= 4) continue;

    if (bowler.wickets >= BOWLER_WICKETS_GREAT) {
      notes.push({
        player: bowler.name,
        note: `${bowler.wickets}/${bowler.runs} in ${bowler.overs} overs — outstanding. This is a Hub-selection-worthy performance.`,
        type: "positive",
      });
    } else if (bowler.wickets === 2) {
      notes.push({
        player: bowler.name,
        note: `${bowler.wickets}/${bowler.runs} in ${bowler.overs} overs — decent haul; needs more to stand out.`,
        type: "info",
      });
    } else if (bowler.overs >= MIN_OVERS_TO_JUDGE && bowler.wickets === 0) {
      notes.push({
        player: bowler.name,
        note: `0 wickets from ${bowler.overs} overs — hub selectors only care about wickets. This won't register.`,
        type: "concern",
      });
    }

    if (bowler.overs >= MIN_OVERS_TO_JUDGE) {
      if (bowler.economy <= BOWLER_ECON_GREAT) {
        // Only add economy note if not already praised for wickets
        if (bowler.wickets < BOWLER_WICKETS_GREAT) {
          notes.push({
            player: bowler.name,
            note: `Economy ${bowler.economy.toFixed(2)} — very tight bowling. Combine this with wickets and you have a Hub bowler.`,
            type: "positive",
          });
        }
      } else if (bowler.economy >= BOWLER_ECON_CONCERN) {
        notes.push({
          player: bowler.name,
          note: `Economy ${bowler.economy.toFixed(2)} — too expensive. Hub bowlers can't concede at this rate.`,
          type: "concern",
        });
      }
    }

    // Dismissal tier note — only when we have 2+ wickets and breakdown data
    const tier = dismissalMap.get(norm(bowler.name));
    if (tier && bowler.wickets >= 2) {
      const tierNote = dismissalTierNote(tier, bowler.wickets);
      if (tierNote) {
        notes.push({ player: bowler.name, note: tierNote, type: "info" });
      }
    }
  }

  // ── Opportunity concentration ─────────────────────────────────────────────
  // Players who got above-average batting time AND above-average bowling load
  const battersWithBalls = team.batters.filter((b) => b.balls > 0);
  const bowlersWithOvers = team.bowlers.filter((b) => b.overs > 0);

  const avgBallsFaced = battersWithBalls.length > 0
    ? battersWithBalls.reduce((s, b) => s + b.balls, 0) / battersWithBalls.length
    : 0;
  const avgOversBowled = bowlersWithOvers.length > 0
    ? bowlersWithOvers.reduce((s, b) => s + b.overs, 0) / bowlersWithOvers.length
    : 0;

  const opportunityFlags: OpportunityFlag[] = [];
  for (const batter of team.batters) {
    if (batter.balls <= avgBallsFaced) continue;
    const bowlerData = bowlerMap.get(norm(batter.name));
    if (!bowlerData || bowlerData.overs <= avgOversBowled) continue;
    opportunityFlags.push({
      name: batter.name,
      battingPosition: batter.position,
      balls: batter.balls,
      avgBalls: Math.round(avgBallsFaced),
      overs: bowlerData.overs,
      avgOvers: parseFloat(avgOversBowled.toFixed(1)),
    });
  }

  return {
    teamName: team.name,
    topOrder,
    bowlers,
    middleOrderOnly,
    bowlerOnly,
    ruleConflicts,
    notes,
    rulesFollowed: ruleConflicts.length === 0,
    medianStrikeRate,
    opportunityFlags,
    avgBallsFaced: Math.round(avgBallsFaced),
    avgOversBowled: parseFloat(avgOversBowled.toFixed(1)),
  };
}

// ── Console formatter ─────────────────────────────────────────────────────────

export function formatMatchReport(report: MatchReport, matchTitle?: string): string {
  const pad = (s: string, n: number) => s.length >= n ? s : s + " ".repeat(n - s.length);
  const lines: string[] = [
    "",
    "╔══════════════════════════════════════════════════════════════╗",
    `║  SELECTION & ROLE ANALYSIS${matchTitle ? `: ${matchTitle}`.slice(0, 34).padEnd(35) : "".padEnd(35)}║`,
    "╚══════════════════════════════════════════════════════════════╝",
  ];

  for (const team of report.teams) {
    lines.push(`\n── ${team.teamName.toUpperCase()} ${"─".repeat(Math.max(0, 54 - team.teamName.length))}`);
    if (team.medianStrikeRate > 0) {
      lines.push(`   Team median SR: ${team.medianStrikeRate.toFixed(1)}`);
    }

    // Top order batters
    lines.push("\nTOP ORDER BATTERS  (positions 1–4 — Hub rule: do NOT bowl)");
    for (const p of team.topOrder) {
      const srStr = (p.balls ?? 0) >= 6
        ? `SR ${(p.strikeRate ?? 0).toFixed(0)}`
        : "SR —  ";
      const runsStr = `${p.runs ?? 0}${p.notOut ? "*" : " "} (${p.balls ?? 0}b, ${srStr})`;
      const bowlFlag = p.overs
        ? `  ⚠  ALSO BOWLED ${p.overs} ov`
        : "  ✓  Did not bowl";
      lines.push(`  #${p.battingPosition}  ${pad(p.name, 28)} ${pad(runsStr, 22)}${bowlFlag}`);
    }

    // Bowlers
    if (team.bowlers.length > 0 || team.bowlerOnly.length > 0) {
      lines.push("\nBOWLERS  (positions 5+ — Hub rule: wickets are everything)");
      const allBowlers = [...team.bowlers, ...team.bowlerOnly];
      for (const p of allBowlers) {
        const batStr = p.battingPosition
          ? `bat #${p.battingPosition}: ${p.runs ?? 0}${p.notOut ? "*" : ""}(${p.balls ?? 0}b)  `
          : pad("", 22);
        const wkStr = `${p.wickets ?? 0}/${p.bowlingRuns ?? 0} (${p.overs ?? 0}ov, Econ ${(p.economy ?? 0).toFixed(2)})`;
        lines.push(`  ${pad(p.name, 30)} ${batStr} bowl: ${wkStr}`);
      }
    }

    // Middle order who only batted
    if (team.middleOrderOnly.length > 0) {
      lines.push("\nMIDDLE ORDER  (batted 5+ but did not bowl — game exposure)");
      for (const p of team.middleOrderOnly) {
        const srStr = (p.balls ?? 0) >= 6 ? `, SR ${(p.strikeRate ?? 0).toFixed(0)}` : "";
        lines.push(`  #${p.battingPosition}  ${pad(p.name, 28)} ${p.runs ?? 0}${p.notOut ? "*" : " "} (${p.balls ?? 0}b${srStr})`);
      }
    }

    // Opportunity concentration
    if (team.opportunityFlags.length > 0) {
      lines.push(`\nOPPORTUNITY CONCENTRATION  (avg balls: ${team.avgBallsFaced}, avg overs: ${team.avgOversBowled})`);
      for (const f of team.opportunityFlags) {
        lines.push(
          `  ⚑  ${pad(f.name, 28)}  batted ${f.balls}b (avg ${f.avgBalls})  bowled ${f.overs}ov (avg ${f.avgOvers})`
        );
      }
    }

    // Rule compliance
    lines.push("");
    if (team.rulesFollowed) {
      lines.push("  ✅  RULE COMPLIANCE: Top-order batters stayed in their lane.");
    } else {
      lines.push("  ❌  RULE CONFLICTS:");
      for (const c of team.ruleConflicts) {
        lines.push(`       → ${c.name} batted at #${c.battingPos} AND bowled ${c.overs} overs`);
      }
    }

    // Notes
    if (team.notes.length > 0) {
      lines.push("");
      const positives = team.notes.filter((n) => n.type === "positive");
      const concerns  = team.notes.filter((n) => n.type === "concern");
      const infos     = team.notes.filter((n) => n.type === "info");

      if (positives.length) {
        lines.push("  Highlights:");
        for (const n of positives) lines.push(`    ✓  ${n.player}: ${n.note}`);
      }
      if (infos.length) {
        lines.push("  Notes:");
        for (const n of infos) lines.push(`    ·  ${n.player}: ${n.note}`);
      }
      if (concerns.length) {
        lines.push("  Concerns:");
        for (const n of concerns) lines.push(`    ✗  ${n.player}: ${n.note}`);
      }
    }
  }

  lines.push("\n" + "═".repeat(64) + "\n");
  return lines.join("\n");
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function norm(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Match a full bowler name against an abbreviated dismissal string.
 * e.g. "Arush Parab" matches "Arush P"; also handles exact match.
 */
function bowlerNamesMatch(fullName: string, abbrev: string): boolean {
  if (norm(fullName) === norm(abbrev)) return true;
  const f = norm(fullName).split(" ");
  const a = norm(abbrev).split(" ");
  if (f.length < 2 || a.length < 2) return false;
  // First names must match exactly
  if (f[0] !== a[0]) return false;
  // Last token of abbrev must be a single initial matching the full last name
  const lastAbbrev = a[a.length - 1];
  const lastFull   = f[f.length - 1];
  return lastAbbrev.length === 1 && lastFull.startsWith(lastAbbrev);
}

/**
 * Generate a note describing which batting tiers the bowler targeted.
 * Returns null when the breakdown isn't meaningful enough to surface.
 */
function dismissalTierNote(
  tier: { top: number; mid: number; low: number },
  totalWickets: number
): string | null {
  const parts: string[] = [];
  if (tier.top  > 0) parts.push(`${tier.top} top-order`);
  if (tier.mid  > 0) parts.push(`${tier.mid} middle-order`);
  if (tier.low  > 0) parts.push(`${tier.low} lower-order`);
  if (parts.length === 0) return null;

  const breakdown = parts.join(", ");

  if (tier.top === totalWickets) {
    return `All ${totalWickets} wickets were top-order batters (${breakdown}) — dismissing the opposition's best.`;
  }
  if (tier.low === totalWickets) {
    return `All ${totalWickets} wickets were lower-order (${breakdown}) — quality of dismissals matters to selectors.`;
  }
  return `Wickets spread across the order: ${breakdown}.`;
}

function calcMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// ── Scorecard → TeamInput adapter (no DB required) ────────────────────────────

export function scorecardDataToTeamInputs(data: ScorecardData): TeamInput[] {
  const inn1 = data.innings.find((i) => i.innings_number === 1);
  const inn2 = data.innings.find((i) => i.innings_number === 2);
  if (!inn1 || !inn2) return [];

  const mapBatters = (inn: InningsData): BatterInput[] =>
    inn.batting.map((b, idx) => ({
      name: b.name.replace(/[\*†‡]+$/, "").trim(),
      position: idx + 1,
      runs: b.runs,
      balls: b.balls,
      strikeRate: b.strike_rate,
      notOut: !b.how_out || b.how_out.toLowerCase() === "not out" || b.how_out.trim() === "",
      bowlerName: b.bowler || undefined,
    }));

  const mapBowlers = (inn: InningsData): BowlerInput[] =>
    inn.bowling.map((b) => ({
      name: b.name,
      overs: b.overs,
      wickets: b.wickets,
      runs: b.runs,
      economy: b.economy,
    }));

  const team1Batters = mapBatters(inn1);
  const team2Batters = mapBatters(inn2);

  return [
    {
      name: inn1.team,
      batters: team1Batters,
      bowlers: mapBowlers(inn2),
      opposingBatters: team2Batters,
    },
    {
      name: inn2.team,
      batters: team2Batters,
      bowlers: mapBowlers(inn1),
      opposingBatters: team1Batters,
    },
  ];
}

// ── Tournament aggregation ─────────────────────────────────────────────────────

export interface TournamentPlayerStats {
  name: string;
  gamesAppeared: number;
  battingInnings: number;
  totalRuns: number;
  totalBallsFaced: number;
  battingPositions: number[];
  notOuts: number;
  bowlingAppearances: number;
  totalWickets: number;
  /** Sum of overs in cricket notation (e.g. 3.4 = 3 overs 4 balls) */
  totalOvers: number;
  totalBowlingRuns: number;
  ruleConflicts: number;
}

/** Sum two cricket-notation over values (e.g. 3.4 + 2.5 → 7.3) */
function addCricketOvers(a: number, b: number): number {
  const aFull = Math.floor(a);
  const aBalls = Math.round((a - aFull) * 10);
  const bFull = Math.floor(b);
  const bBalls = Math.round((b - bFull) * 10);
  const totalBalls = aFull * 6 + aBalls + bFull * 6 + bBalls;
  return Math.floor(totalBalls / 6) + (totalBalls % 6) / 10;
}

/** Convert cricket-notation overs to real decimal overs (e.g. 3.4 → 3.667) */
export function oversToDecimal(cricketOvers: number): number {
  const full = Math.floor(cricketOvers);
  const balls = Math.round((cricketOvers - full) * 10);
  return full + balls / 6;
}

/** Convert a single TeamReport to TournamentPlayerStats[] for use in the chart. */
export function teamReportToPlayerStats(report: TeamReport): TournamentPlayerStats[] {
  const seen = new Set<string>();
  const result: TournamentPlayerStats[] = [];

  const process = (p: PlayerSummary) => {
    const key = p.name.toLowerCase().trim();
    if (seen.has(key)) return;
    seen.add(key);
    result.push({
      name: p.name,
      gamesAppeared: 1,
      battingInnings: p.battingPosition !== undefined ? 1 : 0,
      totalRuns: p.runs ?? 0,
      totalBallsFaced: p.balls ?? 0,
      battingPositions: p.battingPosition !== undefined ? [p.battingPosition] : [],
      notOuts: p.notOut ? 1 : 0,
      bowlingAppearances: (p.overs !== undefined && p.overs > 0) ? 1 : 0,
      totalWickets: p.wickets ?? 0,
      totalOvers: p.overs ?? 0,
      totalBowlingRuns: p.bowlingRuns ?? 0,
      ruleConflicts: 0,
    });
  };

  [...report.topOrder, ...report.bowlers, ...report.middleOrderOnly, ...report.bowlerOnly]
    .forEach(process);

  return result;
}

export function aggregateTournamentTeam(teamReports: TeamReport[]): TournamentPlayerStats[] {
  const playerMap = new Map<string, TournamentPlayerStats>();

  const getOrCreate = (name: string): TournamentPlayerStats => {
    const key = name.toLowerCase().replace(/[\*†‡]+$/, "").replace(/\s+/g, " ").trim();
    if (!playerMap.has(key)) {
      playerMap.set(key, {
        name,
        gamesAppeared: 0,
        battingInnings: 0,
        totalRuns: 0,
        totalBallsFaced: 0,
        battingPositions: [],
        notOuts: 0,
        bowlingAppearances: 0,
        totalWickets: 0,
        totalOvers: 0,
        totalBowlingRuns: 0,
        ruleConflicts: 0,
      });
    }
    return playerMap.get(key)!;
  };

  for (const report of teamReports) {
    const seen = new Set<string>();

    const processPlayer = (p: PlayerSummary) => {
      const key = p.name.toLowerCase().trim();
      if (seen.has(key)) return;
      seen.add(key);

      const stats = getOrCreate(p.name);
      stats.gamesAppeared++;

      if (p.battingPosition !== undefined) {
        stats.battingInnings++;
        stats.totalRuns += p.runs ?? 0;
        stats.totalBallsFaced += p.balls ?? 0;
        stats.battingPositions.push(p.battingPosition);
        if (p.notOut) stats.notOuts++;
      }

      if (p.overs !== undefined && p.overs > 0) {
        stats.bowlingAppearances++;
        stats.totalWickets += p.wickets ?? 0;
        stats.totalOvers = addCricketOvers(stats.totalOvers, p.overs);
        stats.totalBowlingRuns += p.bowlingRuns ?? 0;
      }
    };

    [...report.topOrder, ...report.bowlers, ...report.middleOrderOnly, ...report.bowlerOnly]
      .forEach(processPlayer);

    for (const conflict of report.ruleConflicts) {
      getOrCreate(conflict.name).ruleConflicts++;
    }
  }

  return Array.from(playerMap.values()).sort(
    (a, b) => b.totalRuns - a.totalRuns || b.totalWickets - a.totalWickets
  );
}
