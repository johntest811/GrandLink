"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";



const MOCK_ITEMS = [
  { id: "1", title: "GE 103 Sliding Door", type: "order" },
  { id: "2", title: "GE 79 Window", type: "reserve" },
  { id: "3", title: "GE 116 Glass Partition", type: "completed" },
  { id: "4", title: "Custom Gate", type: "my-list" },
];

export default function UserProfilePage() {
  const pathname = usePathname() || "";
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    return MOCK_ITEMS.filter((it) => it.title.toLowerCase().includes(query.trim().toLowerCase()));
  }, [query]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <main className="flex-1 flex flex-row">
        {/* Main Content */}
        <section className="flex-1 flex flex-col px-8 py-8">
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            
          </div>

          {/* Search Bar */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by order id or product name"
              className="w-full border rounded px-4 py-2 bg-gray-100 text-gray-700"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <hr className="mb-4" />

          {/* Results */}
          <div className="flex-1">
            {items.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {items.map((it) => (
                  <div key={it.id} className="bg-white p-4 rounded shadow flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-black">{it.title}</h3>
                      <div className="text-sm text-gray-500">Type: {it.type}</div>
                    </div>
                    <Link href={`/Product/details?id=${it.id}`} className="bg-[#8B1C1C] text-white px-4 py-2 rounded">
                      View
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center border rounded bg-white py-16">
                <div className="flex flex-col items-center">
                  <Image src="/no-orders.png" alt="No Orders" width={80} height={80} />
                  <p className="mt-4 text-gray-600 text-lg font-medium">{query ? "No items match your search" : "No Orders yet"}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}