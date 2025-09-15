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
      <main className="flex-1 bg-white">
        {/* Hero */}
        <div className="relative w-full h-56 md:h-64">
          <Image src="/aboutus.avif" alt="About Us Hero" fill className="object-cover" priority />
          <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 border-b-2 border-[#8B1C1C] pb-1 px-4">
              About Us
            </h1>
          </div>
        </div>

        {/* Grand Section */}
        <section className="px-6 py-8">
          <h3 className="text-xl font-bold mb-4 text-center text-black">{about.grand}</h3>
          <p className="max-w-2xl mx-auto text-center text-gray-700">{about.description}</p>
        </section>

        {/* Mission & Vision */}
        <section className="flex flex-col md:flex-row">
          <div className="flex-1 bg-[#8B1C1C] text-white p-8">
            <h4 className="text-2xl font-bold mb-4">MISSION</h4>
            <p>{about.mission}</p>
          </div>
          <div className="flex-1 bg-[#232d3b] text-white p-8">
            <h4 className="text-2xl font-bold mb-4">VISION</h4>
            <p>{about.vision}</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}