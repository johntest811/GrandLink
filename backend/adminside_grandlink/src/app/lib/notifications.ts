import { supabase } from "@/app/Clients/Supabase/SupabaseClients";

export type NotificationType = "stock" | "change" | "system" | "task" | "general";

export async function createNotification(params: {
  title?: string | null;
  message: string;
  recipient_role?: string | null; // "Admin", "Sales Manager", "all"
  recipient_id?: string | null; // specific admin/user uuid
  type?: NotificationType;
}) {
  try {
    const payload = {
      title: params.title ?? null,
      message: params.message,
      type: params.type ?? "general",
      recipient_role: params.recipient_role ?? "all",
      recipient_id: params.recipient_id ?? null,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("notifications").insert(payload);
    if (error) console.error("createNotification error:", error);
  } catch (err) {
    console.error("createNotification exception:", err);
  }
}