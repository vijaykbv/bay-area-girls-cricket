import { NextRequest, NextResponse } from "next/server";
import { scrapeScorecard } from "@/lib/scraper";

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url || !url.includes("cricclubs.com")) {
    return NextResponse.json({ error: "Invalid CricClubs URL" }, { status: 400 });
  }

  try {
    const data = await scrapeScorecard(url);
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
