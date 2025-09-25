import { NextResponse } from "next/server";
import { supabase } from "@/app/Clients/Supabase/SupabaseClients";
import { createNotification } from "@/app/lib/notifications";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await req.json();

    const { data: before, error: fetchErr } = await supabase.from("products").select("*").eq("id", id).single();
    if (fetchErr || !before) return NextResponse.json({ error: fetchErr?.message ?? "Not found" }, { status: 404 });

    const changed: string[] = [];
    const summaryParts: string[] = [];
    for (const key of Object.keys(body)) {
      const beforeVal = (before as any)[key];
      const afterVal = (body as any)[key];
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        changed.push(key);
        summaryParts.push(`${key}: "${String(beforeVal ?? "")}" → "${String(afterVal ?? "")}"`);
      }
    }

    const { data, error } = await supabase.from("products").update(body).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (changed.length) {
      const productName = (before as any).name ?? id;
      const message = `Product "${productName}" updated: ${summaryParts.join("; ")}`;
      await createNotification({ title: "Product updated", message, recipient_role: "Sales Manager", type: "change" });
      await createNotification({ title: "Product updated", message, recipient_role: "Supervisor", type: "change" });
    }

    return NextResponse.json({ product: data }, { status: 200 });
  } catch (err: any) {
    console.error("PUT /api/products/[id] error", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}