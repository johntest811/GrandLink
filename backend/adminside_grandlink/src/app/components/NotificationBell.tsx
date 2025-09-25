"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "@/app/Clients/Supabase/SupabaseClients";

type Note = {
  id: string | number;
  title?: string | null;
  message: string;
  recipient_role?: string | null;
  recipient_id?: string | null;
  is_read?: boolean;
  created_at?: string;
};

export default function NotificationBell({ adminId, adminRole }: { adminId?: string | null; adminRole?: string | null }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotes = async () => {
    try {
      let res;
      if (adminRole && adminId) {
        const safeRole = String(adminRole).replace(/'/g, "''");
        const safeId = String(adminId).replace(/'/g, "''");
        res = await supabase
          .from("notifications")
          .select("*")
          .or(`recipient_role.eq.'${safeRole}',recipient_id.eq.'${safeId}'`)
          .order("created_at", { ascending: false })
          .limit(20);
      } else if (adminRole) {
        res = await supabase
          .from("notifications")
          .select("*")
          .eq("recipient_role", adminRole)
          .order("created_at", { ascending: false })
          .limit(20);
      } else if (adminId) {
        res = await supabase
          .from("notifications")
          .select("*")
          .eq("recipient_id", adminId)
          .order("created_at", { ascending: false })
          .limit(20);
      } else {
        res = await supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20);
      }

      const { data, error } = res as any;
      if (error) {
        console.error("notifications fetch error", error);
        setNotes([]);
        setUnreadCount(0);
        return;
      }
      setNotes(data || []);
      setUnreadCount((data || []).filter((n: any) => !n.is_read).length);
    } catch (e) {
      console.error("notifications fetch exception", e);
      setNotes([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    fetchNotes();
    const channel = supabase
      .channel("notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => fetchNotes())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications" }, () => fetchNotes())
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch (e) {}
    };
  }, [adminId, adminRole]);

  const markAllRead = async () => {
    try {
      const ids = notes.filter(n => !n.is_read).map(n => n.id);
      if (ids.length === 0) return;
      const { error } = await supabase.from("notifications").update({ is_read: true }).in("id", ids);
      if (error) console.error("markAllRead error", error);
      await fetchNotes();
    } catch (e) {
      console.error("markAllRead exception", e);
    }
  };

  return (
    <div className="relative">
      <button onClick={() => { setOpen(s => !s); if (!open) markAllRead(); }} className="relative p-1 rounded hover:bg-gray-100" aria-label="Notifications">
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && <span className="absolute -top-1 -right-2 bg-red-600 text-white text-xs rounded-full px-1">{unreadCount}</span>}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border rounded shadow-lg z-50 p-2">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium text-black">Notifications</div>
            <button className="text-sm text-blue-600" onClick={markAllRead}>Mark all read</button>
          </div>
          <div className="space-y-2 max-h-64 overflow-auto">
            {notes.length === 0 && <div className="text-sm text-gray-500">No notifications</div>}
            {notes.map(n => (
              <div key={String(n.id)} className={`p-2 rounded ${n.is_read ? "bg-gray-50" : "bg-white"}`}>
                <div className="text-sm font-semibold text-black">{n.title ?? "Update"}</div>
                <div className="text-xs text-gray-500">{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</div>
                <div className="text-sm text-black">{n.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}