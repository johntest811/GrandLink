"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type UserItem = {
  id: string;
  user_id: string;
  product_id: string;
  item_type: string;
  status: string;
  quantity: number;
  meta: any;
  created_at: string;
};

type Product = {
  id: string;
  name?: string;
  images?: string[];
  image1?: string;
  image2?: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

export default function ProfileReservePage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<UserItem[]>([]);
  const [productsById, setProductsById] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = (userData as any)?.user?.id ?? null;
        if (!uid) {
          setUserId(null);
          setItems([]);
          setProductsById({});
          setLoading(false);
          return;
        }
        setUserId(uid);

        const { data: uiData, error: uiErr } = await supabase
          .from("user_items")
          .select("*")
          .eq("user_id", uid)
          .eq("item_type", "reserve")
          .order("created_at", { ascending: false });

        if (uiErr) throw uiErr;
        const userItems = uiData ?? [];
        setItems(userItems);

        const productIds = Array.from(new Set(userItems.map((u) => u.product_id).filter(Boolean)));
        if (productIds.length) {
          const { data: prodData, error: prodErr } = await supabase
            .from("products")
            .select("id, name, images, image1, image2")
            .in("id", productIds);
          if (prodErr) throw prodErr;
          const map: Record<string, Product> = {};
          (prodData ?? []).forEach((p) => {
            map[p.id] = p;
          });
          setProductsById(map);
        } else {
          setProductsById({});
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("load reserve error", e);
        setItems([]);
        setProductsById({});
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const p = productsById[it.product_id];
      const title = (p?.name ?? it.meta?.name ?? "").toLowerCase();
      return title.includes(q) || it.id.toLowerCase().includes(q);
    });
  }, [items, productsById, query]);

  const cancelReservation = async (id: string) => {
    if (!userId) return alert("Please log in.");

    const prev = items;
    setActionLoading(id);
    setItems((s) => s.filter((i) => i.id !== id)); // optimistic UI

    try {
      // read row for debug + ownership check
      const { data: rowData, error: rowErr } = await supabase
        .from("user_items")
        .select("id, user_id")
        .eq("id", id)
        .maybeSingle();

      if (rowErr) {
        setItems(prev);
        // eslint-disable-next-line no-console
        console.error("fetch row error", rowErr);
        alert("Could not cancel reservation (could not read row).");
        return;
      }

      if (!rowData) {
        // nothing to delete on server
        alert("Reservation already removed on server.");
        return;
      }

      // log to console to inspect ownership (helps debugging RLS)
      // eslint-disable-next-line no-console
      console.debug("rowData", rowData, "currentUser:", userId);

      if (rowData.user_id !== userId) {
        setItems(prev);
        // eslint-disable-next-line no-console
        console.warn("ownership mismatch", { rowUser: rowData.user_id, currentUser: userId });
        alert("You are not allowed to cancel this reservation (ownership mismatch).");
        return;
      }

      // delete using both id + user_id to satisfy RLS policies
      const { data, error } = await supabase
        .from("user_items")
        .delete()
        .match({ id, user_id: userId })
        .select();

      // debug response
      // eslint-disable-next-line no-console
      console.debug("delete response", { data, error });

      if (error) {
        setItems(prev);
        // eslint-disable-next-line no-console
        console.error("cancel reservation error (supabase):", error);
        alert("Could not cancel reservation: " + (error.message ?? "unknown"));
        return;
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        setItems(prev);
        // eslint-disable-next-line no-console
        console.warn("cancel reservation: no rows deleted, server response:", data);
        alert("Could not cancel reservation (no rows deleted). Check RLS/policies or ownership.");
        return;
      }

      // success (UI already updated)
      alert("Reservation cancelled");
    } catch (err: any) {
      setItems(prev);
      // eslint-disable-next-line no-console
      console.error("cancel reservation unexpected error:", err);
      alert("Could not cancel reservation");
    } finally {
      setActionLoading(null);
    }
  };

  const moveToOrder = async (item: UserItem) => {
    if (!userId) return alert("Please log in.");
    setActionLoading(item.id);
    try {
      const { error } = await supabase
        .from("user_items")
        .update({ item_type: "order", status: "ordered", updated_at: new Date().toISOString() })
        .eq("id", item.id)
        .eq("user_id", userId);
      if (error) throw error;
      setItems((s) => s.filter((i) => i.id !== item.id));
      alert("Moved to Order");
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("move to order error", err);
      alert("Could not move to order");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <section className="flex-1 flex flex-col px-8 py-8">
    
      <div className="mb-2">
        <input
          type="text"
          placeholder="Search reservations"
          className="w-full border rounded px-4 py-2 bg-gray-100 text-gray-700"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <hr className="mb-4" />

      <div className="flex-1">
        {loading ? (
          <div className="py-16 text-center text-gray-600">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-1 items-center justify-center border rounded bg-white py-16">
            <div className="flex flex-col items-center">
            
              <p className="mt-4 text-gray-600 text-lg font-medium">{userId ? "No reservations yet" : "Please log in to see your reservations"}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((it) => {
              const p = productsById[it.product_id];
              const imgKey = p?.images?.[0] ?? p?.image1 ?? p?.image2;
              const imgUrl = imgKey ? (imgKey.startsWith("http") ? imgKey : `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")}/storage/v1/object/public/uploads/${encodeURIComponent(imgKey)}`) : null;
              const title = p?.name ?? it.meta?.name ?? "Untitled";

              return (
                <div key={it.id} className="bg-white p-4 rounded shadow flex items-center gap-4">
                  <div className="w-28 h-20 bg-gray-100 flex items-center justify-center overflow-hidden rounded">
                    {imgUrl ? <img src={imgUrl} alt={title} className="w-full h-full object-cover" /> : <span className="text-gray-400">Image</span>}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-black">{title}</h3>
                    <div className="text-sm text-gray-500">Reserved: {new Date(it.created_at).toLocaleString()}</div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link href={`/Product/details?id=${it.product_id}`} className="bg-[#8B1C1C] text-white px-3 py-2 rounded text-sm text-center">View</Link>
                    <button
                      onClick={() => moveToOrder(it)}
                      disabled={actionLoading === it.id}
                      className="bg-green-600 text-white px-3 py-2 rounded text-sm"
                    >
                      {actionLoading === it.id ? "..." : "Move to Order"}
                    </button>
                    <button
                      onClick={() => cancelReservation(it.id)}
                      disabled={actionLoading === it.id}
                      className="bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm"
                    >
                      {actionLoading === it.id ? "..." : "Cancel"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}