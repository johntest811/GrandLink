'use client';

import React, { useEffect, useState } from "react";
import { supabase } from "@/app/Clients/Supabase/SupabaseClients";
import NotificationBell from "@/app/components/NotificationBell";

type Note = {
  id: string | number;
  title?: string | null;
  message: string;
  recipient_role?: string | null;
  recipient_id?: string | null;
  is_read?: boolean;
  created_at?: string;
};

export default function Dashboard() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);

  const loadAdmin = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getUser();
      const userId = sessionData?.user?.id ?? null;
      if (!userId) return;
      const { data: adminRow } = await supabase.from("admins").select("id, username, position, role").eq("id", userId).single();
      setCurrentAdmin(adminRow);
    } catch (e) {
      console.warn("load admin", e);
    }
  };

  const fetchNotes = async () => {
    try {
      const role = currentAdmin?.position ?? currentAdmin?.role ?? null;
      let res;
      if (role && currentAdmin?.id) {
        const safeRole = String(role).replace(/'/g, "''");
        const safeId = String(currentAdmin.id).replace(/'/g, "''");
        res = await supabase
          .from("notifications")
          .select("*")
          .or(`recipient_role.eq.'${safeRole}',recipient_id.eq.'${safeId}'`)
          .order("created_at", { ascending: false })
          .limit(20);
      } else {
        res = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(20);
      }
      const { data, error } = res as any;
      if (error) {
        console.error("notifications fetch error", error);
        setNotes([]);
        return;
      }
      setNotes(data || []);
    } catch (e) {
      console.error("notifications fetch exception", e);
      setNotes([]);
    }
  };

  useEffect(() => {
    (async () => {
      await loadAdmin();
    })();
  }, []);

  useEffect(() => {
    if (currentAdmin) fetchNotes();
  }, [currentAdmin]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-black">Dashboard</h1>

        {/* small in-page bell so admin sees notifications in dashboard content as well */}
        <div className="flex items-center gap-3">
          <NotificationBell adminId={currentAdmin?.id ?? null} adminRole={currentAdmin?.position ?? currentAdmin?.role ?? "Admin"} />
        </div>
      </div>

      <section className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg font-semibold text-black mb-3">Recent Notifications</h2>
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
      </section>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Users" value="1,234" icon="👥" color="bg-blue-500" />
        <StatCard title="Total Products" value="567" icon="📦" color="bg-green-500" />
        <StatCard title="Total Orders" value="890" icon="🛒" color="bg-purple-500" />
        <StatCard title="Revenue" value="$12,345" icon="💰" color="bg-yellow-500" />
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <ActivityItem 
            title="New Order #1234" 
            description="John Doe placed a new order for $123.45" 
            time="2 hours ago" 
          />
          <ActivityItem 
            title="New User Registration" 
            description="Jane Smith created a new account" 
            time="3 hours ago" 
          />
          <ActivityItem 
            title="Product Update" 
            description="Inventory updated for 5 products" 
            time="5 hours ago" 
          />
          <ActivityItem 
            title="Payment Received" 
            description="Payment of $543.21 received for Order #1233" 
            time="1 day ago" 
          />
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, icon, color }: { title: string; value: string; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`${color} text-white p-3 rounded-full mr-4`}>
          <span className="text-xl">{icon}</span>
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

// Activity Item Component
function ActivityItem({ title, description, time }: { title: string; description: string; time: string }) {
  return (
    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
      <div className="flex justify-between">
        <p className="font-medium">{title}</p>
        <span className="text-sm text-gray-500">{time}</span>
      </div>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
}