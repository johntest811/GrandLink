"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../Clients/Supabase/SupabaseClients";

type Admin = {
  id: string;
  username?: string | null;
  role?: string | null;
  created_at?: string | null;
  email?: string | null;
  status?: string | null;
  last_login?: string | null;
  user_metadata?: any;
};

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | string>("All");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Modals
  const [showExportModal, setShowExportModal] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [modalType, setModalType] = useState<"edit" | "view" | null>(null);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);

  useEffect(() => {
    fetchAdmins();
  }, []);

  async function fetchAdmins() {
    setLoading(true);
    const { data, error } = await supabase
      .from("admins")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setAdmins(
        data.map((a: Admin) => ({
          ...a,
          status: a.status || "Inactive",
          last_login: a.last_login || a.created_at,
        }))
      );
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return admins.filter((a) => {
      if (statusFilter !== "All" && statusFilter && a.status !== statusFilter)
        return false;
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

  const exportPDF = async () => {
    const jsPDF = (await import("jspdf")).default;
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF();
    doc.text("Admins Report", 14, 15);

    const filteredData = admins.filter((a) => {
      if (!startDate || !endDate) return true;
      const login = new Date(a.last_login || "");
      return login >= new Date(startDate) && login <= new Date(endDate);
    });

    autoTable(doc, {
      startY: 25,
      head: [["Name", "Role", "Email", "Status", "Last Login"]],
      body: filteredData.map((a) => [
        a.username || a.user_metadata?.full_name || "—",
        a.role || "—",
        a.email || "—",
        a.status,
        a.last_login?.split("T")[0],
      ]),
    });

    doc.save("admins_report.pdf");
    setShowExportModal(false);
  };

  async function handleDelete(id: string) {
    if (!confirm("Delete this admin?")) return;
    await supabase.from("admins").delete().eq("id", id);
    fetchAdmins();
  }

  async function handleEditSave() {
    if (!selectedAdmin) return;
    await supabase
      .from("admins")
      .update({
        username: selectedAdmin.username,
        role: selectedAdmin.role,
        email: selectedAdmin.email,
        status: selectedAdmin.status,
      })
      .eq("id", selectedAdmin.id);
    setModalType(null);
    fetchAdmins();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-400 mb-6">
        ⚙️ Manage Admin Accounts
      </h1>

      {/* Search & Export */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex gap-3 w-full sm:w-auto">
          <input
            placeholder="🔍 Search admins..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border rounded-full px-4 py-2 w-full sm:w-80 shadow-sm focus:ring-2 focus:ring-cyan-400 focus:outline-none transition"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="border rounded-full px-3 py-2 focus:ring-2 focus:ring-blue-400 transition"
          >
            <option value="All">All</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <button
          onClick={() => setShowExportModal(true)}
          className="px-5 py-2.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-400 text-white font-semibold shadow hover:opacity-90 transition"
        >
          📤 Export
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
        <table className="w-full text-left">
          <thead className="bg-gradient-to-r from-[#3b4d91] to-[#525a82] text-white text-sm uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Login</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : pageItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  No admins found.
                </td>
              </tr>
            ) : (
              pageItems.map((a, idx) => (
                <tr
                  key={a.id}
                  className={`hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 transition ${
                    idx % 2 === 0 ? "bg-gray-50" : "bg-white"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {a.username || a.user_metadata?.full_name || "—"}
                  </td>
                  <td className="px-4 py-3">{a.role || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        a.status === "Active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {a.last_login?.split("T")[0] || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedAdmin(a);
                          setModalType("edit");
                        }}
                        className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-white rounded-md text-xs font-semibold shadow transition"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => {
                          setSelectedAdmin(a);
                          setModalType("view");
                        }}
                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-xs font-semibold shadow transition"
                      >
                        👁 View
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-md text-xs font-semibold shadow transition"
                      >
                        🗑 Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="p-4 flex items-center justify-between text-sm text-gray-600">
          <div>
            Showing{" "}
            {filtered.length === 0
              ? 0
              : (page - 1) * PAGE_SIZE + 1}{" "}
            to {Math.min(filtered.length, page * PAGE_SIZE)} of{" "}
            {filtered.length} results
          </div>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 border rounded-md hover:bg-gray-100 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-3 py-1 border rounded-md bg-gray-50">
              {page}
            </span>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 border rounded-md hover:bg-gray-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Glassmorphism Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/80 backdrop-blur-xl rounded-xl shadow-xl p-6 w-96 border border-cyan-200">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              📤 Export Admins
            </h2>
            <label className="block mb-2 text-sm">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border p-2 rounded w-full mb-3 focus:ring-2 focus:ring-blue-400"
            />
            <label className="block mb-2 text-sm">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border p-2 rounded w-full mb-4 focus:ring-2 focus:ring-blue-400"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 bg-gray-400 text-white rounded-md hover:opacity-80"
              >
                Cancel
              </button>
              <button
                onClick={exportPDF}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-400 text-white rounded-md shadow hover:opacity-90"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {modalType === "edit" && selectedAdmin && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/90 rounded-xl shadow-xl p-6 w-96 border border-yellow-200">
            <h2 className="text-lg font-bold mb-4 text-yellow-700">
              ✏️ Edit Admin
            </h2>
            <input
              type="text"
              value={selectedAdmin.username || ""}
              onChange={(e) =>
                setSelectedAdmin({ ...selectedAdmin, username: e.target.value })
              }
              className="border p-2 rounded w-full mb-3"
              placeholder="Name"
            />
            <input
              type="text"
              value={selectedAdmin.role || ""}
              onChange={(e) =>
                setSelectedAdmin({ ...selectedAdmin, role: e.target.value })
              }
              className="border p-2 rounded w-full mb-3"
              placeholder="Role"
            />
            <input
              type="email"
              value={selectedAdmin.email || ""}
              onChange={(e) =>
                setSelectedAdmin({ ...selectedAdmin, email: e.target.value })
              }
              className="border p-2 rounded w-full mb-3"
              placeholder="Email"
            />
            <select
              value={selectedAdmin.status || "Inactive"}
              onChange={(e) =>
                setSelectedAdmin({ ...selectedAdmin, status: e.target.value })
              }
              className="border p-2 rounded w-full mb-4"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalType(null)}
                className="px-4 py-2 bg-gray-400 text-white rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {modalType === "view" && selectedAdmin && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/90 rounded-xl shadow-xl p-6 w-96 border border-blue-200">
            <h2 className="text-lg font-bold mb-4 text-blue-700">
              👁 Admin Details
            </h2>
            <p>
              <strong>Name:</strong>{" "}
              {selectedAdmin.username || selectedAdmin.user_metadata?.full_name}
            </p>
            <p>
              <strong>Role:</strong> {selectedAdmin.role}
            </p>
            <p>
              <strong>Email:</strong> {selectedAdmin.email}
            </p>
            <p>
              <strong>Status:</strong> {selectedAdmin.status}
            </p>
            <p>
              <strong>Last Login:</strong>{" "}
              {selectedAdmin.last_login?.split("T")[0]}
            </p>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setModalType(null)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
