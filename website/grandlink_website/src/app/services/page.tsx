"use client";

import TopNavBarLoggedIn from "@/components/TopNavBarLoggedIn";
import Footer from "@/components/Footer";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@supabase/supabase-js";
import {
  FaCogs,
  FaColumns,
  FaWindowMaximize,
  FaThLarge,
  FaWindowRestore,
  FaGripHorizontal,
  FaBuilding,
  FaThList,
  FaDoorOpen,
  FaArrowsAltH,
  FaWarehouse,
  FaBorderAll, 
  
} from "react-icons/fa";
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
  icon?: string; // icon name
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
    <div className="min-h-screen flex flex-col">
      <TopNavBarLoggedIn />
      <main className="flex-1 bg-white">
        <div className="w-full">
          <img src="/sevices.avif" alt="services" className="w-full h-64 object-cover" />
        </div>
        <section className="max-w-3xl mx-auto px-4 py-8 text-center text-black">
          <h1 className="text-2xl md:text-3xl font-bold mb-4 border-b-2 border-black inline-block pb-1">
            Our Services
          </h1>
          <p className="text-gray-700 mt-4 mb-8 underline underline-offset-2 decoration-[#232d3b]">
            Explore our full range of services, expertly designed to meet both residential and commercial needs.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {services.map((s, idx) => {
              const IconComponent = s.icon ? (FaIcons as any)[s.icon] || FaIcons.FaCogs : FaIcons.FaCogs;
              return (
                <ServiceCard
                  key={s.id}
                  icon={<IconComponent size={36} />}
                  label={s.name}
                  info={s.short_description}
                  flipped={flippedIndex === idx}
                  onClick={() => setFlippedIndex(flippedIndex === idx ? null : idx)}
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
        className="relative w-full h-32 cursor-pointer"
        style={{ perspective: 1000 }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Front */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center bg-[#232d3b] text-white rounded shadow-lg backface-hidden`}
        >
          {icon}
          <span className="mt-2 font-semibold">{label}</span>
        </div>
        {/* Back */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center bg-white text-[#232d3b] rounded shadow-lg backface-hidden`}
          style={{ transform: "rotateY(180deg)" }}
        >
          <span className="font-semibold mb-2">{label}</span>
          <p className="text-xs mb-3 px-2 text-center">{info}</p>
          <button className="bg-[#8B1C1C] text-white px-4 py-1 rounded font-semibold hover:bg-[#a83232] transition text-xs">
            Learn More
          </button>
        </div>
      </motion.div>
      <style jsx>{`
        .perspective {
          perspective: 1000px;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
      `}</style>
    </div>
  );
}