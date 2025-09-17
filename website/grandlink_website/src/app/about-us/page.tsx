"use client";
import { useEffect, useState } from "react";
import { supabase } from "../Clients/Supabase/SupabaseClients";
import TopNavBarLoggedIn from "@/components/TopNavBarLoggedIn";
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

  if (!about) return <p className="text-center mt-10">Loading...</p>;

  return (
    <div className="min-h-screen flex flex-col">
      <TopNavBarLoggedIn />
      <main className="flex-1 bg-gray-50">
        {/* Hero */}
        <div className="relative w-full h-64 md:h-80">
          <Image
            src="/aboutus.avif"
            alt="About Us Hero"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/70 flex flex-col items-center justify-center">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-wide drop-shadow-lg">
              About Us
            </h1>
            <p className="text-gray-200 mt-2 text-center max-w-xl">
              Get to know our story, our mission, and our vision for the future.
            </p>
          </div>
        </div>

        {/* Grand Section */}
        <section className="px-6 py-12">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-3xl font-extrabold text-gray-900 mb-4">
              {about.grand}
            </h3>
            <p className="text-lg text-gray-700 leading-relaxed">
              {about.description}
            </p>
          </div>
        </section>

        {/* Mission & Vision */}
        <section className="grid md:grid-cols-2 gap-6 px-6 pb-12 max-w-6xl mx-auto">
          {/* Mission */}
          <div className="bg-gradient-to-br from-[#8B1C1C] to-[#B23A3A] rounded-2xl p-8 shadow-md hover:shadow-xl transition">
            <h4 className="text-2xl font-bold mb-3 text-white border-b border-white/30 pb-2">
              🚀 Mission
            </h4>
            <p className="text-gray-100 text-lg leading-relaxed">
              {about.mission}
            </p>
          </div>

          {/* Vision */}
          <div className="bg-gradient-to-br from-[#232d3b] to-[#3B4A5C] rounded-2xl p-8 shadow-md hover:shadow-xl transition">
            <h4 className="text-2xl font-bold mb-3 text-white border-b border-white/30 pb-2">
              🌍 Vision
            </h4>
            <p className="text-gray-100 text-lg leading-relaxed">
              {about.vision}
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
