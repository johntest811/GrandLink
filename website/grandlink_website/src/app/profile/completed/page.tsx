"use client";

import Image from "next/image";

export default function ProfileCompletedPage() {
  return (
    <section className="flex-1 flex flex-col px-8 py-8">
 
      <div className="mb-2">
        <input
          type="text"
          placeholder="Search completed orders"
          className="w-full border rounded px-4 py-2 bg-gray-100 text-gray-700"
        />
      </div>
      <hr className="mb-4" />

      <div className="flex flex-1 items-center justify-center border rounded bg-white">
        <div className="flex flex-col items-center py-16">
          <Image src="/no-orders.png" alt="No Completed" width={80} height={80} />
          <p className="mt-4 text-gray-600 text-lg font-medium">No completed orders</p>
        </div>
      </div>
    </section>
  );
}