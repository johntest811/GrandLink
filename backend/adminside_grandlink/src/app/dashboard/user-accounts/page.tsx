"use client";
import { useState, useEffect } from "react";
type SupabaseUser = {
  id: string;
  email: string;
  created_at: string;
  role?: string;
  status?: string;
  last_login?: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<SupabaseUser[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/admin-users");
        const result = await res.json();
        if (res.ok) {
          const mockUsers = (result.users || []).map((u: SupabaseUser, i: number) => ({
            ...u,
            role: "User",
            status: ["Active", "Active", "Inactive", "Active", "Active"][i % 5],
            last_login: ["2023-05-15", "2023-05-14", "2023-04-28", "2023-05-12", "2023-05-10"][i % 5],
          }));
          setUsers(mockUsers);
        } else {
          setMessage("Error fetching users: " + (result.error || "Unknown error"));
        }
      } catch (err) {
        setMessage("Error fetching users: " + (err as Error).message);
      }
    };
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (!email || !password) {
      setMessage("Email and password are required.");
      return;
    }
    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await res.json();
      if (res.ok) {
        setMessage("User account created successfully!");
        setEmail("");
        setPassword("");
        setShowModal(false);
        setUsers(prev => [
          ...prev,
          {
            ...result.user,
            role: "User",
            status: "Active",
            last_login: new Date().toISOString().slice(0, 10),
          },
        ]);
      } else {
        setMessage("Error: " + (result.error || "Unknown error"));
      }
    } catch (err) {
      setMessage("Error: " + (err as Error).message);
    }
  };

  // Delete user handler
  const handleDeleteUser = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    setMessage("");
    try {
      const res = await fetch("/api/admin-users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = await res.json();
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== id));
        setMessage("User deleted successfully.");
      } else {
        setMessage("Error deleting user: " + (result.error || "Unknown error"));
      }
    } catch (err) {
      setMessage("Error deleting user: " + (err as Error).message);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="flex items-center mb-8">
        <div className="flex items-center mr-4">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-400 mr-2">A</div>
          <span className="font-semibold text-lg">Admin User</span>
        </div>
      </div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-700">Users Management</h1>
        <button
          className="bg-blue-600 text-white px-6 py-2 rounded font-semibold shadow hover:bg-blue-700 transition"
          onClick={() => { setShowModal(true); setMessage(""); }}
        >
          Add New User
        </button>
      </div>
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Search users..."
          className="border px-3 py-2 rounded w-1/3"
        />
        <select className="border px-3 py-2 rounded text-gray-500" disabled>
          <option>All Roles</option>
        </select>
        <select className="border px-3 py-2 rounded text-gray-500" disabled>
          <option>All Status</option>
        </select>
      </div>
      <div className="bg-white shadow rounded-lg p-6">
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">NAME</th>
              <th className="p-2 border">EMAIL</th>
              <th className="p-2 border">ROLE</th>
              <th className="p-2 border">STATUS</th>
              <th className="p-2 border">LAST LOGIN</th>
              <th className="p-2 border">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, idx) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="p-2 border">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-400 mr-2">
                      {user.email ? user.email[0].toUpperCase() : "U"}
                    </div>
                    <span className="font-medium text-gray-700">{user.email?.split("@")[0].replace(/\./g, " ")}</span>
                  </div>
                </td>
                <td className="p-2 border">{user.email}</td>
                <td className="p-2 border">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">{user.role}</span>
                </td>
                <td className="p-2 border">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${user.status === "Active" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>{user.status}</span>
                </td>
                <td className="p-2 border">{user.last_login}</td>
                <td className="p-2 border">
                  <span
                    className="text-red-600 cursor-pointer hover:underline"
                    onClick={() => handleDeleteUser(user.id)}
                  >
                    Delete
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between items-center mt-4 text-gray-500 text-sm">
          <span>Showing 1 to {users.length} of {users.length} results</span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 border rounded bg-white">Previous</button>
            <span>1</span>
            <button className="px-3 py-1 border rounded bg-white">Next</button>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-xl"
              onClick={() => setShowModal(false)}
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4">Add New User</h2>
            <form className="flex flex-col gap-4" onSubmit={handleAddUser}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="border px-3 py-2 rounded w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="border px-3 py-2 rounded w-full"
                  required
                />
              </div>
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded font-semibold">Add User</button>
            </form>
            {message && <div className="text-center text-red-600 mt-2">{message}</div>}
          </div>
        </div>
      )}
    </div>
  );
}