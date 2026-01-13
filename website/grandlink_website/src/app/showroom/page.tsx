"use client";

import { useEffect, useRef, useState } from "react";
import UnifiedTopNavBar from "@/components/UnifiedTopNavBar";
import Footer from "@/components/Footer";
import { supabase } from "../Clients/Supabase/SupabaseClients";

type Showroom = {
  id: number;
  title: string;
  address: string;
  description: string;
  image?: string;
};

export default function ShowroomPage() {
  const [showrooms, setShowrooms] = useState<Showroom[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [hasOverflow, setHasOverflow] = useState<Record<number, boolean>>({});

  const descRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    fetchShowrooms();
  }, []);

  useEffect(() => {
    // Measure overflow AFTER render
    const newOverflow: Record<number, boolean> = {};

    showrooms.forEach((s) => {
      const el = descRefs.current[s.id];
      if (el) {
        newOverflow[s.id] = el.scrollHeight > el.clientHeight;
      }
    });

    setHasOverflow(newOverflow);
  }, [showrooms]);

  const fetchShowrooms = async () => {
    const { data, error } = await supabase.from("showrooms").select("*");
    if (error) console.error(error.message);
    else setShowrooms(data || []);
  };

  const toggle = (id: number) => {
    setOpenId(openId === id ? null : id);
  };

  // chunk rows by 3
  const rows: Showroom[][] = [];
  for (let i = 0; i < showrooms.length; i += 3) {
    rows.push(showrooms.slice(i, i + 3));
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <UnifiedTopNavBar />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <h2 className="text-center text-4xl font-extrabold">
            Visit us
            <br />
            <span className="text-[#B11C1C]">
              at our Showroom Locations
            </span>
          </h2>

          <div className="w-20 h-1 bg-[#B11C1C] mx-auto mt-4 mb-12 rounded-full" />

          {rows.map((row, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12"
            >
              {row.map((s) => {
                const isOpen = openId === s.id;

                return (
                  <article
                    key={s.id}
                    className="bg-white rounded-2xl shadow-md overflow-hidden flex flex-col h-[620px]"
                  >
                    {/* Image */}
                    <div className="h-[360px] bg-gray-100">
                      {s.image && (
                        <img
                          src={s.image}
                          alt={s.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="text-xl font-bold text-[#B11C1C] text-center">
                        {s.title}
                      </h3>

                      <p className="text-center text-gray-700 mt-1 mb-2">
                        {s.address}
                      </p>

                      <div
                        ref={(el) => {
                          descRefs.current[s.id] = el;
                        }}
                        className={`text-lg text-gray-800 leading-relaxed transition-all ${
                          isOpen ? "" : "line-clamp-4"
                        }`}
                        dangerouslySetInnerHTML={{ __html: s.description }}
                      />

                      {/* Show button ONLY if overflow exists */}
                      {hasOverflow[s.id] && (
                        <button
                          onClick={() => toggle(s.id)}
                          className="mt-3 self-center text-[#B11C1C] font-semibold hover:underline"
                        >
                          {isOpen ? "Show Less" : "Show More"}
                        </button>
                      )}
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
