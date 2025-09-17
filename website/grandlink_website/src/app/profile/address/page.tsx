"use client";

import { useState } from "react";

type Address = {
  id: number;
  fullName: string;
  phone: string;
  address: string;
};

export default function AddressManager() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [defaultId, setDefaultId] = useState<number | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName || !phone || !address) {
      alert("All fields are required!");
      return;
    }

    const newAddress: Address = {
      id: Date.now(),
      fullName,
      phone,
      address,
    };

    setAddresses([...addresses, newAddress]);
    if (addresses.length === 0) setDefaultId(newAddress.id); // first one auto default
    setShowForm(false);
    setFullName("");
    setPhone("");
    setAddress("");
  };

  const handleDelete = (id: number) => {
    setAddresses(addresses.filter((addr) => addr.id !== id));
    if (defaultId === id) setDefaultId(null);
  };

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-[#8B1C1C]">My Addresses</h2>

      {/* Add New Button */}
      <button
        onClick={() => setShowForm(true)}
        className="bg-[#8B1C1C] text-white px-4 py-2 rounded font-semibold hover:bg-[#a83232] transition mb-6"
      >
        + Add New Address
      </button>

      {/* Address List */}
      <div className="space-y-4">
        {addresses.map((addr) => (
          <div
            key={addr.id}
            className="border rounded-lg p-4 flex justify-between items-start shadow-sm"
          >
            <div>
              <p className="font-bold">
                {addr.fullName}{" "}
                <span className="ml-2 text-gray-600">({addr.phone})</span>
              </p>
              <p className="text-gray-700">{addr.address}</p>
            </div>
            <div className="flex flex-col items-end gap-2 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="defaultAddress"
                  checked={defaultId === addr.id}
                  onChange={() => setDefaultId(addr.id)}
                  className="accent-[#8B1C1C]"
                />
                <span>Set as Default</span>
              </label>
              <div className="flex gap-3">
                <button
                  className="text-blue-600 hover:underline"
                  onClick={() => alert("Edit functionality to be added")}
                >
                  Edit
                </button>
                <button
                  className="text-red-600 hover:underline"
                  onClick={() => handleDelete(addr.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Show Default Address */}
      {defaultId && (
        <div className="mt-6 p-4 bg-gray-100 rounded">
          <p className="font-semibold">
            Default Address:{" "}
            <span className="text-gray-700">
              {addresses.find((a) => a.id === defaultId)?.fullName},{" "}
              {addresses.find((a) => a.id === defaultId)?.address}
            </span>
          </p>
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-[#8B1C1C]">
              Add New Address
            </h3>
            <form className="grid gap-4" onSubmit={handleAddAddress}>
              <div>
                <label className="block font-semibold">Full Name *</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block font-semibold">Phone Number *</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block font-semibold">Address *</label>
                <textarea
                  className="w-full border rounded px-3 py-2"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#8B1C1C] text-white px-4 py-2 rounded font-semibold hover:bg-[#a83232] transition"
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
