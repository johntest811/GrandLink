"use client";

import { useEffect, useState } from "react";
import { supabase } from "../Clients/Supabase/SupabaseClients";
import UnifiedTopNavBar from "@/components/UnifiedTopNavBar";
import Footer from "@/components/Footer";

interface FAQQuestion {
  id: number;
  question: string;
  answer: string;
  categoryId: number;
}

interface FAQCategory {
  id: number;
  name: string;
  faq_questions: {
    id: number;
    question: string;
    answer: string;
  }[];
}

export default function FAQsPage() {
  const [categories, setCategories] = useState<FAQCategory[]>([]);
  const [allQuestions, setAllQuestions] = useState<FAQQuestion[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [openQuestion, setOpenQuestion] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const fetchFaqs = async () => {
      const { data, error } = await supabase
        .from("faq_categories")
        .select(`
          id,
          name,
          faq_questions (
            id,
            question,
            answer
          )
        `)
        .order("id", { ascending: true });

      if (!error && data) {
        setCategories(data);
        if (data.length > 0) setActiveCategory(data[0].id);

        const flattened: FAQQuestion[] = data.flatMap((cat) =>
          cat.faq_questions.map((q) => ({
            ...q,
            categoryId: cat.id,
          }))
        );

        setAllQuestions(flattened);
      } else {
        console.error(error);
      }
    };

    fetchFaqs();
  }, []);

  const filteredQuestions = searchQuery
    ? allQuestions.filter(
        (q) =>
          q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allQuestions.filter((q) => q.categoryId === activeCategory);

  const suggestions = searchQuery
    ? allQuestions
        .filter((q) =>
          q.question.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 5)
    : [];

  const handleCancelSearch = () => {
    setSearchQuery("");
    setShowSuggestions(false);
    setOpenQuestion(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <UnifiedTopNavBar />

      <main className="flex-1">
        {/* Hero */}
        <section
          className="relative h-72 flex items-center justify-center text-center"
          style={{
            backgroundImage: "url('/faqs.avif')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-black/60"></div>
          <div className="relative z-10 px-6">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white">
              FAQs
            </h1>
            <p className="text-gray-200 mt-2">
              Find quick answers to your questions
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="py-12 px-6">
          <div className="bg-white max-w-5xl mx-auto p-8 shadow-xl rounded-2xl">
            <h2 className="text-3xl font-bold text-center mb-6">
              Frequently Asked Questions
            </h2>

            {/* 🔍 Search with Cancel */}
            <div className="relative max-w-xl mx-auto mb-10">
              <input
                type="text"
                placeholder="Search a question or keyword..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                  setOpenQuestion(null);
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                className="w-full px-5 py-3 pr-12 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
              />

              {/* ❌ Cancel Button */}
              {searchQuery && (
                <button
                  onClick={handleCancelSearch}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-600 text-xl font-bold"
                >
                  ×
                </button>
              )}

              {/* Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-20 w-full bg-white border rounded-xl mt-2 shadow-lg overflow-hidden">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSearchQuery(s.question);
                        setActiveCategory(s.categoryId);
                        setOpenQuestion(s.id);
                        setShowSuggestions(false);
                      }}
                      className="block w-full text-left px-4 py-3 hover:bg-gray-100 text-sm"
                    >
                      {s.question}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Categories */}
            {!searchQuery && (
              <div className="flex flex-wrap justify-center gap-4 mb-10">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setActiveCategory(cat.id);
                      setOpenQuestion(null);
                    }}
                    className={`px-5 py-2.5 rounded-full font-semibold transition
                      ${
                        activeCategory === cat.id
                          ? "bg-red-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600"
                      }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Questions */}
            <div className="space-y-4">
              {filteredQuestions.map((q) => (
                <div
                  key={q.id}
                  className="border rounded-lg overflow-hidden shadow-sm"
                >
                  <button
                    onClick={() =>
                      setOpenQuestion(openQuestion === q.id ? null : q.id)
                    }
                    className="w-full flex justify-between items-center py-4 px-5 bg-gray-50 hover:bg-gray-100"
                  >
                    <span className="font-semibold">{q.question}</span>
                    <span className="text-red-600 text-lg">
                      {openQuestion === q.id ? "−" : "+"}
                    </span>
                  </button>

                  {openQuestion === q.id && (
                    <div className="px-5 pb-4 bg-white text-gray-700 text-sm leading-relaxed">
                      {q.answer}
                    </div>
                  )}
                </div>
              ))}

              {filteredQuestions.length === 0 && (
                <p className="text-center text-gray-500 text-sm">
                  No matching questions found.
                </p>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
