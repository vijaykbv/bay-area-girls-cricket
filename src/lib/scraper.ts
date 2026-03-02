import * as cheerio from "cheerio";
import type { ScorecardData, InningsData, RawBatting, RawBowling } from "./types";

export async function scrapeScorecard(url: string): Promise<ScorecardData> {
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    const fullScorecardUrl = url.replace("viewScorecard.do", "fullScorecard.do");
    const infoUrl = url.replace("viewScorecard.do", "info.do");

    await page.goto(fullScorecardUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(".match-table-innings", { timeout: 20000, state: "attached" });
    await page.waitForTimeout(1000);
    const scorecardHtml = await page.content();

    await page.goto(infoUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1000);
    const infoHtml = await page.content();

    const { writeFileSync } = await import("fs");
    writeFileSync("/tmp/cricclubs-debug.html", scorecardHtml);
    writeFileSync("/tmp/cricclubs-info.html", infoHtml);

    return parseScorecard(scorecardHtml, infoHtml, url);
  } finally {
    await browser.close();
  }
}

export function parseScorecard(scorecardHtml: string, infoHtml: string, url: string): ScorecardData {
  const $s = cheerio.load(scorecardHtml);
  const $i = cheerio.load(infoHtml);

  // ── Match info from info.do page ────────────────────────────────────────
  const date        = infoTableValue($i, "Match Date")  || infoTableValue($i, "Date")  || todayStr();
  const venue       = infoTableValue($i, "Location")    || infoTableValue($i, "Ground") || infoTableValue($i, "Venue") || "";
  const competition = infoTableValue($i, "Series")      || infoTableValue($i, "League") || infoTableValue($i, "Competition") || "";
  const toss        = infoTableValue($i, "Toss") || "";

  // ── Team names from score-top summary ──────────────────────────────────
  const teamNames: string[] = [];
  $s("span.teamName").each((_, el) => {
    const name = $s(el).clone().find("br").remove().end().text().trim();
    if (name && !teamNames.includes(name)) teamNames.push(name);
  });

  // ── Innings from div.match-table-innings blocks ─────────────────────────
  // Each innings has TWO consecutive .match-table-innings divs: batting then bowling
  const sections = $s(".match-table-innings").toArray();

  const inningsList: InningsData[] = [];
  let inningsNum = 1;
  let i = 0;

  while (i < sections.length && inningsNum <= 2) {
    const section = sections[i];
    const headerText = $s(section).find("thead th[colspan]").first().text().trim();

    if (headerText.toLowerCase().includes("bowling")) {
      // Orphan bowling section — attach to previous innings
      if (inningsList.length > 0 && inningsList[inningsList.length - 1].bowling.length === 0) {
        inningsList[inningsList.length - 1].bowling = parseBowlingSection($s, section);
      }
      i++;
      continue;
    }

    // This is a batting section
    const teamName = extractTeamFromHeader(headerText) || teamNames[inningsNum - 1] || `Team ${inningsNum}`;
    const batting  = parseBattingSection($s, section);
    const total    = extractTotalFromSection($s, section);
    const extras   = extractExtrasNumber($s, section);

    let bowling: RawBowling[] = [];

    // Look ahead for the bowling section (next sibling .match-table-innings that says "Bowling")
    if (i + 1 < sections.length) {
      const nextHeader = $s(sections[i + 1]).find("thead th[colspan]").first().text().trim();
      if (nextHeader.toLowerCase().includes("bowling")) {
        bowling = parseBowlingSection($s, sections[i + 1]);
        i++; // consume the bowling section
      }
    }

    inningsList.push({
      team: teamName,
      innings_number: inningsNum as 1 | 2,
      total,
      batting,
      bowling,
      extras,
    });

    inningsNum++;
    i++;
  }

  const home_team = teamNames[0] || inningsList[0]?.team || "Team 1";
  const away_team = teamNames[1] || inningsList[1]?.team || "Team 2";

  return {
    match: {
      date: parseDate(date),
      venue,
      competition,
      match_type: "T20",
      result: "",
      home_team,
      away_team,
    },
    innings: inningsList,
  };
}

// ── Section parsers ──────────────────────────────────────────────────────────

function parseBattingSection($: cheerio.CheerioAPI, section: cheerio.Element): RawBatting[] {
  const rows = $(section).find("tbody tr").toArray();
  const batting: RawBatting[] = [];

  for (const row of rows) {
    const cells = $(row).find("th, td").toArray();
    if (cells.length < 6) continue;

    // Cell 0: photo cell + player name link + mobile dismissal div
    // Extract name from the <a> tag only (not the div.scorecard-out-text)
    const nameCell = $(cells[0]);
    nameCell.find(".scorecard-out-text").remove();
    const name = nameCell.find("a").first().text().replace(/\s+/g, " ").replace(/\*+$/, "").trim();
    if (!name) continue;
    if (/^(extras?|total|did not bat|dnb|fall of wickets?)/i.test(name)) continue;

    // Cell 1: dismissal text (hidden-phone) — strip hidden video links
    const dismissalCell = $(cells[1]);
    dismissalCell.find("a[style*='none'], a[id]").remove();
    const howOut = dismissalCell.text().replace(/\s+/g, " ").trim();

    const runs   = parseInt($(cells[2]).text().trim()) || 0;
    const balls  = parseInt($(cells[3]).text().trim()) || 0;
    // Cell 4 (fours) may have a hidden link — get just the first text node
    const foursCell = $(cells[4]).clone();
    foursCell.find("a").remove();
    const fours  = parseInt(foursCell.text().trim()) || 0;
    const sixes  = parseInt($(cells[5]).text().trim()) || 0;
    const sr     = parseFloat($(cells[6]).text().trim()) || (balls > 0 ? parseFloat(((runs / balls) * 100).toFixed(2)) : 0);

    const notOut = !howOut || howOut.toLowerCase() === "not out";

    batting.push({
      name,
      how_out: howOut || "not out",
      bowler: extractBowler(howOut),
      runs,
      balls,
      fours,
      sixes,
      strike_rate: sr,
    });
  }

  return batting;
}

