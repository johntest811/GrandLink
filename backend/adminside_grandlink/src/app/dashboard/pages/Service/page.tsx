"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../Clients/Supabase/SupabaseClients";
import * as FaIcons from "react-icons/fa";

interface Service {
  id: number;
  name: string;
  short_description: string;
  long_description: string;
  icon?: string; // new field
}

// ✅ Updated icon options to match the dashboard artwork
const ICON_OPTIONS = [
  { value: "FaHammer", label: "Heavy Duty 🛠️" },
  { value: "FaDoorOpen", label: "Sliding 🚪" },
  { value: "FaUmbrella", label: "Awning ☂️" },
  { value: "FaWindowRestore", label: "Casement 🪟" },
  { value: "FaWindowMaximize", label: "Top Hung 🪟" },
  { value: "FaObjectGroup", label: "Bi-folding 🗂️" },
  { value: "FaHome", label: "Facade 🏠" },
  { value: "FaStream", label: "Curtain Wall 🏢" },
  { value: "FaTent", label: "Canopy ⛺" },
  { value: "FaChartLine", label: "Glass Railings 📈" },
  { value: "FaShower", label: "Shower Enclosure 🚿" },
  { value: "FaLayerGroup", label: "Glass Partition 🧩" },
  { value: "FaCog", label: "Customized Design ⚙️" },
];

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [newService, setNewService] = useState<Omit<Service, "id">>({
    name: "",
    short_description: "",
    long_description: "",
    icon: "FaHammer", // default to Heavy Duty
  });
  const [editingService, setEditingService] = useState<Service | null>(null);
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
      setNewService({
        name: "",
        short_description: "",
        long_description: "",
        icon: "FaHammer",
      });
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
      .update(editingService)
      .eq("id", editingService.id);
    if (error) console.error(error);
    else {
      setEditingService(null);
      fetchServices();
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-8 text-gray-900 tracking-tight">
        ⚙️ Admin Services Manager
      </h1>

      {/* Add New Service Form */}
      <div className="mb-10 bg-white border rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          ➕ Add New Service
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="text"
            placeholder="Service Name"
            value={newService.name}
            onChange={(e) => setNewService({ ...newService, name: e.target.value })}
            className="border p-2 rounded text-gray-800 w-full"
          />
          <select
            value={newService.icon}
            onChange={(e) => setNewService({ ...newService, icon: e.target.value })}
            className="border p-2 rounded text-gray-800 w-full"
          >
            {ICON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          placeholder="Short Description"
          value={newService.short_description}
          onChange={(e) =>
            setNewService({ ...newService, short_description: e.target.value })
          }
          className="border p-2 rounded text-gray-800 w-full mt-3"
        />
        <textarea
          placeholder="Long Description"
          value={newService.long_description}
          onChange={(e) =>
            setNewService({ ...newService, long_description: e.target.value })
          }
          className="border p-2 rounded text-gray-800 w-full mt-3"
        />
        <button
          onClick={addService}
          disabled={loading}
          className="mt-4 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-md shadow"
        >
          {loading ? "Adding..." : "➕ Add Service"}
        </button>
      </div>

      {/* Services Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow-md">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="p-3">ID</th>
              <th className="p-3">Icon</th>
              <th className="p-3">Name</th>
              <th className="p-3">Short Description</th>
              <th className="p-3">Long Description</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => {
              const IconComponent =
                s.icon && (FaIcons as any)[s.icon]
                  ? (FaIcons as any)[s.icon]
                  : FaIcons.FaCog;
              return (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 text-gray-700">{s.id}</td>
                  <td className="p-3 text-center">
                    <IconComponent size={32} className="text-blue-600 mx-auto" />
                  </td>
                  <td className="p-3 font-semibold text-black">{s.name}</td>
                  <td className="p-3 text-black">{s.short_description}</td>
                  <td className="p-3 truncate max-w-sm text-black">{s.long_description}</td>
                  <td className="p-3 space-x-2 text-black">
                    <button
                      onClick={() => setEditingService(s)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteService(s.id)}
                      className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingService && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-lg shadow-xl">
            <h2 className="text-lg font-bold mb-4">✏️ Edit Service</h2>

            <input
              type="text"
              value={editingService.name}
              onChange={(e) =>
                setEditingService({ ...editingService, name: e.target.value })
              }
              className="border p-2 w-full mb-2 rounded"
            />
            <select
              value={editingService.icon}
              onChange={(e) =>
                setEditingService({ ...editingService, icon: e.target.value })
              }
              className="border p-2 w-full mb-2 rounded"
            >
              {ICON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
                className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
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
