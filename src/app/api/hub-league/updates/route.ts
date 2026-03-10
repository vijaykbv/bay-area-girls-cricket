import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { season_id, week_number, type, title, content, published } = await req.json();

  if (!season_id || !week_number || !type || !title || !content) {
    return NextResponse.json({ error: "season_id, week_number, type, title, content required" }, { status: 400 });
  }

  const supabase = createServerClient();

  const row = {
    season_id,
    week_number,
    type,
    title,
    content,
    published: published ?? false,
    published_at: published ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase.from("hub_updates").insert(row).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
