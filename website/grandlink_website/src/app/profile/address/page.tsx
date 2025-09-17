"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../Clients/Supabase/SupabaseClients";

type Address = {
  id: string;
  user_id?: string;
  full_name: string;
  phone: string;
  address: string;
  is_default: boolean;
  created_at?: string;
};

export default function AddressManager() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [defaultId, setDefaultId] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    fetchAddresses();
    // subscribe to auth changes if needed
  }, []);

  async function fetchAddresses() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setAddresses([]);
      setDefaultId(null);
      return;
    }

    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetch addresses error", error);
      return;
    }
    setAddresses(data ?? []);
    const def = data?.find((a) => a.is_default)?.id ?? null;
    setDefaultId(def);
  }

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName || !phone || !address) {
      alert("All fields are required!");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("You must be signed in to add an address.");
      return;
    }

    const isDefault = addresses.length === 0;

    const { data, error } = await supabase
      .from("addresses")
      .insert([
        {
          user_id: user.id,
          full_name: fullName,
          phone,
          address,
          is_default: isDefault,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      alert("Could not save address");
      return;
    }

    // If this was inserted as default, clear other defaults
    if (isDefault) {
      await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .neq("id", data.id);
    }

    setShowForm(false);
    setFullName("");
    setPhone("");
    setAddress("");

    fetchAddresses();
  };

  const handleDelete = async (id: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("addresses")
      .delete()
      .match({ id, user_id: user.id });

    if (error) {
      console.error("delete error", error);
      return;
    }

    // if deleted default, reset defaultId
    if (defaultId === id) setDefaultId(null);
    fetchAddresses();
  };

  const handleSetDefault = async (id: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // clear other defaults
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);

    // set chosen one
    const { error } = await supabase
      .from("addresses")
      .update({ is_default: true })
      .match({ id, user_id: user.id });

    if (error) {
      console.error("set default error", error);
      return;
    }

    setDefaultId(id);
    fetchAddresses();
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
              <p className="font-bold text-gray-700">
                {addr.full_name}{" "}
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
                  onChange={() => handleSetDefault(addr.id)}
                  className="accent-[#8B1C1C]"
                />
                <span className="text-gray-700">Set as Default</span>
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
          <p className="font-semibold text-gray-700">
            Default Address:{" "}
            <span className="text-gray-700">
              {addresses.find((a) => a.id === defaultId)?.full_name},{" "}
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
                <label className="block font-semibold text-gray-700">Full Name *</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2 text-gray-700"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700">Phone Number *</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2 text-gray-700"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700">Address *</label>
                <textarea
                  className="w-full border rounded px-3 py-2 text-gray-700"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-100 text-gray-700"
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
