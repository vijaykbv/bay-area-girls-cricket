import { NextRequest, NextResponse } from "next/server";
import { scrapeScorecard } from "@/lib/scraper";
import { scorecardDataToTeamInputs, analyzeTeam } from "@/lib/analyze";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { teamName, url } = await req.json();

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

    return NextResponse.json({
      teamReport,
      opponent,
      date: data.match.date,
      competition: data.match.competition,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[analyze-game] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
