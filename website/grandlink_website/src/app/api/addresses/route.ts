import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gijnybivawnsilzqegik.supabase.co";
const SUPA_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!SUPA_SERVICE_ROLE) console.warn("Missing SUPABASE_SERVICE_ROLE_KEY in env");

const supabaseAdmin = createClient(SUPA_URL, SUPA_SERVICE_ROLE);

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, full_name, phone, address, is_default } = body;
    if (!id) return NextResponse.json({ error: "missing address id" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("addresses")
      .update({
        full_name,
        phone,
        address,
        is_default
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // notify the user (server-side) through notifyServers endpoint
    const siteBase = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:3000`;
    await fetch(`${siteBase}/api/notifyServers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "address_updated",
        user_id: data.user_id,
        title: "Address updated",
        message: "Your saved address was updated. If this was not you, contact support."
      }),
    }).catch(e => console.error("notifyServers call failed:", e));

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error("addresses PATCH error", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}