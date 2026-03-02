import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase";
import type { ChatMessage } from "@/lib/types";

const client = new Anthropic();

async function getCricketContext(): Promise<string> {
  try {
    const supabase = createServerClient();
    const [{ data: batting }, { data: bowling }, { data: matches }] = await Promise.all([
      supabase.from("batting_stats").select("*").limit(20),
      supabase.from("bowling_stats").select("*").limit(20),
      supabase
        .from("matches")
        .select("*, home_team:teams!home_team_id(name), away_team:teams!away_team_id(name)")
        .eq("status", "completed")
        .order("date", { ascending: false })
        .limit(10),
    ]);

    const sections: string[] = [];

    if (batting?.length) {
      sections.push(
        "TOP BATTING STATS:\n" +
          batting
            .map(
              (p) =>
                `${p.player_name}: ${p.runs} runs in ${p.innings} innings, avg ${p.average}, SR ${p.strike_rate}, HS ${p.highest_score}`
            )
            .join("\n")
      );
    }

    if (bowling?.length) {
      sections.push(
        "TOP BOWLING STATS:\n" +
          bowling
            .map(
              (p) =>
                `${p.player_name}: ${p.wickets} wickets in ${p.innings} innings, avg ${p.average}, econ ${p.economy}, best ${p.best_bowling}`
            )
            .join("\n")
      );
    }

    if (matches?.length) {
      sections.push(
        "RECENT MATCHES:\n" +
          matches
            .map(
              (m) =>
                `${m.home_team?.name} vs ${m.away_team?.name} on ${m.date}: ${m.result ?? "No result"}`
            )
            .join("\n")
      );
    }

    return sections.join("\n\n");
  } catch {
    return "";
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        message:
          "The AI chatbot requires an Anthropic API key. Please add ANTHROPIC_API_KEY to your .env.local file.",
      },
      { status: 200 }
    );
  }

  const { messages }: { messages: ChatMessage[] } = await req.json();
  const context = await getCricketContext();

  const systemPrompt = `You are a helpful cricket assistant for Bay Area Girls Cricket, a women's cricket organization in the San Francisco Bay Area.

You have access to the following live data from our database:
${context || "No match data available yet."}

Answer questions about:
- Player performance and statistics
- Match results and analysis
- Cricket rules and terminology
- Girls cricket in the Bay Area
- How to get started with cricket

Be concise, friendly, and enthusiastic about girls cricket. If asked about something not in the data, say so honestly.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "Sorry, I couldn't respond.";

    return NextResponse.json({ message: text });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message: `Error: ${message}` }, { status: 500 });
  }
}
