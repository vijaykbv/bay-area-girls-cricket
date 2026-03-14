import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 300;

// ── ScrapingAnt fetcher ───────────────────────────────────────────────────────

async function fetchViaScrapingAnt(targetUrl: string): Promise<string> {
  const apiKey = process.env.SCRAPINGANT_API_KEY;
  if (!apiKey) throw new Error("SCRAPINGANT_API_KEY not set");
  const endpoint = new URL("https://api.scrapingant.com/v2/general");
  endpoint.searchParams.set("url", targetUrl);
  endpoint.searchParams.set("x-api-key", apiKey);
  endpoint.searchParams.set("browser", "true");
  endpoint.searchParams.set("proxy_country", "US");
  const res = await fetch(endpoint.toString(), { signal: AbortSignal.timeout(90_000) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ScrapingAnt error ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.text();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface BattingStats {
  matches: number;
  innings: number;
  runs: number;
  battingAvg: number;
  strikeRate: number;
  highScore: number;
  fifties: number;
  twentyFives: number;
}

interface BowlingStats {
  matches: number;
  wickets: number;
  economy: number;
  bowlingAvg: number;
  bbf: string;
  overs: number;
}

interface PlayerResult {
  name: string;
  batting: BattingStats;
  bowling: BowlingStats;
}

// ── Team page parser ──────────────────────────────────────────────────────────

function parseTeamPage(html: string): { teamName: string; players: Array<{ id: string; name: string }> } {
  const $ = cheerio.load(html);

  // Team name from <title>, e.g. "USCA RIVER HAWKS - USA Cricket..."
  const titleText = $("title").text().trim();
  const teamName = titleText.includes(" - ") ? titleText.split(" - ")[0].trim() : titleText;

  const players: Array<{ id: string; name: string }> = [];

  // Player rows: <td class="sorting_1">ID</td><td>Name</td>
  $("td.sorting_1").each((_, el) => {
    const idText = $(el).text().trim();
    const nameTd = $(el).next("td");
    const name = nameTd.text().replace(/\s+/g, " ").trim();
    if (idText && name && /^\d+$/.test(idText)) {
      players.push({ id: idText, name });
    }
  });

  return { teamName, players };
}

// ── Player profile parser ─────────────────────────────────────────────────────

const NOISE_FORMATS = new Set(["view statistics by :", "loading ...", "practice"]);

function isValidFormat(format: string): boolean {
  const lower = format.toLowerCase().trim();
  if (!lower) return false;
  if (NOISE_FORMATS.has(lower)) return false;
  return true;
}

function cricketOversToDecimal(overs: number): number {
  return Math.floor(overs) + (overs % 1) * 10 / 6;
}

function parsePlayerProfile(html: string): { batting: BattingStats; bowling: BowlingStats } {
  const $ = cheerio.load(html);

  // Accumulator for batting
  let batMatches = 0, batInnings = 0, batNO = 0, batRuns = 0, batBalls = 0;
  let batHS = 0, batFifties = 0, batTwentyFives = 0;

  // Accumulator for bowling
  let bowlMatches = 0, bowlWickets = 0, bowlRuns = 0, bowlOversRaw = 0;
  let bowlBBFWickets = -1, bowlBBFRuns = 999999;
  let bowlBBF = "";

  // Find all tables; look for header rows containing "NO" + "Balls" (batting)
  // or "Wkts" + "Econ" (bowling)
  $("table").each((_, table) => {
    const $table = $(table);

    // Find the header row
    const headerRow = $table.find("tr").first();
    const headerText = headerRow.text();

    const isBatting = headerText.includes("NO") && headerText.includes("Balls");
    const isBowling = headerText.includes("Wkts") && headerText.includes("Econ");

    if (!isBatting && !isBowling) return;

    // Data rows use <th> tags per spec
    $table.find("tr").each((rowIdx, row) => {
      if (rowIdx === 0) return; // skip header row

      const cells = $(row).find("th").toArray();
      if (cells.length < 2) return;

      const format = $(cells[0]).text().trim();
      if (!isValidFormat(format)) return;

      if (isBatting && cells.length >= 12) {
        const mat   = parseInt($(cells[1]).text().trim()) || 0;
        const inns  = parseInt($(cells[2]).text().trim()) || 0;
        const no    = parseInt($(cells[3]).text().trim()) || 0;
        const runs  = parseInt($(cells[4]).text().trim()) || 0;
        const balls = parseInt($(cells[5]).text().trim()) || 0;
        // Ave = cells[6], SR = cells[7]
        const hsText = $(cells[8]).text().trim();
        const hs     = parseInt(hsText.replace(/\*$/, "")) || 0;
        // 100s = cells[9] (skip)
        const fifties      = parseInt($(cells[10]).text().trim()) || 0;
        const twentyFives  = parseInt($(cells[11]).text().trim()) || 0;

        batMatches      += mat;
        batInnings      += inns;
        batNO           += no;
        batRuns         += runs;
        batBalls        += balls;
        if (hs > batHS) batHS = hs;
        batFifties      += fifties;
        batTwentyFives  += twentyFives;
      }

      if (isBowling && cells.length >= 10) {
        const mat     = parseInt($(cells[1]).text().trim()) || 0;
        // cells[2] = Inns
        const overs   = parseFloat($(cells[3]).text().trim()) || 0;
        const runs    = parseInt($(cells[4]).text().trim()) || 0;
        const wkts    = parseInt($(cells[5]).text().trim()) || 0;
        const bbfText = $(cells[6]).text().trim(); // BBF e.g. "3/12"

        bowlMatches  += mat;
        bowlWickets  += wkts;
        bowlRuns     += runs;
        bowlOversRaw += overs;

        // Pick best BBF: most wickets, then fewest runs
        if (bbfText && bbfText.includes("/")) {
          const parts = bbfText.split("/");
          const w = parseInt(parts[0]) || 0;
          const r = parseInt(parts[1]) || 999999;
          if (w > bowlBBFWickets || (w === bowlBBFWickets && r < bowlBBFRuns)) {
            bowlBBFWickets = w;
            bowlBBFRuns    = r;
            bowlBBF        = bbfText;
          }
        }
      }
    });
  });

  // Compute batting derived stats
  const denominator = batInnings - batNO;
  const battingAvg  = denominator > 0 ? batRuns / denominator : 0;
  const strikeRate  = batBalls > 0 ? (batRuns / batBalls) * 100 : 0;

  // Compute bowling derived stats
  const oversDecimal = cricketOversToDecimal(bowlOversRaw);
  const economy      = oversDecimal > 0 ? bowlRuns / oversDecimal : 0;
  const bowlingAvg   = bowlWickets > 0 ? bowlRuns / bowlWickets : 0;

  return {
    batting: {
      matches:      batMatches,
      innings:      batInnings,
      runs:         batRuns,
      battingAvg:   Math.round(battingAvg * 100) / 100,
      strikeRate:   Math.round(strikeRate * 100) / 100,
      highScore:    batHS,
      fifties:      batFifties,
      twentyFives:  batTwentyFives,
    },
    bowling: {
      matches:    bowlMatches,
      wickets:    bowlWickets,
      economy:    Math.round(economy * 100) / 100,
      bowlingAvg: Math.round(bowlingAvg * 100) / 100,
      bbf:        bowlBBF || "",
      overs:      Math.round(oversDecimal * 100) / 100,
    },
  };
}

// ── Claude prompt builder ─────────────────────────────────────────────────────

function buildClaudePrompt(teamName: string, players: PlayerResult[]): string {
  const isBatter = (p: PlayerResult) => p.batting.innings >= 2;
  const isBowler = (p: PlayerResult) => p.bowling.wickets >= 1 || p.bowling.overs >= 2;

  const lines = players.map((p) => {
    const batPart = isBatter(p)
      ? `Batting: ${p.batting.runs} runs in ${p.batting.innings} innings, avg ${p.batting.battingAvg.toFixed(1)}, SR ${p.batting.strikeRate.toFixed(1)}, HS ${p.batting.highScore}`
      : "Batting: limited data";

    const bowlPart = isBowler(p)
      ? `Bowling: ${p.bowling.wickets} wkts in ${p.bowling.matches} matches, econ ${p.bowling.economy.toFixed(2)}, avg ${p.bowling.bowlingAvg.toFixed(1)}${p.bowling.bbf ? `, BBF ${p.bowling.bbf}` : ""}`
      : "Bowling: limited data";

    return `${p.name} | ${batPart} | ${bowlPart}`;
  });

  return `Analyze these cricket players for a scouting report. Identify the top batting threats, top bowling threats, and provide brief strategic advice for a team facing them.

Team: ${teamName}
Players:
${lines.join("\n")}

Write a scouting report with:
1. Top 3 batting threats (cite specific stats)
2. Top 3 bowling threats (cite specific stats)
3. One sentence of strategic advice

Be concise and specific. Use a coaching voice. No bullet points — flowing prose with clear sections.`;
}

// ── Main POST handler ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url } = body;

  if (!url || !url.includes("cricclubs.com") || !url.includes("viewTeam.do")) {
    return NextResponse.json(
      { error: "URL must be a CricClubs viewTeam.do link" },
      { status: 400 }
    );
  }

  try {
    // Extract clubId and base URL
    const parsedUrl = new URL(url);
    const clubId = parsedUrl.searchParams.get("clubId") ?? "";

    // Base URL = origin + pathname up to and including the league slug
    // e.g. https://cricclubs.com/USACricketJunior
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    // pathname is like /USACricketJunior/viewTeam.do — take first segment
    const leagueSlug = pathParts[0] ?? "";
    const baseUrl = `${parsedUrl.origin}/${leagueSlug}`;

    console.log(`[scout-team] Fetching team page: ${url}`);
    const teamHtml = await fetchViaScrapingAnt(url);
    const { teamName, players: playerList } = parseTeamPage(teamHtml);

    if (playerList.length === 0) {
      return NextResponse.json({ error: "No players found on team page" }, { status: 422 });
    }

    console.log(`[scout-team] Found ${playerList.length} players on team "${teamName}"`);

    // Fetch player profiles in batches of 3 to stay within ScrapingAnt concurrency limits.
    // All-parallel (11 at once) causes most requests to fail on the free tier.
    const BATCH_SIZE = 3;
    const profileResults: PlayerResult[] = [];

    for (let i = 0; i < playerList.length; i += BATCH_SIZE) {
      const batch = playerList.slice(i, i + BATCH_SIZE);
      console.log(`[scout-team] Fetching profiles batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(playerList.length / BATCH_SIZE)} (${batch.map(p => p.name).join(", ")})`);
      const batchResults = await Promise.all(
        batch.map(async (p) => {
          const profileUrl = `${baseUrl}/viewPlayer.do?playerId=${p.id}&clubId=${clubId}`;
          try {
            const html = await fetchViaScrapingAnt(profileUrl);
            const stats = parsePlayerProfile(html);
            return { name: p.name, ...stats } as PlayerResult;
          } catch (err) {
            console.warn(`[scout-team] Failed to fetch profile for ${p.name} (id=${p.id}):`, err);
            return {
              name: p.name,
              batting: { matches: 0, innings: 0, runs: 0, battingAvg: 0, strikeRate: 0, highScore: 0, fifties: 0, twentyFives: 0 },
              bowling: { matches: 0, wickets: 0, economy: 0, bowlingAvg: 0, bbf: "", overs: 0 },
            } as PlayerResult;
          }
        })
      );
      profileResults.push(...batchResults);
    }

    // Call Claude for analysis
    const anthropic = new Anthropic();
    const prompt = buildClaudePrompt(teamName, profileResults);

    console.log("[scout-team] Calling Claude for analysis...");
    const claudeResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const analysis =
      claudeResponse.content[0].type === "text" ? claudeResponse.content[0].text : "";

    return NextResponse.json({
      teamName,
      players: profileResults,
      analysis,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[scout-team] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
