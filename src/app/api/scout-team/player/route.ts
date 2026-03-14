import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";

export const maxDuration = 120;

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

function parseBattingTable($: cheerio.CheerioAPI, table: Element): BattingStats {
  const stats: BattingStats = {
    matches: 0, innings: 0, runs: 0,
    battingAvg: 0, strikeRate: 0, highScore: 0,
    fifties: 0, twentyFives: 0,
  };

  $(table).find("tr").each((_, row) => {
    const cells = $(row).find("th, td").map((_, c) => $(c).text().trim()).get();
    if (cells.length < 4) return;
    const format = cells[0];
    // Skip header rows and non-data rows
    if (
      format === "Format" || format === "" ||
      format.toLowerCase().includes("view statistics") ||
      format.toLowerCase().includes("loading") ||
      format.toLowerCase() === "practice"
    ) return;

    // Accumulate across all formats
    stats.matches    += parseInt(cells[1]) || 0;
    stats.innings    += parseInt(cells[2]) || 0;
    stats.runs       += parseInt(cells[4]) || 0;
    stats.highScore   = Math.max(stats.highScore, parseInt(cells[5]?.replace("*", "")) || 0);
    stats.fifties    += parseInt(cells[9]) || 0;
    stats.twentyFives += parseInt(cells[8]) || 0;
  });

  if (stats.innings > 0) {
    // Recalculate avg and SR from aggregated data if possible
    // We'll use the last row's values as a fallback if we can't aggregate
  }

  // Re-parse to get proper avg/SR from the aggregated "Total" row if present,
  // otherwise compute from the accumulated runs
  let totalBalls = 0;
  let notOuts = 0;
  $(table).find("tr").each((_, row) => {
    const cells = $(row).find("th, td").map((_, c) => $(c).text().trim()).get();
    if (cells.length < 4) return;
    const format = cells[0];
    if (
      format === "Format" || format === "" ||
      format.toLowerCase().includes("view statistics") ||
      format.toLowerCase().includes("loading") ||
      format.toLowerCase() === "practice"
    ) return;
    totalBalls += parseInt(cells[3]) || 0;
    notOuts += parseInt(cells[7]) || 0; // NO column
  });

  const outs = stats.innings - notOuts;
  stats.battingAvg = outs > 0 ? parseFloat((stats.runs / outs).toFixed(2)) : stats.runs > 0 ? stats.runs : 0;
  stats.strikeRate = totalBalls > 0 ? parseFloat(((stats.runs / totalBalls) * 100).toFixed(2)) : 0;

  return stats;
}

function parseBowlingTable($: cheerio.CheerioAPI, table: Element): BowlingStats {
  const stats: BowlingStats = {
    matches: 0, wickets: 0, economy: 0,
    bowlingAvg: 0, bbf: "", overs: 0,
  };

  let totalRuns = 0;
  let totalOvers = 0;

  $(table).find("tr").each((_, row) => {
    const cells = $(row).find("th, td").map((_, c) => $(c).text().trim()).get();
    if (cells.length < 4) return;
    const format = cells[0];
    if (
      format === "Format" || format === "" ||
      format.toLowerCase().includes("view statistics") ||
      format.toLowerCase().includes("loading") ||
      format.toLowerCase() === "practice"
    ) return;

    stats.matches += parseInt(cells[1]) || 0;
    // Overs in cricket notation e.g. 3.4 = 3 overs 4 balls
    const oversRaw = parseFloat(cells[2]) || 0;
    const fullOvers = Math.floor(oversRaw);
    const balls = Math.round((oversRaw - fullOvers) * 10);
    const decimalOvers = fullOvers + balls / 6;
    totalOvers += decimalOvers;
    totalRuns += parseInt(cells[4]) || 0;
    stats.wickets += parseInt(cells[5]) || 0;

    // BBF: keep the best (most wickets, then fewest runs)
    const bbfCell = cells[7] || "";
    if (bbfCell && bbfCell !== "-" && bbfCell !== "0/0") {
      if (!stats.bbf) {
        stats.bbf = bbfCell;
      } else {
        const [w1] = stats.bbf.split("/").map(Number);
        const [w2] = bbfCell.split("/").map(Number);
        if (w2 > w1) stats.bbf = bbfCell;
      }
    }
  });

  stats.overs = parseFloat(totalOvers.toFixed(1));
  stats.economy = totalOvers > 0 ? parseFloat((totalRuns / totalOvers).toFixed(2)) : 0;
  stats.bowlingAvg = stats.wickets > 0 ? parseFloat((totalRuns / stats.wickets).toFixed(2)) : 0;

  return stats;
}

// POST {playerId, clubId, baseUrl} → {name, batting, bowling}
export async function POST(req: NextRequest) {
  let body: { playerId?: string; clubId?: string; baseUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { playerId, clubId, baseUrl } = body;
  if (!playerId || !clubId || !baseUrl) {
    return NextResponse.json({ error: "playerId, clubId, baseUrl are required" }, { status: 400 });
  }

  const profileUrl = `${baseUrl}/viewPlayerProfile.do?playerId=${playerId}&clubId=${clubId}`;

  try {
    console.log(`[scout-team/player] Fetching profile: ${profileUrl}`);

    // Try plain fetch first — player profile pages may not require JS rendering
    let html: string;
    try {
      const plainRes = await fetch(profileUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
        signal: AbortSignal.timeout(15_000),
      });
      const plainHtml = await plainRes.text();
      if (plainHtml.includes("Just a moment") || plainHtml.includes("cf-browser-verification")) {
        console.log(`[scout-team/player] CF blocked playerId=${playerId}, falling back to ScrapingAnt`);
        html = await fetchViaScrapingAnt(profileUrl);
      } else {
        html = plainHtml;
      }
    } catch {
      console.log(`[scout-team/player] Plain fetch failed playerId=${playerId}, falling back to ScrapingAnt`);
      html = await fetchViaScrapingAnt(profileUrl);
    }
    const $ = cheerio.load(html);

    // Find batting table: header row contains "NO" and "Balls" columns
    let battingTable: Element | null = null;
    let bowlingTable: Element | null = null;

    $("table").each((_, table) => {
      const headerText = $(table).find("tr").first().text();
      if (!battingTable && headerText.includes("Balls") && headerText.includes("NO")) {
        battingTable = table;
      }
      if (!bowlingTable && headerText.includes("Wkts") && headerText.includes("Econ")) {
        bowlingTable = table;
      }
    });

    const batting: BattingStats = battingTable
      ? parseBattingTable($, battingTable)
      : { matches: 0, innings: 0, runs: 0, battingAvg: 0, strikeRate: 0, highScore: 0, fifties: 0, twentyFives: 0 };

    const bowling: BowlingStats = bowlingTable
      ? parseBowlingTable($, bowlingTable)
      : { matches: 0, wickets: 0, economy: 0, bowlingAvg: 0, bbf: "", overs: 0 };

    console.log(`[scout-team/player] Done playerId=${playerId}: ${batting.innings} innings, ${bowling.wickets} wkts`);
    return NextResponse.json({ batting, bowling });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scout-team/player] Error for playerId=${playerId}:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
