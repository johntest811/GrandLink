"use client";

import { useState } from "react";

export default function EditAddressPage() {
  const [address, setAddress] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Address updated!");
  };

  return (
    <div className="bg-white rounded-xl shadow-lg w-full max-w-xl p-8 mx-auto mt-12">
      <h2 className="text-2xl font-bold mb-6 text-[#8B1C1C]">Edit Address</h2>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="font-semibold">Address</label>
        <input
          type="text"
          placeholder="Enter your new address"
          className="border rounded px-3 py-2"
          value={address}
          onChange={e => setAddress(e.target.value)}
        />
        <button className="bg-[#8B1C1C] text-white px-4 py-2 rounded font-semibold mt-2 hover:bg-[#a83232] transition">
          Save Address
        </button>
      </form>
    </div>
  );
}