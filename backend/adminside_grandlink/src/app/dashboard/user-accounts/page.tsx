"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../Clients/Supabase/SupabaseClients";

type User = {
  id: number;
  employee_number: string;
  name: string;
  designation: string;
  last_login: string;
  status: string;
  email: string;
};

export default function UserAccountsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | string>("All");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modals
  const [modalType, setModalType] = useState<"edit" | "view" | "add" | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // New user form
  const [newUser, setNewUser] = useState({
    employee_number: "",
    name: "",
    designation: "",
    email: "",
    status: "Active",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, employee_number, name, role, status, email")
      .order("id", { ascending: true });

    if (!error && data) {
      setUsers(
        data.map((u: any) => ({
          ...u,
          designation: u.role,
          last_login: "2025-09-18", // placeholder
        }))
      );
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== "All" && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.employee_number.toLowerCase().includes(q)
      );
    });
  }, [users, search, statusFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportPDF = async () => {
    const jsPDF = (await import("jspdf")).default;
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF();
    doc.text("User Accounts Report", 14, 15);

    const filteredData = users.filter((u) => {
      if (!startDate || !endDate) return true;
      const login = new Date(u.last_login);
      return login >= new Date(startDate) && login <= new Date(endDate);
    });

    autoTable(doc, {
      startY: 25,
      head: [["Employee #", "Name", "Designation", "Email", "Status", "Last Login"]],
      body: filteredData.map((u) => [
        u.employee_number,
        u.name,
        u.designation,
        u.email,
        u.status,
        u.last_login,
      ]),
    });

    doc.save("user_accounts.pdf");
    setShowExportModal(false);
  };

  async function handleDelete(id: number) {
    if (!confirm("Remove this user?")) return;
    await supabase.from("employees").delete().eq("id", id);
    fetchUsers();
  }

  async function handleEditSave() {
    if (!selectedUser) return;
    await supabase
      .from("employees")
      .update({
        name: selectedUser.name,
        role: selectedUser.designation,
        email: selectedUser.email,
        status: selectedUser.status,
      })
      .eq("id", selectedUser.id);
    setModalType(null);
    fetchUsers();
  }

  async function handleAddSave() {
    if (!newUser.name || !newUser.email || !newUser.employee_number) {
      alert("Please fill in all required fields");
      return;
    }

    const { error } = await supabase.from("employees").insert([
      {
        employee_number: newUser.employee_number,
        name: newUser.name,
        role: newUser.designation,
        email: newUser.email,
        status: newUser.status,
      },
    ]);

    if (error) {
      alert("Error adding user: " + error.message);
    } else {
      setModalType(null);
      setNewUser({ employee_number: "", name: "", designation: "", email: "", status: "Active" });
      fetchUsers();
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-blue-700 mb-6">👥 Manage User Accounts</h1>

      {/* Search & Export */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            placeholder="🔍 Search users..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="border rounded px-3 py-2 w-full sm:w-80 shadow-sm"
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
        <div className="flex gap-2">
          <button
            onClick={() => setModalType("add")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow"
          >
            ➕ Add User
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 shadow"
          >
            📤 Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded shadow-md overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#3b82f6] text-white">
            <tr>
              <th className="px-4 py-3">Employee #</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Designation</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last Login</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-6 text-center">Loading...</td></tr>
            ) : pageItems.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center">No users found.</td></tr>
            ) : pageItems.map((u) => (
              <tr key={u.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">{u.employee_number}</td>
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3">{u.designation}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-3 py-1 rounded-full text-sm ${u.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-3">{u.last_login}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSelectedUser(u); setModalType("edit"); }}
                      className="px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => { setSelectedUser(u); setModalType("view"); }}
                      className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                    >
                      👁 View
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                    >
                      🗑 Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="p-4 flex items-center justify-between text-sm text-gray-600">
          <div>
            Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(filtered.length, page * PAGE_SIZE)} of {filtered.length} results
          </div>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 border rounded">Previous</button>
            <span className="px-3 py-1 border rounded">{page}</span>
            <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border rounded">Next</button>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h2 className="text-lg font-bold mb-4">📤 Export Users</h2>
            <label className="block mb-2 text-sm">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border p-2 rounded w-full mb-3"/>
            <label className="block mb-2 text-sm">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border p-2 rounded w-full mb-4"/>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowExportModal(false)} className="px-4 py-2 bg-gray-400 text-white rounded">Cancel</button>
              <button onClick={exportPDF} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Export</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {modalType === "add" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h2 className="text-lg font-bold mb-4">➕ Add User</h2>
            <input type="text" value={newUser.employee_number} onChange={(e) => setNewUser({ ...newUser, employee_number: e.target.value })} className="border p-2 rounded w-full mb-3" placeholder="Employee #"/>
            <input type="text" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="border p-2 rounded w-full mb-3" placeholder="Name"/>
            <input type="text" value={newUser.designation} onChange={(e) => setNewUser({ ...newUser, designation: e.target.value })} className="border p-2 rounded w-full mb-3" placeholder="Designation"/>
            <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="border p-2 rounded w-full mb-3" placeholder="Email"/>
            <select value={newUser.status} onChange={(e) => setNewUser({ ...newUser, status: e.target.value })} className="border p-2 rounded w-full mb-4">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModalType(null)} className="px-4 py-2 bg-gray-400 text-white rounded">Cancel</button>
              <button onClick={handleAddSave} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {modalType === "edit" && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h2 className="text-lg font-bold mb-4">✏️ Edit User</h2>
            <input type="text" value={selectedUser.name} onChange={(e) => setSelectedUser({ ...selectedUser, name: e.target.value })} className="border p-2 rounded w-full mb-3" placeholder="Name"/>
            <input type="text" value={selectedUser.designation} onChange={(e) => setSelectedUser({ ...selectedUser, designation: e.target.value })} className="border p-2 rounded w-full mb-3" placeholder="Designation"/>
            <input type="email" value={selectedUser.email} onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })} className="border p-2 rounded w-full mb-3" placeholder="Email"/>
            <select value={selectedUser.status} onChange={(e) => setSelectedUser({ ...selectedUser, status: e.target.value })} className="border p-2 rounded w-full mb-4">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModalType(null)} className="px-4 py-2 bg-gray-400 text-white rounded">Cancel</button>
              <button onClick={handleEditSave} className="px-4 py-2 bg-yellow-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {modalType === "view" && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-6 w-96">
            <h2 className="text-lg font-bold mb-4">👁 User Details</h2>
            <p><strong>Employee #:</strong> {selectedUser.employee_number}</p>
            <p><strong>Name:</strong> {selectedUser.name}</p>
            <p><strong>Designation:</strong> {selectedUser.designation}</p>
            <p><strong>Email:</strong> {selectedUser.email}</p>
            <p><strong>Status:</strong> {selectedUser.status}</p>
            <p><strong>Last Login:</strong> {selectedUser.last_login}</p>
            <div className="flex justify-end mt-4">
              <button onClick={() => setModalType(null)} className="px-4 py-2 bg-blue-600 text-white rounded">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
