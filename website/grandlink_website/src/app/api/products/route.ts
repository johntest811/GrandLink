import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, category, image1, image2, image3, image4, image5");
  if (error) {
    // Log error for debugging
    console.error("Supabase API error:", error);
    return NextResponse.json([], { status: 200 });
  }
  // Always return an array
  return NextResponse.json(data ?? [], { status: 200 });
}
