"use client";

import TopNavBarLoggedIn from "@/components/TopNavBarLoggedIn";
import Footer from "@/components/Footer";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@supabase/supabase-js";
import * as FaIcons from "react-icons/fa";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Service = {
  id: number;
  name: string;
  short_description: string;
  long_description: string;
  icon?: string; // icon name from react-icons
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    const { data, error } = await supabase.from("services").select("*");
    if (error) console.error(error);
    else setServices(data || []);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <TopNavBarLoggedIn />
      <main className="flex-1">
        {/* Hero */}
        <div className="relative w-full h-64">
          <img
            src="/sevices.avif"
            alt="services"
            className="w-full h-64 object-cover"
          />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <h1 className="text-3xl md:text-4xl font-extrabold text-white drop-shadow-lg">
              Our Services
            </h1>
          </div>
        </div>

        {/* Section */}
        <section className="max-w-6xl mx-auto px-6 py-12">
          <p className="text-center text-gray-700 mb-10 text-lg max-w-2xl mx-auto">
            Explore our full range of services, expertly designed to meet both
            residential and commercial needs.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {services.map((s, idx) => {
              const IconComponent = s.icon
                ? (FaIcons as any)[s.icon] || FaIcons.FaCogs
                : FaIcons.FaCogs;

              return (
                <ServiceCard
                  key={s.id}
                  icon={<IconComponent size={40} />}
                  label={s.name}
                  info={s.short_description}
                  flipped={flippedIndex === idx}
                  onClick={() =>
                    setFlippedIndex(flippedIndex === idx ? null : idx)
                  }
                />
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function ServiceCard({
  icon,
  label,
  info,
  flipped,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  info: string;
  flipped: boolean;
  onClick: () => void;
}) {
  return (
    <div className="perspective" onClick={onClick}>
      <motion.div
        className="relative w-full h-52 cursor-pointer"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Front */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#232d3b] text-white rounded-2xl shadow-xl backface-hidden hover:scale-105 transition-transform">
          <div className="p-3 bg-white/10 rounded-full mb-2">{icon}</div>
          <span className="mt-2 font-bold text-lg">{label}</span>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-white text-[#232d3b] rounded-2xl shadow-xl backface-hidden p-4"
          style={{ transform: "rotateY(180deg)" }}
        >
          <span className="font-semibold text-lg mb-2">{label}</span>
          <p className="text-sm text-gray-600 text-center flex-1">
            {info}
          </p>
          <button className="mt-4 bg-[#8B1C1C] text-white px-4 py-1 rounded-full font-medium hover:bg-[#a83232] transition text-sm">
            Learn More
          </button>
        </div>
      </motion.div>

      <style jsx>{`
        .perspective {
          perspective: 1200px;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
      `}</style>
    </div>
  );
}
