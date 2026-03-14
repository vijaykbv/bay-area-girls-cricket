import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

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

    // Try plain fetch first — viewTeam.do may not require JS rendering
    console.log(`[scout-team/roster] Fetching (plain): ${url}`);
    let html: string;
    try {
      const plainRes = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
        signal: AbortSignal.timeout(15_000),
      });
      const plainHtml = await plainRes.text();
      if (plainHtml.includes("Just a moment") || plainHtml.includes("cf-browser-verification")) {
        console.log(`[scout-team/roster] CF blocked, falling back to ScrapingAnt`);
        html = await fetchViaScrapingAnt(url);
      } else {
        html = plainHtml;
      }
    } catch {
      console.log(`[scout-team/roster] Plain fetch failed, falling back to ScrapingAnt`);
      html = await fetchViaScrapingAnt(url);
    }
    const $ = cheerio.load(html);

    const titleText = $("title").text().trim();
    const teamName = titleText.includes(" - ") ? titleText.split(" - ")[0].trim() : titleText;

    const players: Array<{ id: string; name: string }> = [];
    $("td.sorting_1").each((_, el) => {
      const idText = $(el).text().trim();
      const name = $(el).next("td").text().replace(/\s+/g, " ").trim();
      if (idText && name && /^\d+$/.test(idText)) {
        players.push({ id: idText, name });
      }
    });

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
