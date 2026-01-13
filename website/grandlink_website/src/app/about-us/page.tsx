"use client";

import { useEffect, useState } from "react";
import { supabase } from "../Clients/Supabase/SupabaseClients";
import UnifiedTopNavBar from "@/components/UnifiedTopNavBar";
import Footer from "@/components/Footer";
import Image from "next/image";

export default function AboutUsPage() {
  const [about, setAbout] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.from("about").select("*").single();
      if (!error) setAbout(data);
    };
    fetchData();
  }, []);

  if (!about)
    return (
      <p className="text-center mt-32 text-xl text-gray-500">Loading...</p>
    );

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f6f8]">
      <UnifiedTopNavBar />

      <main className="flex-1">
        {/* ================= HERO ================= */}
        <section className="relative h-[520px] flex items-center justify-center">
          <Image
            src="/aboutus.avif"
            alt="About Us"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/65" />

          <div className="relative z-10 text-center px-10 max-w-6xl">
            <h1 className="text-6xl md:text-7xl font-extrabold text-white tracking-tight">
              About Us
            </h1>
            <div className="w-28 h-1.5 bg-[#8B1C1C] mx-auto my-6 rounded-full" />
            <p className="text-2xl md:text-3xl italic text-gray-200 leading-snug">
              High Quality, Long Lasting Performance
            </p>
          </div>
        </section>

        {/* ================= COMPANY INFO ================= */}
        <section className="relative -mt-28 px-10">
          <div className="max-w-7xl mx-auto bg-white rounded-[2.5rem] shadow-2xl p-16 text-center">
            <Image
              src="/GE Logo.avif"
              alt="Grand East Logo"
              width={280}
              height={160}
              className="mx-auto mb-10"
            />

            <h2 className="text-5xl font-extrabold text-[#232d3b] mb-10">
              {about.grand}
            </h2>

            <p className="text-xl md:text-2xl text-gray-700 leading-relaxed max-w-6xl mx-auto">
              {about.description}
            </p>
          </div>
        </section>

        {/* ================= MISSION & VISION ================= */}
        <section className="mt-36">
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Mission */}
            <div className="bg-[#8B1C1C] min-h-[420px] flex items-center justify-center px-16">
              <div className="max-w-xl text-center text-white">
                <h3 className="text-5xl font-bold mb-8 tracking-wide">
                  MISSION
                </h3>
                <p className="text-2xl leading-relaxed">
                  {about.mission}
                </p>
              </div>
            </div>

            {/* Vision */}
            <div className="bg-[#232d3b] min-h-[420px] flex items-center justify-center px-16">
              <div className="max-w-xl text-center text-white">
                <h3 className="text-5xl font-bold mb-8 tracking-wide">
                  VISION
                </h3>
                <p className="text-2xl leading-relaxed">
                  {about.vision}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= CTA ================= */}
        <section className="mt-40 px-10 pb-24">
          <div className="relative w-full max-w-[1400px] mx-auto rounded-[2.5rem] overflow-hidden">
            <Image
              src="/aboutus.avif"
              alt="CTA Background"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/70" />

            <div className="relative z-10 p-20 flex flex-col md:flex-row items-center justify-between gap-10">
              <div>
                <h3 className="text-5xl font-extrabold text-white mb-4">
                  Ready to elevate your space?
                </h3>
                <p className="text-2xl text-gray-200">
                  Inquire now for a custom solution.
                </p>
              </div>

              <a
                href="/Inquire"
                className="bg-[#8B1C1C] hover:bg-[#a82c2c] transition text-white font-bold px-14 py-6 rounded-2xl text-2xl shadow-2xl"
              >
                CONTACT US
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
