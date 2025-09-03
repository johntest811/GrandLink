"use client";

import Image from "next/image";

export default function UserProfilePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
     
      <main className="flex-1 flex flex-row">
        {/* Sidebar */}
        
        {/* Main Content */}
        <section className="flex-1 flex flex-col px-8 py-8">
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button className="px-6 py-2 border rounded bg-[#8B1C1C] text-white font-semibold">
              All
            </button>
            <button className="px-6 py-2 border rounded bg-white text-gray-700 font-semibold">
              My List
            </button>
            <button className="px-6 py-2 border rounded bg-white text-gray-700 font-semibold">
              Reserve
            </button>
            <button className="px-6 py-2 border rounded bg-white text-gray-700 font-semibold">
              Order
            </button>
            <button className="px-6 py-2 border rounded bg-white text-gray-700 font-semibold">
              Completed
            </button>
            <button className="px-6 py-2 border rounded bg-white text-gray-700 font-semibold">
              Cancelled
            </button>
          </div>
          {/* Search Bar */}
          <div className="mb-2">
            <input
              type="text"
              placeholder="you can search by order id or product name"
              className="w-full border rounded px-4 py-2 bg-gray-100 text-gray-700"
            />
          </div>
          <hr className="mb-4" />
          {/* No Orders Yet */}
          <div className="flex flex-1 items-center justify-center border rounded bg-white">
            <div className="flex flex-col items-center">
              <Image
                src="/no-orders.png"
                alt="No Orders"
                width={80}
                height={80}
              />
              <p className="mt-4 text-gray-600 text-lg font-medium">
                No Orders yet
              </p>
            </div>
          </div>
        </section>
      </main>
      
    </div>
  );
}