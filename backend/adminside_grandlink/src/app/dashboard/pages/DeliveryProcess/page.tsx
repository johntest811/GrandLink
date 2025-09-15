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
  const [editingId, setEditingId] = useState<number | null>(null);

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
    fetchSteps();
  };

  const deleteStep = async (id: number) => {
    await supabase.from('warranties').delete().eq('id', id);
    fetchSteps();
  };

  const startEdit = (step: Warranty) => {
    setEditingId(step.id);
    setTitle(step.title);
    setDescription(step.description);
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    await supabase
      .from('warranties')
      .update({ title, description })
      .eq('id', editingId);
    setEditingId(null);
    setTitle('');
    setDescription('');
    fetchSteps();
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-black">Manage Delivery Process</h1>

      {/* Add/Edit Step */}
      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-lg font-semibold mb-4 text-black">
          {editingId ? 'Edit Step' : 'Add New Step'}
        </h2>
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
          className="border p-2 w-full mb-2 rounded text-black"
        />
        {editingId ? (
          <button
            onClick={saveEdit}
            className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800"
          >
            Save Changes
          </button>
        ) : (
          <button
            onClick={addStep}
            className="bg-red-700 text-white px-4 py-2 rounded hover:bg-red-800"
          >
            Add Step
          </button>
        )}
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
              <p className="text-black">{step.description}</p>
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
    </div>
  );
}
