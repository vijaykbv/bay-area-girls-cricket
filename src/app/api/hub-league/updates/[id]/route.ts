import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await req.json();
  const supabase = createServerClient();

  const updates: Record<string, unknown> = {};

  if (typeof body.published === "boolean") {
    updates.published = body.published;
    updates.published_at = body.published ? new Date().toISOString() : null;
  }
  if (body.title !== undefined) updates.title = body.title;
  if (body.content !== undefined) updates.content = body.content;
  if (body.type !== undefined) updates.type = body.type;
  if (body.week_number !== undefined) updates.week_number = body.week_number;

  const { data, error } = await supabase
    .from("hub_updates")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
