"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

type Admin = {
  id: string;
  username?: string | null;
  password_hash?: string | null;
  role?: string | null;
  created_at?: string | null;
  email?: string | null;
  status?: string | null;
  last_login?: string | null;
  user_metadata?: any;
};

function getSupabaseClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;
  return createClient(url, key);
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | string>("All");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [actionLoading, setActionLoading] = useState(false);
  const [envMissing, setEnvMissing] = useState(false);

  // selection state for checkboxes
  const [selected, setSelected] = useState<string[]>([]);
  const toggleSelected = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };
  const toggleSelectAllOnPage = () => {
    const pageIds = pageItems.map((i) => i.id);
    const allSelected = pageIds.every((id) => selected.includes(id));
    setSelected((prev) => (allSelected ? prev.filter((id) => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])]));
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  async function fetchAdmins() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error("Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
      setEnvMissing(true);
      setAdmins([]);
      return;
    }

    setEnvMissing(false);
    setLoading(true);

    try {
      const { data, error, status } = await supabase
        .from("admins")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("fetch admins error:", JSON.stringify(error, null, 2), "status:", status);
        setAdmins([]);
      } else {
        const adminsWithLogin = ((data as Admin[]) || []).map((a) => {
          const lastLoginDate = a.last_login ? new Date(a.last_login) : a.created_at ? new Date(a.created_at) : null;
          const diffDays = lastLoginDate ? (new Date().getTime() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24) : Infinity;
          return {
            ...a,
            status: a.status || (diffDays <= 3 ? "Active" : "Inactive"),
            last_login: lastLoginDate ? lastLoginDate.toISOString() : a.last_login,
          } as Admin;
        });
        setAdmins(adminsWithLogin);
      }
    } catch (err) {
      console.error("unexpected fetchAdmins error:", err);
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return admins.filter((a) => {
      if (statusFilter !== "All" && statusFilter && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (a.username || "").toLowerCase().includes(q) ||
        (a.email || "").toLowerCase().includes(q) ||
        (a.user_metadata?.full_name || "").toLowerCase().includes(q)
      );
    });
  }, [admins, search, statusFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleDelete(id: string, skipConfirm = false) {
    if (!skipConfirm && !confirm("Delete this admin?")) return;
    const supabase = getSupabaseClient();
    if (!supabase) return alert("Cannot delete: Supabase not configured.");
    setActionLoading(true);
    const { error } = await supabase.from("admins").delete().eq("id", id);
    if (error) console.error("delete admin error:", error);
    await fetchAdmins();
    // remove from selected if present
    setSelected((prev) => prev.filter((s) => s !== id));
    setActionLoading(false);
  }

  // Bulk delete selected items
  async function handleBulkDelete() {
    if (selected.length === 0) return;
    if (!confirm(`Delete ${selected.length} selected admin(s)?`)) return;
    const supabase = getSupabaseClient();
    if (!supabase) return alert("Cannot delete: Supabase not configured.");
    setActionLoading(true);
    const { error } = await supabase.from("admins").delete().in("id", selected);
    if (error) {
      console.error("bulk delete error:", error);
      alert("Failed to delete selected admins.");
    } else {
      setSelected([]);
      await fetchAdmins();
    }
    setActionLoading(false);
  }

  if (envMissing) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p className="font-medium text-yellow-800">Supabase not configured</p>
          <p className="text-sm text-yellow-700 mt-1">
            Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local and restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input
            placeholder="Search users..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="border rounded px-3 py-2 w-full sm:w-80"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border rounded px-2 py-2"
          >
            <option value="All">All</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleBulkDelete}
            disabled={selected.length === 0 || actionLoading}
            className={`bg-red-100 text-red-600 px-3 py-2 rounded ${selected.length === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-red-200"}`}
          >
            {actionLoading ? "Deleting..." : `Delete (${selected.length})`}
          </button>
        </div>
      </div>

      <div className="bg-white rounded shadow-sm overflow-hidden">
        <table className="w-full text-left text-black">
          <thead className="bg-[#525a82] text-white">
            <tr>
              <th className="px-4 py-3 w-12">
                {/* select all on current page */}
                <input
                  type="checkbox"
                  checked={pageItems.length > 0 && pageItems.every(i => selected.includes(i.id))}
                  onChange={toggleSelectAllOnPage}
                />
              </th>
              <th className="px-4 py-3">NAME</th>
              <th className="px-4 py-3">ROLE</th>
              <th className="px-4 py-3">STATUS</th>
              <th className="px-4 py-3">LAST LOGIN</th>
              <th className="px-4 py-3">ACTION</th>
            </tr>
          </thead>
          <tbody className="text-black">
            {loading ? (
              <tr><td colSpan={6} className="p-6 text-center">Loading admins...</td></tr>
            ) : pageItems.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center">No admins found.</td></tr>
            ) : pageItems.map((a) => (
               <tr key={a.id} className="border-b last:border-b-0">
                 <td className="px-4 py-3">
                   <input
                     type="checkbox"
                     checked={selected.includes(a.id)}
                     onChange={() => toggleSelected(a.id)}
                   />
                 </td>
                 <td className="px-4 py-3 flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700">
                     {a.user_metadata?.full_name
                       ? a.user_metadata.full_name.charAt(0).toUpperCase()
                       : (a.username || a.email || "").charAt(0).toUpperCase()}
                   </div>
                   <div>
                     <div className="font-medium">{a.username || a.user_metadata?.full_name || "—"}</div>
                   </div>
                 </td>
                <td className="px-4 py-3">{a.role || "—"}</td>
                 <td className="px-4 py-3">
                   <span className={`px-3 py-1 rounded-full text-sm ${a.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                     {a.status || "—"}
                   </span>
                 </td>
                 <td className="px-4 py-3">{a.last_login ? a.last_login.split("T")[0] : "—"}</td>
                 <td className="px-4 py-3">
                   <button
                     onClick={() => handleDelete(a.id)}
                     disabled={actionLoading}
                     className="text-red-600"
                   >
                     Delete
                   </button>
                 </td>
               </tr>
             ))}
          </tbody>
        </table>
        <div className="p-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {Math.min(filtered.length, page * PAGE_SIZE)} of {filtered.length} results</div>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 border rounded">Previous</button>
            <div className="px-3 py-1 border rounded bg-white">{page}</div>
            <button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} className="px-3 py-1 border rounded">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}