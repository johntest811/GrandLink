import { NextResponse } from "next/server";
import { supabase } from "../../../../../src/app/Clients/Supabase/SupabaseClients"; // adjust if needed

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await (params as any);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("GET /api/products/[id] error", error);
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ product: data }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/products/[id] exception", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    // Next.js requires awaiting params before using its properties
    const { id } = await (params as any);

    const body = await req.json();
    const { data, error } = await supabase
      .from("products")
      .update(body)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ product: data }, { status: 200 });
  } catch (err: any) {
    console.error("PUT /api/products/[id] error", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}