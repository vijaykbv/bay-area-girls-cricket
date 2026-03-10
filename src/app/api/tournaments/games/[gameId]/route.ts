import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { gameId: string } }
) {
  const { notes } = await req.json();
  if (typeof notes !== "string") {
    return NextResponse.json({ error: "notes must be a string" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("tournament_games")
    .update({ manager_notes: notes })
    .eq("id", params.gameId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
