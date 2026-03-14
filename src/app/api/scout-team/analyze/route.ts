import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  let body: { teamName?: string; playerSummaries?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { teamName, playerSummaries } = body;
  if (!teamName || !playerSummaries) {
    return NextResponse.json({ error: "teamName and playerSummaries are required" }, { status: 400 });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a cricket coach helping scouts analyze an opponent team for a youth girls cricket league.

Team: ${teamName}

Player statistics (career aggregated across all formats):
${playerSummaries}

Write a concise scouting report covering:
1. **Key Threats** — top 2-3 players to watch (batters and bowlers), with specific stats that make them dangerous
2. **Batting Order** — overall batting strength, who opens, who is reliable in the middle
3. **Bowling Attack** — key bowlers, their styles based on economy/wickets, any gaps to exploit
4. **Strategy Tips** — 2-3 actionable tips for our team when facing them

Keep it practical and focused. Use bullet points where helpful. Aim for 250-350 words.`,
        },
      ],
    });

    const analysis = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ analysis });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[scout-team/analyze] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
