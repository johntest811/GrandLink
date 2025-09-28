import { NextResponse } from "next/server";
import { supabase } from "@/app/Clients/Supabase/SupabaseClients";
import { createNotification } from "@/app/lib/notifications";
import { logActivity } from "@/app/lib/activity";

// GET all products
export async function GET(req: Request) {
  try {
    const { data: products, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ products: products || [] }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/products error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST create new product
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Get current admin
    const authHeader = req.headers.get("authorization");
    let currentAdmin = null;
    try {
      if (authHeader) {
        const { data: sessionData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
        if (sessionData?.user?.id) {
          const { data: adminRow } = await supabase
            .from("admins")
            .select("id, username")
            .eq("id", sessionData.user.id)
            .single();
          currentAdmin = adminRow;
        }
      }
    } catch (e) {
      // Continue without admin info
    }

    const { data: product, error } = await supabase
      .from("products")
      .insert(body)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log activity
    if (currentAdmin) {
      await logActivity({
        admin_id: currentAdmin.id,
        admin_name: currentAdmin.username,
        action: "create",
        entity_type: "product",
        entity_id: product.id,
        details: `Created new product "${product.name}" in category "${product.category}"`,
      });

      // Notify about new product
      await createNotification({
        title: "New Product Added",
        message: `Product "${product.name}" has been added by ${currentAdmin.username}`,
        recipient_role: "Sales Manager",
        type: "change",
      });
    }

    return NextResponse.json({ product }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/products error", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}