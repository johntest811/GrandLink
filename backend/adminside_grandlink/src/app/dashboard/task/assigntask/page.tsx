"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../Clients/Supabase/SupabaseClients";
import { FilePlus2, ArrowLeft } from "lucide-react";
import Link from "next/link";

type AdminUser = {
  id: string;
  username: string;
  full_name: string | null;
  employee_number: string | null;
  role: string;
  position: string | null;
  is_active: boolean;
};

type OrderOption = {
  user_item_id: string;
  product_id: string;
  product_name: string;
  customer_name: string | null;
  order_status: string | null;
  created_at: string;
};

type AdminSession = {
  id: string;
  username: string;
  role: string;
  position?: string;
};

export default function AssignTaskPage() {
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [form, setForm] = useState({
    task_number: "",
    product_name: "",
    task_name: "",
    user_item_id: "",
    product_id: "",
    assigned_admin_id: "",
    employee_name: "",
    employee_number: "",
    start_date: "",
    due_date: "",
    status: "Pending",
  });

  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);

  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [teamSelectionIds, setTeamSelectionIds] = useState<string[]>([]);
  const [teamBusy, setTeamBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("adminSession");
      if (raw) setAdminSession(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    (async () => {
      // Load employees
      const { data: empData, error: empErr } = await supabase
        .from("admins")
        .select("id, username, full_name, employee_number, role, position, is_active")
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (!empErr) setEmployees((empData || []) as AdminUser[]);

      // Load candidate orders
      const { data: orderData, error: orderErr } = await supabase
        .from("user_items")
        .select("id, product_id, customer_name, order_status, created_at, products(name)")
        .eq("item_type", "order")
        .in("order_status", ["accepted", "approved", "in_production"])
        .order("created_at", { ascending: false })
        .limit(200);

      if (orderErr) {
        console.error("Failed to load orders", orderErr);
      } else {
        const mapped: OrderOption[] = (orderData || []).map((row: any) => ({
          user_item_id: row.id,
          product_id: row.product_id,
          product_name: row.products?.name || "(Unknown Product)",
          customer_name: row.customer_name || null,
          order_status: row.order_status || null,
          created_at: row.created_at,
        }));
        setOrders(mapped);
      }
    })();
  }, []);

  useEffect(() => {
    // Load team members for selected order
    (async () => {
      if (!form.user_item_id) {
        setTeamMemberIds([]);
        setTeamSelectionIds([]);
        return;
      }

      const { data, error } = await supabase
        .from("order_team_members")
        .select("admin_id")
        .eq("user_item_id", form.user_item_id);

      if (error) {
        console.error("Failed to load order team", error);
        setTeamMemberIds([]);
        setTeamSelectionIds([]);
        return;
      }

      const ids = (data || []).map((r: any) => String(r.admin_id)).filter(Boolean);
      setTeamMemberIds(ids);
      setTeamSelectionIds(ids);
    })();
  }, [form.user_item_id]);

  const saveTeam = async () => {
    if (!form.user_item_id) {
      alert("Please select an order first.");
      return;
    }
    if (teamSelectionIds.length === 0) {
      alert("Please select at least one employee.");
      return;
    }

    setTeamBusy(true);
    try {
      // Replace team membership for this order:
      // 1) delete existing
      const { error: delErr } = await supabase
        .from("order_team_members")
        .delete()
        .eq("user_item_id", form.user_item_id);
      if (delErr) throw delErr;

      // 2) insert selected
      const payload = teamSelectionIds.map((adminId) => ({
        user_item_id: form.user_item_id,
        admin_id: adminId,
        created_by_admin_id: adminSession?.id || null,
      }));

      const { error: insErr } = await supabase.from("order_team_members").insert(payload);
      if (insErr) throw insErr;

      setTeamMemberIds(teamSelectionIds);
      alert("✅ Production team saved.");
    } catch (e: any) {
      console.error("saveTeam error", e);
      alert("❌ Failed to save team: " + (e?.message || "Unknown error"));
    } finally {
      setTeamBusy(false);
    }
  };

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === form.assigned_admin_id) || null,
    [employees, form.assigned_admin_id]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const assignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      task_number: form.task_number,
      product_name: form.product_name,
      task_name: form.task_name,
      // New: links + assignment
      user_item_id: form.user_item_id || null,
      product_id: form.product_id || null,
      assigned_admin_id: form.assigned_admin_id || null,
      // Legacy fields (kept for backward compatibility)
      employee_name: form.employee_name,
      employee_number: form.employee_number,
      start_date: form.start_date,
      due_date: form.due_date,
      status: form.status,
    };

    const { error } = await supabase.from("tasks").insert([payload]);

    setLoading(false);

    if (error) {
      console.error("❌ Insert failed:", error.message);
      alert("❌ Failed to assign task: " + error.message);
    } else {
      alert("✅ Task Assigned!");
      setForm({
        task_number: "",
        product_name: "",
        task_name: "",
        user_item_id: "",
        product_id: "",
        assigned_admin_id: "",
        employee_name: "",
        employee_number: "",
        start_date: "",
        due_date: "",
        status: "Pending",
      });
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Return Button */}
      <div className="mb-6">
        <Link
          href="/dashboard/task/admintask"
          className="inline-flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg shadow hover:bg-gray-300 transition"
        >
          <ArrowLeft size={18} />
          Return to Task Dashboard
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <FilePlus2 className="text-blue-700" size={28} />
        <h1 className="text-3xl font-bold text-blue-700">Assign Task</h1>
      </div>

      <form
        onSubmit={assignTask}
        className="bg-white shadow-lg rounded-xl p-6 space-y-4 border border-gray-200"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Order (for production monitoring)</label>
          <select
            name="user_item_id"
            value={form.user_item_id}
            onChange={(e) => {
              const userItemId = e.target.value;
              const order = orders.find((o) => o.user_item_id === userItemId);
              setForm((prev) => ({
                ...prev,
                user_item_id: userItemId,
                product_id: order?.product_id || "",
                product_name: order?.product_name || prev.product_name,
              }));
            }}
            className="border p-2 rounded w-full text-gray-700"
          >
            <option value="">(Optional) Select an order</option>
            {orders.map((o) => (
              <option key={o.user_item_id} value={o.user_item_id}>
                {o.product_name} • {o.customer_name || "(No customer name)"} • {o.order_status || ""} • {o.user_item_id.slice(0, 8)}…
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Linking a task to an order is required for customers to see approved progress updates.
          </p>
        </div>

        {/* Production Team (Group of Employees) */}
        <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-800">Production Team (Employee Group)</div>
              <div className="text-xs text-gray-500">Select employees who will work on this order.</div>
            </div>
            <button
              type="button"
              onClick={saveTeam}
              disabled={teamBusy || !form.user_item_id}
              className="px-3 py-2 rounded bg-black text-white text-xs disabled:opacity-50"
            >
              {teamBusy ? "Saving…" : "Save Team"}
            </button>
          </div>

          {!form.user_item_id ? (
            <div className="mt-3 text-sm text-gray-600">Select an order to manage its team.</div>
          ) : (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-auto pr-1">
              {employees
                .filter((e) => e.role !== "superadmin")
                .map((e) => {
                  const label = (e.full_name || e.username) + (e.position ? ` • ${e.position}` : "");
                  const checked = teamSelectionIds.includes(e.id);
                  return (
                    <label key={e.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(ev) => {
                          setTeamSelectionIds((prev) => {
                            if (ev.target.checked) return Array.from(new Set([...prev, e.id]));
                            return prev.filter((id) => id !== e.id);
                          });
                        }}
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
            </div>
          )}

          {form.user_item_id && teamMemberIds.length > 0 && (
            <div className="mt-3 text-xs text-gray-600">
              Current saved team members: {teamMemberIds.length}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            name="task_number"
            placeholder="Task Number"
            value={form.task_number}
            onChange={handleChange}
            className="border p-2 rounded w-full text-gray-700"
            required
          />
          <input
            type="text"
            name="product_name"
            placeholder="Product/Task Name"
            value={form.product_name}
            onChange={handleChange}
            className="border p-2 rounded w-full text-gray-700"
            required
          />
        </div>
        <input
          type="text"
          name="task_name"
          placeholder="Task Name"
          value={form.task_name}
          onChange={handleChange}
          className="border p-2 rounded w-full text-gray-700"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign to employee</label>
            <select
              name="assigned_admin_id"
              value={form.assigned_admin_id}
              onChange={(e) => {
                const id = e.target.value;
                const emp = employees.find((x) => x.id === id);
                setForm((prev) => ({
                  ...prev,
                  assigned_admin_id: id,
                  employee_name: emp?.full_name || emp?.username || prev.employee_name,
                  employee_number: emp?.employee_number || prev.employee_number,
                }));
              }}
              className="border p-2 rounded w-full text-gray-700"
              required
            >
              <option value="">Select employee</option>
              {employees
                .filter((e) => e.role !== "superadmin")
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {(e.full_name || e.username) + (e.position ? ` • ${e.position}` : "")}
                  </option>
                ))}
            </select>
            {form.user_item_id && teamMemberIds.length > 0 && form.assigned_admin_id && !teamMemberIds.includes(form.assigned_admin_id) && (
              <p className="text-xs text-red-600 mt-1">
                This employee is not in the saved team for the selected order.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee Number</label>
            <input
              type="text"
              name="employee_number"
              placeholder="Employee Number"
              value={form.employee_number}
              onChange={handleChange}
              className="border p-2 rounded w-full text-gray-700"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employee Name</label>
          <input
            type="text"
            name="employee_name"
            placeholder="Employee Name"
            value={form.employee_name}
            onChange={handleChange}
            className="border p-2 rounded w-full text-gray-700"
            required
          />
          {selectedEmployee && (
            <p className="text-xs text-gray-500 mt-1">
              Assigned to: {selectedEmployee.full_name || selectedEmployee.username}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input
            type="date"
            name="start_date"
            value={form.start_date}
            onChange={handleChange}
            className="border p-2 rounded w-full text-gray-700"
            required
          />
          <input
            type="date"
            name="due_date"
            value={form.due_date}
            onChange={handleChange}
            className="border p-2 rounded w-full text-gray-700"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition shadow-md"
        >
          {loading ? "Assigning..." : "Assign Task"}
        </button>
      </form>
    </div>
  );
}
