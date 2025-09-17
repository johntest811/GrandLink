"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../Clients/Supabase/SupabaseClients";
import dynamic from "next/dynamic";
const RichTextEditor = dynamic(() => import("./RichTextEditor"), { ssr: false });
import React from "react";

type Showroom = {
  id: number;
  title: string;
  address: string;
  description: string;
  image?: string;
};

type ShowroomFormProps = {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
};

const ShowroomForm: React.FC<ShowroomFormProps> = ({ form, setForm }) => {
  // You can add custom fields here if needed
  return null;
};

export default function AdminShowroomsPage() {
  const [showrooms, setShowrooms] = useState<Showroom[]>([]);
  const [form, setForm] = useState<Partial<Showroom>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from("showroom-images")
      .upload(fileName, file);

    if (error) {
      alert("Image upload failed.");
      setUploading(false);
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("showroom-images")
      .getPublicUrl(fileName);

    setForm({ ...form, image: urlData?.publicUrl || "" });
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = editingId
      ? await supabase.from("showrooms").update(form).eq("id", editingId)
      : await supabase.from("showrooms").insert([form]);
    if (!error) {
      fetchShowrooms();
      setEditingId(null);
      setForm({});
      setEditorKey(prev => prev + 1); // <-- Always reset editor after add or update
    }
  };

  const handleEdit = (s: Showroom) => {
    setForm(s);
    setEditingId(s.id);
    setEditorKey(prev => prev + 1); // <-- Reset editor for edit too!
  };

  const handleDelete = async (id: number) => {
    const { error } = await supabase.from("showrooms").delete().eq("id", id);
    if (!error) fetchShowrooms();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-black">Admin Showrooms</h1>

      {/* Add/Edit Form */}
      <div className="bg-white rounded-xl shadow p-6 mb-8 border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 text-black">{editingId ? "Edit Showroom" : "Add New Showroom"}</h2>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <input
            type="text"
            name="title"
            placeholder="Showroom Title"
            value={form.title || ""}
            onChange={handleChange}
            className="w-full p-2 border rounded-md text-gray-800"
            required
          />
          <input
            type="text"
            name="address"
            placeholder="Address"
            value={form.address || ""}
            onChange={handleChange}
            className="w-full p-2 border rounded-md text-gray-800"
          />
          <ShowroomForm form={form} setForm={setForm} />
          <input
            type="text"
            name="image"
            placeholder="Image URL"
            value={form.image || ""}
            onChange={handleChange}
            className="w-full p-2 border rounded-md text-gray-800"
          />
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="w-full p-2 border rounded-md text-gray-800"
          />
          {form.image && (
            <img src={form.image} alt="Preview" className="h-20 w-32 object-cover rounded mt-2" />
          )}
          <RichTextEditor
            key={editorKey}
            value={form.description || ""}
            onChange={desc => setForm({ ...form, description: desc })}
          />
          <button
            type="submit"
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 w-fit text-gray-800"
            disabled={uploading}
          >
            {editingId ? "Update Showroom" : "Add Showroom"}
          </button>
        </form>
      </div>

      {/* Showrooms Table */}
      <div className="bg-white rounded-xl shadow p-6 border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 text-black">Showrooms List</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2 text-gray-800 bg-blue-200">ID</th>
                <th className="p-2 text-gray-800 bg-blue-200">Title</th>
                <th className="p-2 text-gray-800 bg-blue-200">Address</th>
                <th className="p-2 text-gray-800 bg-blue-200">Description</th>
                <th className="p-2 text-gray-800 bg-blue-200">Image</th>
                <th className="p-2 text-center text-gray-800 bg-blue-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {showrooms.map((s) => (
                <tr key={s.id} className="border-t hover:bg-gray-50 text-gray-800">
                  <td className="p-2">{s.id}</td>
                  <td className="p-2 font-medium">{s.title}</td>
                  <td className="p-2">{s.address}</td>
                  <td className="p-2 line-clamp-2 max-w-[250px]">{s.description}</td>
                  <td className="p-2">
                    {s.image ? (
                      <img
                        src={s.image}
                        alt={s.title}
                        className="h-12 w-20 object-cover rounded-md border "
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2 flex gap-2 justify-center">
                    <button
                      onClick={() => handleEdit(s)}
                      className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {showrooms.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    No showrooms found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
