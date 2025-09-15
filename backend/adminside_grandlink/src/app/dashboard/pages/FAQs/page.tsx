"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../Clients/Supabase/SupabaseClients";
import { PlusCircle, Trash2 } from "lucide-react";

interface Category {
  id: number;
  name: string;
}

interface Question {
  id: number;
  category_id: number;
  question: string;
  answer: string;
}

export default function AdminFAQsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [newQuestions, setNewQuestions] = useState<
    Record<number, { question: string; answer: string }>
  >({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchQuestions();
  }, []);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("faq_categories")
      .select("*")
      .order("id");
    if (error) console.error(error);
    else setCategories(data || []);
  };

  const fetchQuestions = async () => {
    const { data, error } = await supabase
      .from("faq_questions")
      .select("*")
      .order("id");
    if (error) console.error(error);
    else setQuestions(data || []);
  };

  const addCategory = async () => {
    if (!newCategory) return;
    const { error } = await supabase
      .from("faq_categories")
      .insert([{ name: newCategory }]);
    if (error) console.error(error);
    else {
      setNewCategory("");
      fetchCategories();
    }
  };

  const deleteCategory = async (id: number) => {
    const { error } = await supabase
      .from("faq_categories")
      .delete()
      .eq("id", id);
    if (error) console.error(error);
    else {
      fetchCategories();
      fetchQuestions();
    }
  };

  const handleNewQuestionChange = (
    catId: number,
    field: "question" | "answer",
    value: string
  ) => {
    setNewQuestions((prev) => ({
      ...prev,
      [catId]: {
        ...prev[catId],
        [field]: value,
      },
    }));
    setDirty(true);
  };

  const addQuestion = async (categoryId: number) => {
    const q = newQuestions[categoryId];
    if (!q || !q.question || !q.answer) return;
    const { error } = await supabase.from("faq_questions").insert([
      { category_id: categoryId, question: q.question, answer: q.answer },
    ]);
    if (error) console.error(error);
    else {
      setNewQuestions((prev) => ({
        ...prev,
        [categoryId]: { question: "", answer: "" },
      }));
      fetchQuestions();
      setDirty(false);
    }
  };

  const deleteQuestion = async (id: number) => {
    const { error } = await supabase
      .from("faq_questions")
      .delete()
      .eq("id", id);
    if (error) console.error(error);
    else fetchQuestions();
  };

  const handleSave = async () => {
    if (!dirty) return;
    const confirmed = confirm("Save changes?");
    if (!confirmed) return;

    setSaving(true);
    await fetchQuestions();
    setSaving(false);
    setDirty(false);
    alert("Changes saved to Supabase ✅");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">
        Admin FAQs Manager
      </h1>

      {/* Add Category */}
      <div className="flex gap-2 mb-8">
        <input
          type="text"
          placeholder="New Category Name"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          className="flex-1 border rounded-lg px-4 py-2 shadow-sm focus:ring-2 focus:ring-blue-400 text-gray-800"
        />
        <button
          onClick={addCategory}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow transition"
        >
          <PlusCircle size={18} />
          Add Column
        </button>
      </div>

      {/* Categories */}
      <div className="space-y-6">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="bg-white border rounded-xl shadow-sm p-5"
          >
            {/* Category header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-700">
                {cat.name}
              </h2>
              <button
                onClick={() => deleteCategory(cat.id)}
                className="text-red-500 hover:text-red-700 transition"
              >
                <Trash2 size={20} />
              </button>
            </div>

            {/* Add Question Form */}
            <div className="space-y-2 mb-4">
              <input
                type="text"
                placeholder="Question"
                value={newQuestions[cat.id]?.question || ""}
                onChange={(e) =>
                  handleNewQuestionChange(cat.id, "question", e.target.value)
                }
                className="w-full border rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400 text-gray-800"
              />
              <textarea
                placeholder="Answer"
                value={newQuestions[cat.id]?.answer || ""}
                onChange={(e) =>
                  handleNewQuestionChange(cat.id, "answer", e.target.value)
                }
                className="w-full border rounded-lg px-3 py-2 shadow-sm focus:ring-2 focus:ring-blue-400 text-gray-800"
              />
              <button
                onClick={() => addQuestion(cat.id)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow transition"
              >
                + Add Question
              </button>
            </div>

            {/* Questions */}
            <div className="space-y-3">
              {questions
                .filter((q) => q.category_id === cat.id)
                .map((q) => (
                  <div
                    key={q.id}
                    className="bg-gray-50 border rounded-lg p-3 flex justify-between items-start shadow-sm"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{q.question}</p>
                      <p className="text-gray-600 text-sm">{q.answer}</p>
                    </div>
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="mt-8 text-right">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className={`px-6 py-3 rounded-lg font-semibold shadow transition ${
            dirty
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-gray-300 text-gray-600 cursor-not-allowed"
          }`}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
