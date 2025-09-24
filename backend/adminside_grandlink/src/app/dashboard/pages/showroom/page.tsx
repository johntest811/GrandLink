"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../Clients/Supabase/SupabaseClients";
import dynamic from "next/dynamic";
import React from "react";

const RichTextEditor = dynamic(() => import("./RichTextEditor"), { ssr: false });

type Showroom = {
  id: number;
  title: string;
  address: string;
  description: string;
  image?: string;
};

export default function AdminShowroomsPage() {
  const [showrooms, setShowrooms] = useState<Showroom[]>([]);
  const [form, setForm] = useState<Partial<Showroom>>({});
  const [editingShowroom, setEditingShowroom] = useState<Showroom | null>(null);
  const [adding, setAdding] = useState(false); 
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchShowrooms();
  }, []);

  const fetchShowrooms = async () => {
    const { data, error } = await supabase
      .from("showrooms")
      .select("*")
      .order("id", { ascending: true });
    if (error) console.error("Error fetching showrooms:", error.message);
    else setShowrooms(data || []);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;
    const { error } = await supabase.storage
      .from("showroom-images")
      .upload(fileName, file);

    if (error) {
      alert("Image upload failed.");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("showroom-images")
      .getPublicUrl(fileName);

    setForm({ ...form, image: urlData?.publicUrl || "" });
    setUploading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("showrooms").insert([form]);
    if (!error) {
      fetchShowrooms();
      setForm({});
      setAdding(false); // close popup
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShowroom) return;
    const { error } = await supabase
      .from("showrooms")
      .update({
        title: editingShowroom.title,
        address: editingShowroom.address,
        description: editingShowroom.description,
        image: editingShowroom.image,
      })
      .eq("id", editingShowroom.id);

    if (!error) {
      fetchShowrooms();
      setEditingShowroom(null);
    }
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("showrooms").delete().eq("id", id);
    if (!error) fetchShowrooms();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-blue-700"> Admin Showrooms</h1>
        <button
          onClick={() => setAdding(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
        >
          ➕ Add Showroom
        </button>
      </div>

      {/* Showrooms Table */}
      <div className="bg-white rounded-xl shadow p-6 border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 text-black">📋 Showrooms List</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-blue-600 text-white text-left">
                <th className="p-3">ID</th>
                <th className="p-3">Title</th>
                <th className="p-3">Address</th>
                <th className="p-3">Description</th>
                <th className="p-3">Image</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {showrooms.map((s, idx) => (
                <tr
                  key={s.id}
                  className={`${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                  } hover:bg-gray-100`}
                >
                  <td className="p-3">{s.id}</td>
                  <td className="p-3 font-medium">{s.title}</td>
                  <td className="p-3">{s.address}</td>
                  <td className="p-3 line-clamp-2 max-w-[250px]">
                    {s.description}
                  </td>
                  <td className="p-3">
                    {s.image ? (
                      <img
                        src={s.image}
                        alt={s.title}
                        className="h-12 w-20 object-cover rounded-md border"
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 flex gap-2 justify-center">
                    <button
                      onClick={() => setEditingShowroom(s)}
                      className="px-3 py-1 bg-yellow-500 text-white rounded-md hover:bg-yellow-600"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
                    >
                      🗑 Delete
                    </button>
                  </td>
                </tr>
              ))}
              {showrooms.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-4 text-center text-gray-500 italic"
                  >
                    No showrooms found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Showroom Modal */}
      {adding && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-8 overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold mb-6 text-gray-900"> Add Showroom</h2>
            <form onSubmit={handleAdd} className="grid gap-4">
              <input
                type="text"
                placeholder="Showroom Title"
                value={form.title || ""}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full p-3 border rounded-md text-gray-800"
                required
              />
              <input
                type="text"
                placeholder="Address"
                value={form.address || ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full p-3 border rounded-md text-gray-800"
              />
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full p-3 border rounded-md text-gray-800"
              />
              {form.image && (
                <img
                  src={form.image}
                  alt="Preview"
                  className="h-32 w-48 object-cover rounded-md border mt-2"
                />
              )}
              <RichTextEditor
                value={form.description || ""}
                onChange={(desc) => setForm({ ...form, description: desc })}
              />
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="bg-gray-400 text-white px-5 py-2 rounded-md hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-5 py-2 rounded-md hover:bg-green-700"
                  disabled={uploading}
                >
                  Add Showroom
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingShowroom && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl p-8 overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold mb-6 text-gray-900"> Edit Showroom</h2>
            <form onSubmit={saveEdit} className="grid gap-4">
              <input
                type="text"
                placeholder="Showroom Title"
                value={editingShowroom.title}
                onChange={(e) =>
                  setEditingShowroom({ ...editingShowroom, title: e.target.value })
                }
                className="w-full p-3 border rounded-md text-gray-800"
                required
              />
              <input
                type="text"
                placeholder="Address"
                value={editingShowroom.address}
                onChange={(e) =>
                  setEditingShowroom({ ...editingShowroom, address: e.target.value })
                }
                className="w-full p-3 border rounded-md text-gray-800"
              />
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full p-3 border rounded-md text-gray-800"
              />
              {editingShowroom.image && (
                <img
                  src={editingShowroom.image}
                  alt="Preview"
                  className="h-32 w-48 object-cover rounded-md border mt-2"
                />
              )}
              <RichTextEditor
                value={editingShowroom.description || ""}
                onChange={(desc) =>
                  setEditingShowroom({ ...editingShowroom, description: desc })
                }
              />
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingShowroom(null)}
                  className="bg-gray-400 text-white px-5 py-2 rounded-md hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700"
                  disabled={uploading}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
