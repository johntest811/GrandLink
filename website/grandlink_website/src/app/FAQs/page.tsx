"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import TopNavBarLoggedIn from "@/components/TopNavBarLoggedIn";
import Footer from "@/components/Footer";

export default function FAQsPage() {

  const [faqs, setFaqs] = useState<any[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchFaqs = async () => {
      const { data, error } = await supabase.from("faqs").select("*");
      if (!error && data) setFaqs(data);
    };
    fetchFaqs();
  }, []);
 

return (
    <div className="min-h-screen flex flex-col">
      <TopNavBarLoggedIn />
      <main className="flex-1 bg-white">
        <section className="relative h-72 flex items-center justify-center text-center"
          style={{ backgroundImage: "url('/faqs.avif')", backgroundSize: "cover" }}>
          <div className="bg-white bg-opacity-90 px-8 py-4 rounded-md">
            <h1 className="text-3xl font-bold">FAQs</h1>
          </div>
        </section>

        <section className="bg-[#0a223d] py-12">
          <div className="bg-white max-w-3xl mx-auto p-8 shadow-lg rounded-md">
            <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div key={faq.id} className="border-b pb-2">
                  <button
                    className="w-full text-left flex justify-between font-bold text-gray-800"
                    onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                  >
                    {faq.question}
                    <span className="text-red-600">{openIndex === idx ? "−" : "+"}</span>
                  </button>
                  {openIndex === idx && (
                    <p className="mt-2 text-gray-600 text-sm">{faq.answer}</p>
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