function parseBowlingSection($: cheerio.CheerioAPI, section: cheerio.Element): RawBowling[] {
  const rows = $(section).find("tbody tr").toArray();
  const bowling: RawBowling[] = [];

  for (const row of rows) {
    const cells = $(row).find("th, td").toArray();
    if (cells.length < 7) continue;

    // Cell 0: photo (skip). Cell 1: name
    const nameCell = $(cells[1]);
    nameCell.find("a[style*='none'], a[id]").remove();
    const name = nameCell.find("a").first().text().replace(/\s+/g, " ").trim()
              || nameCell.text().replace(/\s+/g, " ").trim();
    if (!name) continue;

    // Columns: [0]photo [1]name [2]O [3]M [4]Dot [5]R [6]W [7]Econ [8]wides
    const overs   = parseFloat($(cells[2]).text().trim()) || 0;
    const maidens = parseInt($(cells[3]).text().trim())   || 0;
    // cell[4] = dot balls (not used for our stats)
    const runs    = parseInt($(cells[5]).text().trim())   || 0;
    const wickets = parseInt($(cells[6]).text().trim())   || 0;
    const economy = parseFloat($(cells[7]).text().trim()) || (overs > 0 ? parseFloat((runs / overs).toFixed(2)) : 0);

    // Wides from the last cell "(3 w)" pattern
    const widesText = cells[8] ? $(cells[8]).text().trim() : "";
    const widesMatch = widesText.match(/(\d+)\s*w/);
    const wides = widesMatch ? parseInt(widesMatch[1]) : 0;

    bowling.push({ name, overs, maidens, runs, wickets, economy, wides, no_balls: 0 });
  }

  return bowling;
}

function extractTotalFromSection($: cheerio.CheerioAPI, section: cheerio.Element): string {
  // Find the Total row in tbody
  let total = "";
  $(section).find("tbody tr").each((_, row) => {
    const text = $(row).text().replace(/\s+/g, " ").trim();
    if (/total/i.test(text)) {
      // Extract "86/9 (22.2 ov)" style from the score-top span, or parse from text
      total = text;
      return false;
    }
  });
  // Also try tfoot
  if (!total) {
    total = $(section).find("tfoot").text().replace(/\s+/g, " ").trim();
  }
  return total;
}

function extractExtrasNumber($: cheerio.CheerioAPI, section: cheerio.Element): string {
  let extras = "0";
  $(section).find("tbody tr").each((_, row) => {
    const text = $(row).text().replace(/\s+/g, " ").trim();
    if (/^extras/i.test(text)) {
      extras = text;
      return false;
    }
  });
  return extras;
}

// ── Utility helpers ───────────────────────────────────────────────────────────

/** Extract team name from heading like "Strikers Jaguars innings (25 overs maximum)" */
function extractTeamFromHeader(text: string): string {
  // Normalize all whitespace (including newlines) to single spaces first
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.replace(/\s*(1st|2nd|first|second)?\s*innings.*$/i, "").trim();
}

/** Lookup a value from the info page <th>Label:</th><th>Value</th> pattern */
function infoTableValue($: cheerio.CheerioAPI, label: string): string {
  let value = "";
  $("tr").each((_, row) => {
    const cells = $(row).find("th, td").toArray();
    if (cells.length >= 2) {
      const cellLabel = $(cells[0]).text().replace(":", "").trim();
      if (cellLabel.toLowerCase() === label.toLowerCase()) {
        value = $(cells[1]).text().replace(/\s+/g, " ").trim();
        return false; // break
      }
    }
  });
  return value;
}

function extractBowler(dismissal: string): string {
  // Find the last " b Name" pattern (covers caught, lbw, stumped, bowled with context)
  const idx = dismissal.lastIndexOf(" b ");
  if (idx !== -1) return dismissal.slice(idx + 3).trim();
  // Handle dismissal starting with "b Name" (simple bowled, no leading context)
  if (/^b\s+\S/i.test(dismissal)) return dismissal.replace(/^b\s+/i, "").trim();
  // Handle "c&b Name" (caught and bowled — same person)
  const cab = dismissal.match(/^c&b\s+(.+)$/i);
  if (cab) return cab[1].trim();
  return "";
}

function parseDate(raw: string): string {
  if (!raw) return todayStr();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // Handle MM/DD/YYYY
  const mdyMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, "0")}-${mdyMatch[2].padStart(2, "0")}`;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return todayStr();
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}
