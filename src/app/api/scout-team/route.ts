import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const maxDuration = 120;

async function fetchViaScrapingAnt(targetUrl: string, browser = false): Promise<string> {
  const apiKey = process.env.SCRAPINGANT_API_KEY;
  if (!apiKey) throw new Error("SCRAPINGANT_API_KEY not set");
  const endpoint = new URL("https://api.scrapingant.com/v2/general");
  endpoint.searchParams.set("url", targetUrl);
  endpoint.searchParams.set("x-api-key", apiKey);
  endpoint.searchParams.set("browser", browser ? "true" : "false");
  endpoint.searchParams.set("proxy_country", "US");
  const timeout = browser ? 55_000 : 20_000;
  const res = await fetch(endpoint.toString(), { signal: AbortSignal.timeout(timeout) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ScrapingAnt error ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.text();
}

async function fetchPage(targetUrl: string): Promise<string> {
  // 1. Plain fetch (instant, no credits)
  try {
    const res = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
      signal: AbortSignal.timeout(10_000),
    });
    const html = await res.text();
    if (!html.includes("Just a moment") && !html.includes("cf-browser-verification")) {
      console.log(`[fetchPage] plain fetch succeeded: ${targetUrl}`);
      return html;
    }
  } catch { /* fall through */ }

  // 2. ScrapingAnt proxy (no browser, ~3s)
  try {
    const html = await fetchViaScrapingAnt(targetUrl, false);
    if (!html.includes("Just a moment") && !html.includes("cf-browser-verification")) {
      console.log(`[fetchPage] ScrapingAnt proxy succeeded: ${targetUrl}`);
      return html;
    }
  } catch { /* fall through */ }

  // 3. ScrapingAnt browser (~55s) — last resort
  console.log(`[fetchPage] falling back to ScrapingAnt browser: ${targetUrl}`);
  return fetchViaScrapingAnt(targetUrl, true);
}

// Returns team name, player list, and the info needed to construct player profile URLs
export async function POST(req: NextRequest) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url } = body;
  if (!url || !url.includes("cricclubs.com") || !url.includes("viewTeam.do")) {
    return NextResponse.json({ error: "URL must be a CricClubs viewTeam.do link" }, { status: 400 });
  }

  try {
    const parsedUrl = new URL(url);
    const clubId = parsedUrl.searchParams.get("clubId") ?? "";
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    const leagueSlug = pathParts[0] ?? "";
    const baseUrl = `${parsedUrl.origin}/${leagueSlug}`;

    console.log(`[scout-team/roster] Fetching: ${url}`);
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const titleText = $("title").text().trim();
    const teamName = titleText.includes(" - ") ? titleText.split(" - ")[0].trim() : titleText;

    const players: Array<{ id: string; name: string }> = [];

    // Extract player ID from the profile link href, not the row number in sorting_1
    $("a[href*='viewPlayerProfile.do']").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const match = href.match(/[?&]playerId=(\d+)/);
      if (!match) return;
      const id = match[1];
      const name = $(el).text().replace(/\s+/g, " ").trim();
      if (id && name && !players.find((p) => p.id === id)) {
        players.push({ id, name });
      }
    });

    // Fallback: try sorting_1 column if no profile links found
    if (players.length === 0) {
      $("td.sorting_1").each((_, el) => {
        const idText = $(el).text().trim();
        const name = $(el).next("td").text().replace(/\s+/g, " ").trim();
        if (idText && name && /^\d+$/.test(idText)) {
          players.push({ id: idText, name });
        }
      });
    }

    if (players.length === 0) {
      return NextResponse.json({ error: "No players found on team page" }, { status: 422 });
    }

    console.log(`[scout-team/roster] Found ${players.length} players on "${teamName}"`);
    return NextResponse.json({ teamName, players, clubId, baseUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[scout-team/roster] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
