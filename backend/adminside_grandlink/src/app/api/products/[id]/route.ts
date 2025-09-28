import { NextResponse } from "next/server";
import { supabase } from "@/app/Clients/Supabase/SupabaseClients";
import { createNotification } from "@/app/lib/notifications";
import { logActivity } from "@/app/lib/activity";

// GET single product
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ product }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/products/[id] error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT (update) single product
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Get current admin from request headers or session
    const authHeader = req.headers.get("authorization");
    let currentAdmin = null;
    try {
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: sessionData } = await supabase.auth.getUser(token);
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
      // Continue without admin info if auth fails
    }

    // Get product before update for comparison
    const { data: before, error: fetchErr } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !before) {
      return NextResponse.json({ error: fetchErr?.message ?? "Product not found" }, { status: 404 });
    }

    // Update the product
    const { data, error } = await supabase
      .from("products")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log changes for activity tracking
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

    if (changed.length && currentAdmin) {
      // Log activity
      await logActivity({
        admin_id: currentAdmin.id,
        admin_name: currentAdmin.username,
        action: "update",
        entity_type: "product",
        entity_id: id,
        details: `Updated product "${before.name}": ${summaryParts.join("; ")}`,
      });

      // Create notifications for important changes
      const productName = before.name;
      const message = `Product "${productName}" updated: ${summaryParts.join("; ")}`;
      await createNotification({
        title: "Product Updated",
        message,
        recipient_role: "Sales Manager",
        type: "change",
      });
      await createNotification({
        title: "Product Updated",
        message,
        recipient_role: "Supervisor",
        type: "change",
      });
    }

    return NextResponse.json({ product: data }, { status: 200 });
  } catch (err: any) {
    console.error("PUT /api/products/[id] error", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE single product
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Get current admin
    const authHeader = req.headers.get("authorization");
    let currentAdmin = null;
    try {
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: sessionData } = await supabase.auth.getUser(token);
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

    // Get product info before deletion
    const { data: product, error: fetchErr } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Delete the product
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log activity
    if (currentAdmin) {
      await logActivity({
        admin_id: currentAdmin.id,
        admin_name: currentAdmin.username,
        action: "delete",
        entity_type: "product",
        entity_id: id,
        details: `Deleted product "${product.name}" (${product.category})`,
      });

      // Notify about deletion
      await createNotification({
        title: "Product Deleted",
        message: `Product "${product.name}" has been deleted by ${currentAdmin.username}`,
        recipient_role: "Sales Manager",
        type: "change",
        priority: "high",
      });
    }

    return NextResponse.json({ message: "Product deleted successfully" }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE /api/products/[id] error", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}