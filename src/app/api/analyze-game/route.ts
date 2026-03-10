import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { scrapeScorecard } from "@/lib/scraper";

export const maxDuration = 60;
import { scorecardDataToTeamInputs, analyzeTeam, type TeamInput } from "@/lib/analyze";

export const maxDuration = 60;

const anthropic = new Anthropic();

function formatScorecardForPrompt(teamInput: TeamInput, opponent: string): string {
  const batting = teamInput.batters
    .map((b) => {
      const dismissal = b.notOut ? "not out" : b.bowlerName ? `b ${b.bowlerName}` : "out";
      return `  ${b.name} — ${b.runs} runs off ${b.balls} balls (SR ${b.strikeRate.toFixed(0)}), ${dismissal}`;
    })
    .join("\n");

  const bowling = teamInput.bowlers
    .map((b) => `  ${b.name} — ${b.overs} overs, ${b.wickets} wkt${b.wickets !== 1 ? "s" : ""}, ${b.runs} runs (econ ${b.economy.toFixed(2)})`)
    .join("\n");

  return `${teamInput.name} vs ${opponent}\n\nBatting:\n${batting}\n\nBowling:\n${bowling}`;
}

async function generateNarrative(
  teamInput: TeamInput,
  opponent: string,
  date: string,
  competition: string,
  notes: string
): Promise<string> {
  const scorecard = formatScorecardForPrompt(teamInput, opponent);
  const prompt = `You are a cricket coach's assistant helping analyze a match for a girls cricket team.

${date ? `Date: ${date}` : ""}${competition ? `\nCompetition: ${competition}` : ""}

Scorecard:
${scorecard}

Coach's Observations:
${notes}

Write a brief coaching analysis (3–5 sentences) that weaves in the coach's specific observations, highlights the most impactful performances, and identifies one or two concrete development areas. Be encouraging and specific. Write in flowing prose — no bullet points.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

export async function POST(req: NextRequest) {
  const { teamName, url, notes } = await req.json();

  if (!teamName || !url) {
    return NextResponse.json(
      { error: "teamName and url are required" },
      { status: 400 }
    );
  }
  if (!url.includes("cricclubs.com")) {
    return NextResponse.json(
      { error: "Only CricClubs URLs are supported" },
      { status: 400 }
    );
  }

  try {
    const data = await scrapeScorecard(url);
    const teamInputs = scorecardDataToTeamInputs(data);

    if (teamInputs.length === 0) {
      return NextResponse.json(
        { error: "Could not parse innings from scorecard. Check the URL." },
        { status: 400 }
      );
    }

    const teamInput = teamInputs.find(
      (t) =>
        t.name.toLowerCase().includes(teamName.toLowerCase()) ||
        teamName.toLowerCase().includes(t.name.toLowerCase())
    );

    if (!teamInput) {
      return NextResponse.json(
        {
          error: `Team "${teamName}" not found in scorecard. Teams found: ${teamInputs
            .map((t) => t.name)
            .join(", ")}`,
        },
        { status: 400 }
      );
    }

    const opponent =
      teamInputs.find((t) => t.name !== teamInput.name)?.name ?? "Unknown";
    const teamReport = analyzeTeam(teamInput);

    let narrative: string | null = null;
    if (notes?.trim() && process.env.ANTHROPIC_API_KEY) {
      narrative = await generateNarrative(
        teamInput,
        opponent,
        data.match.date,
        data.match.competition,
        notes.trim()
      );
    }

    return NextResponse.json({
      teamReport,
      opponent,
      date: data.match.date,
      competition: data.match.competition,
      narrative,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[analyze-game] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
