"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../Clients/Supabase/SupabaseClients";

interface Service {
  id: number;
  name: string;
  short_description: string;
  long_description: string;
}

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [newService, setNewService] = useState<Omit<Service, "id">>({
    name: "",
    short_description: "",
    long_description: "",
  });
  const [editingService, setEditingService] = useState<Service | null>(null); // for modal
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    const { data, error } = await supabase.from("services").select("*").order("id");
    if (error) console.error(error);
    else setServices(data || []);
  };

  const addService = async () => {
    if (!newService.name) return alert("Service name is required");
    setLoading(true);
    const { error } = await supabase.from("services").insert([newService]);
    setLoading(false);
    if (error) console.error(error);
    else {
      setNewService({ name: "", short_description: "", long_description: "" });
      fetchServices();
    }
  };

  const deleteService = async (id: number) => {
    if (!confirm("Delete this service?")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) console.error(error);
    else fetchServices();
  };

  const saveEdit = async () => {
    if (!editingService) return;
    const { error } = await supabase
      .from("services")
      .update({
        name: editingService.name,
        short_description: editingService.short_description,
        long_description: editingService.long_description,
      })
      .eq("id", editingService.id);
    if (error) console.error(error);
    else {
      setEditingService(null);
      fetchServices();
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-black">Admin Services Manager</h1>

      {/* Add New Service Form */}
      <div className="mb-8 border p-4 rounded-md shadow bg-gray-50">
        <h2 className="font-semibold mb-3 text-black">Add New Service</h2>
        <input
          type="text"
          placeholder="Service Name"
          value={newService.name}
          onChange={(e) => setNewService({ ...newService, name: e.target.value })}
          className="border p-2 w-full mb-2 rounded text-gray-800"
        />
        <textarea
          placeholder="Short Description"
          value={newService.short_description}
          onChange={(e) =>
            setNewService({ ...newService, short_description: e.target.value })
          }
          className="border p-2 w-full mb-2 rounded text-gray-800"
        />
        <textarea
          placeholder="Long Description"
          value={newService.long_description}
          onChange={(e) =>
            setNewService({ ...newService, long_description: e.target.value })
          }
          className="border p-2 w-full mb-3 rounded text-gray-800"
        />
        <button
          onClick={addService}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          {loading ? "Adding..." : "+ Add Service"}
        </button>
      </div>

      {/* Services Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="border p-2 text-gray-800 bg-blue-200">ID</th>
              <th className="border p-2 text-gray-800 bg-blue-200">Name</th>
              <th className="border p-2 text-gray-800 bg-blue-200">Short Description</th>
              <th className="border p-2 text-gray-800 bg-blue-200">Long Description</th>
              <th className="border p-2 text-gray-800 bg-blue-200">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td className="border p-2 text-gray-800">{s.id}</td>
                <td className="border p-2 text-gray-800">{s.name}</td>
                <td className="border p-2 text-gray-800">{s.short_description}</td>
                <td className="border p-2 text-gray-800 truncate max-w-xs">{s.long_description}</td>
                <td className="border p-2 space-x-2 text-gray-800">
                  <button
                    onClick={() => setEditingService(s)}
                    className="bg-blue-600 text-white px-2 py-1 rounded text-xs "
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteService(s.id)}
                    className="bg-red-600 text-white px-2 py-1 rounded text-xs"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-md w-full max-w-lg shadow-lg">
            <h2 className="text-lg font-bold mb-4">Edit Service</h2>

            <input
              type="text"
              value={editingService.name}
              onChange={(e) =>
                setEditingService({ ...editingService, name: e.target.value })
              }
              className="border p-2 w-full mb-2 rounded"
            />
            <textarea
              value={editingService.short_description}
              onChange={(e) =>
                setEditingService({
                  ...editingService,
                  short_description: e.target.value,
                })
              }
              className="border p-2 w-full mb-2 rounded"
            />
            <textarea
              value={editingService.long_description}
              onChange={(e) =>
                setEditingService({
                  ...editingService,
                  long_description: e.target.value,
                })
              }
              className="border p-2 w-full mb-4 rounded"
            />

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEditingService(null)}
                className="bg-gray-400 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
