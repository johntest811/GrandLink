"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../Clients/Supabase/SupabaseClients";
import { Eye, Pencil } from "lucide-react";

type Task = {
  id: number;
  task_number: string;
  product_name: string;
  task_name: string;
  employee_name: string;
  employee_number: string;
  start_date: string;
  due_date: string;
  status: string;
};

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | null>(null);

  // Fetch tasks
  const fetchTasks = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .order("id", { ascending: true });

    if (data) setTasks(data as Task[]);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <>
      {/* PAGE CONTENT */}
      <div
        className={`p-6 bg-gray-50 min-h-screen transition ${
          selectedTask ? "blur-sm pointer-events-none" : ""
        }`}
      >
        <h1 className="text-2xl font-semibold mb-6">Task List</h1>

        {/* TABLE */}
        <div className="bg-white rounded-lg shadow border overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-600">
              <tr>
                <th className="px-6 py-3">Task#</th>
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">Task</th>
                <th className="px-6 py-3">Employee</th>
                <th className="px-6 py-3">Position</th>
                <th className="px-6 py-3">Production Start</th>
                <th className="px-6 py-3">Due</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-center">Action</th>
              </tr>
            </thead>

            <tbody>
              {tasks.map((task) => (
                <tr
                  key={task.id}
                  
                >
                  <td className="px-6 py-4">{task.task_number}</td>
                  <td className="px-6 py-4">{task.product_name}</td>
                  <td className="px-6 py-4">{task.task_name}</td>
                  <td className="px-6 py-4">{task.employee_name}</td>
                  <td className="px-6 py-4">Manager</td>
                  <td className="px-6 py-4">{task.start_date}</td>
                  <td className="px-6 py-4">{task.due_date}</td>
                  <td className="px-6 py-4 font-medium">
                    {task.status}
                  </td>

                  {/* ACTIONS */}
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setMode("view");
                        }}
                        className="h-8 w-8 rounded-md bg-yellow-400 hover:bg-yellow-500 text-white flex items-center justify-center"
                      >
                        <Eye size={16} />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setMode("edit");
                        }}
                        className="h-8 w-8 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center"
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* OVERLAY */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setSelectedTask(null);
              setMode(null);
            }}
          />

          {/* CARD */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 z-10">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-semibold">GE 103</h2>
                <p className="text-sm text-gray-500">
                  {mode === "edit" ? "Editor Page" : "Viewer Page"}
                </p>
              </div>

              <button
                onClick={() => {
                  setSelectedTask(null);
                  setMode(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <p className="text-sm font-medium mb-6">
              Task # {selectedTask.task_number}
            </p>

            {/* VIEW MODE */}
            {mode === "view" && (
              <>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-xs text-gray-500">Percentage</p>
                    <div className="mt-1 px-3 py-2 border rounded-md">
                      60 %
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    <div className="mt-1 px-3 py-2 border rounded-md">
                      On - Progress
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-xs text-gray-500 mb-2">Images</p>
                  <div className="flex gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-16 w-16 bg-gray-200 rounded-md"
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-2">Remarks</p>
                  <div className="border rounded-md p-3 text-sm">
                    • Created the framework of the product <br />
                    • Aluminum piece #123 curved to 90°
                  </div>
                </div>
              </>
            )}

            {/* EDIT MODE */}
            {mode === "edit" && (
              <>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-gray-500">
                      Percentage *
                    </label>
                    <select className="w-full mt-1 px-3 py-2 border rounded-md">
                      <option>Choose Status</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">
                      Status *
                    </label>
                    <select className="w-full mt-1 px-3 py-2 border rounded-md">
                      <option>Choose Status</option>
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="text-xs text-gray-500">
                    Image *
                  </label>
                  <input type="file" className="block mt-1" />
                  <input type="file" className="block mt-2" />
                </div>

                <div>
                  <label className="text-xs text-gray-500">
                    Remarks *
                  </label>
                  <textarea
                    rows={4}
                    className="w-full mt-1 border rounded-md p-3"
                    placeholder="Remarks"
                  />
                </div>
              </>
            )}

            {/* FOOTER */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setSelectedTask(null);
                  setMode(null);
                }}
                className="px-6 py-2 border rounded-md"
              >
                Cancel
              </button>

              {mode === "edit" && (
                <button className="px-6 py-2 bg-blue-600 text-white rounded-md">
                  Add
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
