"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../../Clients/Supabase/SupabaseClients";

interface Project {
  id: number;
  title: string;
  description: string;
  image_url?: string;
  link_url?: string;
}

export default function AdminFeaturedProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProject, setNewProject] = useState<Omit<Project, "id">>({
    title: "",
    description: "",
    image_url: "",
    link_url: "",
  });
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from("featured_projects")
      .select("*")
      .order("id", { ascending: true });
    if (error) console.error(error);
    else setProjects(data || []);
  };

  const addProject = async () => {
    if (!newProject.title) return alert("Title is required");
    setLoading(true);
    const { error } = await supabase.from("featured_projects").insert([newProject]);
    setLoading(false);
    if (error) console.error(error);
    else {
      setNewProject({ title: "", description: "", image_url: "", link_url: "" });
      setShowAddModal(false);
      fetchProjects();
    }
  };

  const deleteProject = async (id: number) => {
    if (!confirm("Delete this project?")) return;
    const { error } = await supabase.from("featured_projects").delete().eq("id", id);
    if (error) console.error(error);
    else fetchProjects();
  };

  const saveEdit = async () => {
    if (!editingProject) return;
    const { error } = await supabase
      .from("featured_projects")
      .update({
        title: editingProject.title,
        description: editingProject.description,
        image_url: editingProject.image_url,
        link_url: editingProject.link_url,
      })
      .eq("id", editingProject.id);

    if (error) console.error(error);
    else {
      setEditingProject(null);
      fetchProjects();
    }
  };

  // Handle image upload for new project
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;
    const { error } = await supabase.storage
      .from("featured-projects-images")
      .upload(fileName, file);

    if (error) {
      alert("Image upload failed.");
      setUploading(false);
      return;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("featured-projects-images")
      .getPublicUrl(fileName);

    setNewProject({ ...newProject, image_url: urlData?.publicUrl || "" });
    setUploading(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-black">Admin Featured Projects</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          + Add Project
        </button>
      </div>

{/* Table */}
<div className="overflow-x-auto rounded-xl shadow-lg border border-gray-200">
  <table className="w-full text-sm">
    <thead>
      <tr className="bg-blue-600 text-white">
        <th className="p-3 text-left">ID</th>
        <th className="p-3 text-left">Title</th>
        <th className="p-3 text-left">Description</th>
        <th className="p-3 text-left">Image</th>
        <th className="p-3 text-left">Link</th>
        <th className="p-3 text-center">Actions</th>
      </tr>
    </thead>
    <tbody>
      {projects.map((p, idx) => (
        <tr
          key={p.id}
          className={`${
            idx % 2 === 0 ? "bg-white" : "bg-gray-50"
          } hover:bg-gray-100 transition`}
        >
          <td className="p-3 border-b text-gray-700">{p.id}</td>
          <td className="p-3 border-b font-medium text-gray-900">{p.title}</td>
          <td className="p-3 border-b max-w-xs truncate text-gray-600">
            {p.description}
          </td>
          <td className="p-3 border-b">
            {p.image_url ? (
              <img
                src={p.image_url}
                alt={p.title}
                className="w-20 h-14 object-cover rounded-md shadow-sm"
              />
            ) : (
              <span className="text-gray-400">No Image</span>
            )}
          </td>
          <td className="p-3 border-b">
            {p.link_url ? (
              <a
                href={p.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
              >
                View Link
              </a>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </td>
          <td className="p-3 border-b text-center space-x-2">
            <button
              onClick={() => setEditingProject(p)}
              className="px-3 py-1 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 text-xs"
            >
              Edit
            </button>
            <button
              onClick={() => deleteProject(p.id)}
              className="px-3 py-1 bg-red-600 text-white rounded-md shadow hover:bg-red-700 text-xs"
            >
              Delete
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-md w-full max-w-lg shadow-lg">
            <h2 className="font-bold mb-4 text-black text-lg">Add New Project</h2>
            <input
              type="text"
              placeholder="Project Title"
              value={newProject.title}
              onChange={(e) =>
                setNewProject({ ...newProject, title: e.target.value })
              }
              className="border p-2 w-full mb-2 rounded text-gray-800"
            />
            <textarea
              placeholder="Description"
              value={newProject.description}
              onChange={(e) =>
                setNewProject({ ...newProject, description: e.target.value })
              }
              className="border p-2 w-full mb-2 rounded text-gray-800"
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="border rounded p-2 w-full text-gray-800 mb-2"
            />
            {newProject.image_url && (
              <img
                src={newProject.image_url}
                alt="Preview"
                className="h-32 w-full object-cover rounded mb-2"
              />
            )}
            <input
              type="text"
              placeholder="Link URL"
              value={newProject.link_url}
              onChange={(e) =>
                setNewProject({ ...newProject, link_url: e.target.value })
              }
              className="border p-2 w-full mb-3 rounded text-gray-800"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="bg-gray-400 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
              <button
                onClick={addProject}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                {loading ? "Adding..." : "Add Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-md w-full max-w-lg shadow-lg">
            <h2 className="text-lg font-bold mb-4 text-gray-800">Edit Project</h2>
            <input
              type="text"
              value={editingProject.title}
              onChange={(e) =>
                setEditingProject({ ...editingProject, title: e.target.value })
              }
              className="border p-2 w-full mb-2 rounded text-gray-800"
            />
            <textarea
              value={editingProject.description}
              onChange={(e) =>
                setEditingProject({
                  ...editingProject,
                  description: e.target.value,
                })
              }
              className="border p-2 w-full mb-2 rounded text-gray-800"
            />
            {editingProject.image_url && (
              <img
                src={editingProject.image_url}
                alt="Preview"
                className="h-32 w-full object-cover rounded mb-2"
              />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                const fileExt = file.name.split(".").pop();
                const fileName = `${Date.now()}-${Math.random()
                  .toString(36)
                  .substring(2)}.${fileExt}`;
                const { error } = await supabase.storage
                  .from("featured-projects-images")
                  .upload(fileName, file);

                if (error) {
                  alert("Image upload failed.");
                  setUploading(false);
                  return;
                }

                const { data: urlData } = supabase.storage
                  .from("featured-projects-images")
                  .getPublicUrl(fileName);

                setEditingProject({
                  ...editingProject,
                  image_url: urlData?.publicUrl || "",
                });
                setUploading(false);
              }}
              className="border rounded p-2 text-gray-800 mb-2"
            />
            <input
              type="text"
              value={editingProject.link_url}
              onChange={(e) =>
                setEditingProject({
                  ...editingProject,
                  link_url: e.target.value,
                })
              }
              className="border p-2 w-full mb-4 rounded text-gray-800"
            />

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEditingProject(null)}
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
