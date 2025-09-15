"use client";
import { useEffect, useState } from "react";
import { supabase } from "../Clients/Supabase/SupabaseClients";
import TopNavBarLoggedIn from "@/components/TopNavBarLoggedIn";
import Footer from "@/components/Footer";

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
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [openQuestion, setOpenQuestion] = useState<number | null>(null);

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
        if (data.length > 0) setActiveCategory(data[0].id); // default to first category
      } else {
        console.error(error);
      }
    };

    fetchFaqs();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <TopNavBarLoggedIn />
      <main className="flex-1 bg-white">
        {/* Hero Section */}
        <section
          className="relative h-72 flex items-center justify-center text-center"
          style={{
            backgroundImage: "url('/faqs.avif')",
            backgroundSize: "cover",
          }}
        >
          <div className="bg-white bg-opacity-90 px-8 py-4 rounded-md">
            <h1 className="text-3xl font-bold text-black">FAQs</h1>
          </div>
        </section>

        {/* FAQs Section */}
        <section className="bg-[#0a223d] py-12">
          <div className="bg-white max-w-4xl mx-auto p-8 shadow-lg rounded-md">
            <h2 className="text-2xl font-bold text-center mb-6 text-black">
              Frequently Asked Questions
            </h2>

            {/* Categories Tabs */}
            <div className="flex flex-wrap justify-center gap-6 mb-8 border-b pb-3 text-black">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setOpenQuestion(null);
                  }}
                  className={`font-medium ${
                    activeCategory === cat.id
                      ? "text-red-600 border-b-2 border-red-600"
                      : "text-gray-700 hover:text-red-600"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Accordion (questions of active category) */}
            <div className="space-y-4">
              {categories
                .find((cat) => cat.id === activeCategory)
                ?.faq_questions.map((q) => (
                  <div key={q.id} className="border-b">
                    <button
                      onClick={() =>
                        setOpenQuestion(openQuestion === q.id ? null : q.id)
                      }
                      className="w-full flex justify-between text-left font-semibold py-3 text-black"
                    >
                      <span>{q.question}</span>
                      <span className="text-red-600">
                        {openQuestion === q.id ? "−" : "+"}
                      </span>
                    </button>
                    {openQuestion === q.id && (
                      <p className="pb-3 text-gray-600">{q.answer}</p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
