"use client";

import { useEffect, useRef, useState } from "react";
import TopNavBarLoggedIn from "@/components/TopNavBarLoggedIn";
import Footer from "@/components/Footer";
import { createClient } from "@supabase/supabase-js";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);


type Showroom = {
  id: number;
  title: string;
  address: string;
  description: string;
  image?: string; // optional
};


function Expandable({ open, children }: { open: boolean; children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [maxH, setMaxH] = useState(0);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    if (open) setMaxH(el.scrollHeight);
    else setMaxH(0);
  }, [open, children]);

  return (
    <div
      style={{ maxHeight: maxH }}
      className="overflow-hidden transition-[max-height] duration-400 ease-in-out"
    >
      <div ref={innerRef} className={`transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}>
        {children}
      </div>
    </div>
  );
}


export default function ShowroomPage() {
  const [showrooms, setShowrooms] = useState<Showroom[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchShowrooms();
  }, []);

  const fetchShowrooms = async () => {
    const { data, error } = await supabase.from("showrooms").select("*");
    if (error) console.error(error);
    else setShowrooms(data || []);
  };

  const toggle = (id: number) => setOpenIndex(openIndex === id ? null : id);

  const chunked: Showroom[][] = [];
  for (let i = 0; i < showrooms.length; i += 3) chunked.push(showrooms.slice(i, i + 3));

  return (
    <div className="flex flex-col min-h-screen">
      <TopNavBarLoggedIn />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <h2 className="text-center text-3xl font-extrabold leading-tight">
            Visit us
            <br />
            <span className="inline-block mt-1">at our Showroom Locations</span>
          </h2>
          <div className="w-16 h-1 bg-red-600 mx-auto mt-3 mb-10 rounded-full" />

          {chunked.map((row, rowIdx) => (
            <div key={rowIdx} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mb-10">
              {row.map((s) => {
                const preview = s.description.length > 110 ? s.description.slice(0, 110) + "…" : s.description;
                const isOpen = openIndex === s.id;
                return (
                  <article key={s.id} className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden">
                    {s.image && <img src={s.image} alt={s.title} className="w-full h-48 object-cover" />}
                    <div className="p-4">
                      <h3 className="text-center text-lg font-semibold">{s.title}</h3>
                      <p className="mt-3 text-sm text-gray-700 min-h-[72px]">{preview}</p>
                      <Expandable open={isOpen}>
                        <p className="mt-2 text-sm text-gray-700">{s.description}</p>
                      </Expandable>
                      <button
                        onClick={() => toggle(s.id)}
                        className="mt-2 text-red-600 font-semibold text-sm hover:underline"
                      >
                        {isOpen ? "Show Less" : "Show More"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
