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

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const { data, error } = await supabase.storage
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

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("featured_projects").insert([newProject]);
    if (!error) {
      alert("Featured project added!");
      setNewProject({ title: "", description: "", image_url: "", link_url: "" });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-black">Admin Featured Projects</h1>

      {/* Add Form */}
      <div className="mb-8 border p-4 rounded-md shadow bg-gray-50">
        <h2 className="font-semibold mb-3 text-black">Add New Project</h2>
        <input
          type="text"
          placeholder="Project Title"
          value={newProject.title}
          onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
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
          className="border rounded p-2 text-gray-800"
        />
        {newProject.image_url && (
          <img src={newProject.image_url} alt="Preview" className="h-32 w-full object-cover rounded" />
        )}
        <input
          type="text"
          placeholder="Link URL"
          value={newProject.link_url}
          onChange={(e) => setNewProject({ ...newProject, link_url: e.target.value })}
          className="border p-2 w-full mb-3 rounded text-gray-800"
        />
        <button
          onClick={addProject}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          {loading ? "Adding..." : "+ Add Project"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="border p-2 font-semibold text-black bg-blue-200">ID</th>
              <th className="border p-2 font-semibold text-black bg-blue-200">Title</th>
              <th className="border p-2 font-semibold text-black bg-blue-200">Description</th>
              <th className="border p-2 font-semibold text-black bg-blue-200">Image</th>
              <th className="border p-2 font-semibold text-black bg-blue-200">Link</th>
              <th className="border p-2 font-semibold text-black bg-blue-200">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td className="border p-2 text-gray-800">{p.id}</td>
                <td className="border p-2 text-gray-800">{p.title}</td>
                <td className="border p-2 max-w-xs truncate text-gray-800">{p.description}</td>
                <td className="border p-2 text-gray-800">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.title}
                      className="w-16 h-12 object-cover rounded text-gray-800"
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="border p-2 text-gray-800">
                  {p.link_url ? (
                    <a
                      href={p.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline text-gray-800"
                    >
                      Link
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="border p-2 space-x-2 text-gray-800">
                  <button
                    onClick={() => setEditingProject(p)}
                    className="bg-blue-600 text-white px-2 py-1 rounded text-xs "
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteProject(p.id)}
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
      {editingProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
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
                setEditingProject({ ...editingProject, description: e.target.value })
              }
              className="border p-2 w-full mb-2 rounded text-gray-800"
            />
            {/* Image preview */}
            {editingProject.image_url && (
              <img
                src={editingProject.image_url}
                alt="Preview"
                className="h-32 w-full object-cover rounded mb-2"
              />
            )}
            {/* Image upload for replacement */}
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
                const { data, error } = await supabase.storage
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

                setEditingProject({ ...editingProject, image_url: urlData?.publicUrl || "" });
                setUploading(false);
              }}
              className="border rounded p-2 text-gray-800 mb-2"
            />
            <input
              type="text"
              value={editingProject.link_url}
              onChange={(e) =>
                setEditingProject({ ...editingProject, link_url: e.target.value })
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
