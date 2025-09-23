"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../Clients/Supabase/SupabaseClients";

type ProductInventory = {
  id: string;
  name: string;
  price?: number;
  inventory?: number | null;
  image1?: string;
  type?: string;
  category?: string;
  description?: string;
};

export default function InventoryAdminPage() {
  const [items, setItems] = useState<ProductInventory[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  // Show low stock products by default
  const [showOnlyLow, setShowOnlyLow] = useState(true);

  // Category filter state + list matching the screenshot
  const CATEGORIES = ["Doors", "Windows", "Enclosures", "Sliding", "Canopy", "Railings", "Casement"];
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter dropdown control
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);

  // track original inventories so we can save only changed rows (for Save All)
  const [originalInventories, setOriginalInventories] = useState<Record<string, number>>({});
  const [savingAll, setSavingAll] = useState(false);

  // fetchItems accepts lowOnly flag so we can request only low-stock products from the DB
  const fetchItems = async (lowOnly: boolean = showOnlyLow) => {
    setLoading(true);

    // Build base query
    let query = supabase
      .from("products")
      .select("id, name, price, inventory, image1, type, category")
      .order("created_at", { ascending: false });

    // If lowOnly, include rows where inventory is NULL or <= 5
    if (lowOnly) {
      // Supabase .or accepts a comma-separated condition list
      query = query.or("inventory.is.null,inventory.lte.5");
    }

    const { data, error } = await query;
    if (error) {
      console.error("fetch inventory error", error);
      setItems([]);
      setOriginalInventories({});
    } else {
      const list = (data || []) as ProductInventory[];
      setItems(list);
      const map: Record<string, number> = {};
      list.forEach((p) => (map[p.id] = p.inventory ?? 0));
      setOriginalInventories(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    // initial load uses showOnlyLow default
    fetchItems(showOnlyLow);
  }, []);

  // close dropdown on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!filterRef.current) return;
      if (!filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const updateInventory = async (id: string, value: number) => {
    setSavingId(id);
    const { error } = await supabase.from("products").update({ inventory: value }).eq("id", id);
    if (error) {
      console.error("update inventory error", error);
    } else {
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, inventory: value } : p)));
      setOriginalInventories((prev) => ({ ...prev, [id]: value }));
    }
    setSavingId(null);
  };

  // Save all changed inventory values
  const saveAll = async () => {
    const changed = items.filter((it) => (originalInventories[it.id] ?? 0) !== (it.inventory ?? 0));
    if (changed.length === 0) {
      alert("No inventory changes to save.");
      return;
    }
    setSavingAll(true);
    const results = await Promise.all(
      changed.map((it) =>
        supabase.from("products").update({ inventory: it.inventory ?? 0 }).eq("id", it.id)
      )
    );
    const errors = results.map((r) => (r as any).error).filter(Boolean);
    if (errors.length) {
      console.error("saveAll errors", errors);
      alert("Some updates failed. Check console.");
    } else {
      // refresh list and original map (respect current lowOnly setting)
      await fetchItems(showOnlyLow);
    }
    setSavingAll(false);
  };

  const filtered = items.filter((it) => {
    // treat null inventory as 0
    const inv = it.inventory ?? 0;
    if (showOnlyLow && inv > 5) return false;
    if (selectedCategory && selectedCategory !== "All Categories") {
      if (!it.category) return false;
      if ((it.category || "").toLowerCase() !== selectedCategory.toLowerCase()) return false;
    }
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      (it.name || "").toLowerCase().includes(q) ||
      (it.type || "").toLowerCase().includes(q) ||
      (it.category || "").toLowerCase().includes(q)
    );
  });

  // count unsaved changes for UI
  const unsavedCount = items.reduce((acc, it) => acc + ((originalInventories[it.id] ?? 0) !== (it.inventory ?? 0) ? 1 : 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-black">Inventory Manager</h1>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => { setShowOnlyLow(true); setSelectedCategory(null); setFilter(""); fetchItems(true); }}
            className="px-4 py-2 bg-[#7b2b2b] text-white rounded-lg shadow"
          >
            All Low Stock Products
          </button>

          {/* Filter dropdown wrapper */}
          <div className="relative" ref={filterRef}>
            {/* Filter button is now blue */}
            <button
              onClick={() => setFilterOpen((s) => !s)}
              className="px-4 py-2 rounded-lg shadow bg-blue-600 text-white"
            >
              Filter
            </button>

            {filterOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white border rounded shadow-lg z-50 p-3">
                <div className="mb-2">
                  <label className="block text-sm font-medium text-black mb-1">Search</label>
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="name / type / category"
                    className="w-full border p-2 rounded text-black"
                  />
                </div>

                <div className="mb-2">
                  <div className="text-sm font-medium text-black mb-1">Category</div>
                  <select
                    value={selectedCategory ?? ""}
                    onChange={(e) => setSelectedCategory(e.target.value || null)}
                    className="w-full border p-2 rounded text-black"
                  >
                    <option value="">All Categories</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <input
                    id="lowstock"
                    type="checkbox"
                    checked={showOnlyLow}
                    onChange={() => setShowOnlyLow((s) => !s)}
                    className="h-4 w-4"
                  />
                  <label htmlFor="lowstock" className="text-sm text-black">Show low stock (&lt;= 5)</label>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => { setFilter(""); setSelectedCategory(null); setShowOnlyLow(false); setFilterOpen(false); fetchItems(false); }}
                    className="px-3 py-1 rounded border"
                  >
                    Clear
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { fetchItems(showOnlyLow); setFilterOpen(false); }}
                      className="px-3 py-1 rounded bg-green-600 text-white"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => setFilterOpen(false)}
                      className="px-3 py-1 rounded border"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <input
          placeholder="Search name / type / category"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border p-2 rounded w-64 text-black"
        />
        <button onClick={() => fetchItems(showOnlyLow)} className="px-3 py-2 bg-green-600 text-white rounded">Refresh</button>

        <button
          onClick={saveAll}
          disabled={savingAll || unsavedCount === 0}
          className="px-3 py-2 bg-blue-600 text-white rounded"
        >
          {savingAll ? "Saving..." : `Save All${unsavedCount ? ` (${unsavedCount})` : ""}`}
        </button>

        {loading && <div className="text-sm text-black">Loading...</div>}
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Sidebar categories (matches screenshot) */}
        <aside className="col-span-1 bg-white rounded shadow p-4">
          <div className="font-bold mb-3 text-black">All Categories</div>
          <ul className="space-y-2">
            <li
              className={`cursor-pointer p-2 rounded ${selectedCategory === null ? "bg-gray-100 font-semibold" : "hover:bg-gray-50"}`}
              onClick={() => setSelectedCategory(null)}
            >
              <span className="text-black">All Categories</span>
            </li>
            {CATEGORIES.map((c) => (
              <li
                key={c}
                className={`cursor-pointer p-2 rounded ${selectedCategory === c ? "bg-gray-100 font-semibold" : "hover:bg-gray-50"}`}
                onClick={() => setSelectedCategory(c)}
              >
                <span className="text-black">{c}</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main table */}
        <section className="col-span-3 overflow-x-auto bg-white rounded-lg shadow">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#51507b] text-white">
                <th className="p-3 text-left">Product Image</th>
                <th className="p-3 text-left">Product Type</th>
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-left">Product Name</th>
                <th className="p-3 text-right">Price</th>
                <th className="p-3 text-center">Inventory</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-black">No products found.</td>
                </tr>
              )}
              {filtered.map((item) => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">
                    {item.image1 ? (
                      <img src={item.image1} alt={item.name} className="w-20 h-20 object-cover rounded" />
                    ) : (
                      <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center text-gray-400">No Image</div>
                    )}
                  </td>
                  <td className="p-3 text-black">{item.type ?? "-"}</td>
                  <td className="p-3 text-black">{item.category ?? "-"}</td>
                  <td className="p-3 font-semibold text-black">{item.name}</td>
                  <td className="p-3 text-right text-black">₱{(item.price ?? 0).toFixed(2)}</td>
                  <td className="p-3 text-center">
                    <input
                      type="number"
                      min={0}
                      className="w-24 border p-2 rounded text-black"
                      value={String(item.inventory ?? 0)}
                      onChange={(e) => {
                        const v = Math.max(0, parseInt(e.target.value || "0", 10));
                        setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, inventory: v } : p)));
                      }}
                    />
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => updateInventory(item.id, Number(item.inventory ?? 0))}
                      disabled={savingId === item.id}
                      className="px-3 py-1 rounded bg-blue-600 text-white"
                    >
                      {savingId === item.id ? "Saving..." : "Save"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}