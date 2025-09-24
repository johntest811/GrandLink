'use client';

import { useEffect, useState } from 'react';
import { supabase } from "../../../Clients/Supabase/SupabaseClients";

type Warranty = {
  id: number;
  title: string;
  description: string;
};

export default function AdminDeliveryProcess() {
  const [steps, setSteps] = useState<Warranty[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editingStep, setEditingStep] = useState<Warranty | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchSteps = async () => {
    const { data, error } = await supabase
      .from('warranties')
      .select('*')
      .order('id', { ascending: true });
    if (!error) setSteps(data || []);
  };

  useEffect(() => {
    fetchSteps();
  }, []);

  const addStep = async () => {
    if (!title || !description) return;
    await supabase.from('warranties').insert([{ title, description }]);
    setTitle('');
    setDescription('');
    setShowAddModal(false);
    fetchSteps();
  };

  const deleteStep = async (id: number) => {
    await supabase.from('warranties').delete().eq('id', id);
    fetchSteps();
  };

  const startEdit = (step: Warranty) => {
    setEditingStep(step);
    setTitle(step.title);
    setDescription(step.description);
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!editingStep) return;
    await supabase
      .from('warranties')
      .update({ title, description })
      .eq('id', editingStep.id);
    setEditingStep(null);
    setTitle('');
    setDescription('');
    setShowEditModal(false);
    fetchSteps();
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-black">Manage Delivery Process</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-red-700 text-white px-4 py-2 rounded hover:bg-red-800"
        >
          Add Step
        </button>
      </div>

      {/* Step List */}
      <div className="grid gap-4">
        {steps.map((step) => (
          <div
            key={step.id}
            className="bg-white p-4 rounded shadow flex justify-between items-center"
          >
            <div>
              <h3 className="font-bold text-black">{step.title}</h3>
              <p className="text-gray-700">{step.description}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => startEdit(step)}
                className="text-blue-600 hover:underline"
              >
                Edit
              </button>
              <button
                onClick={() => deleteStep(step.id)}
                className="text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-black">Add New Step</h2>
            <input
              type="text"
              placeholder="Step Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border p-2 w-full mb-2 rounded text-black"
            />
            <textarea
              placeholder="Step Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border p-2 w-full mb-4 rounded text-black"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded border"
              >
                Cancel
              </button>
              <button
                onClick={addStep}
                className="bg-red-700 text-white px-4 py-2 rounded hover:bg-red-800"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingStep && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-black">Edit Step</h2>
            <input
              type="text"
              placeholder="Step Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border p-2 w-full mb-2 rounded text-black"
            />
            <textarea
              placeholder="Step Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border p-2 w-full mb-4 rounded text-black"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded border"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800"
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
