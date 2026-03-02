import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const revalidate = 3600;

export async function GET() {
  try {
    const supabase = createServerClient();
    const [{ data: batting }, { data: bowling }] = await Promise.all([
      supabase.from("batting_stats").select("*"),
      supabase.from("bowling_stats").select("*"),
    ]);
    return NextResponse.json({ batting: batting ?? [], bowling: bowling ?? [] });
  } catch (err) {
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
