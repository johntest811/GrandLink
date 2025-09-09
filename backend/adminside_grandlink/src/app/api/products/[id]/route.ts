import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Product not found" }, { status: 404 });
  }
  return NextResponse.json({ product: data });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await req.json();
  const { data, error } = await supabase
    .from("products")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Update failed" }, { status: 400 });
  }
  return NextResponse.json({ product: data });
}