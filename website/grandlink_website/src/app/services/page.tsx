"use client";

import TopNavBarLoggedIn from "@/components/TopNavBarLoggedIn";
import Footer from "@/components/Footer";
import { useState } from "react";
import { motion } from "framer-motion";
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

const SERVICES = [
  {
    icon: <FaCogs size={36} />,
    label: "Heavy Duty",
    info: "Heavy-duty aluminum and glass solutions for robust applications.",
  },
  {
    icon: <FaColumns size={36} />,
    label: "Sliding",
    info: "Smooth and space-saving sliding window and door systems.",
  },
  {
    icon: <FaWindowMaximize size={36} />,
    label: "Awning",
    info: "Awning windows for ventilation and modern style.",
  },
  {
    icon: <FaThLarge size={36} />,
    label: "Casement",
    info: "Casement windows for classic looks and easy operation.",
  },
  {
    icon: <FaWindowRestore size={36} />,
    label: "Top Hung",
    info: "Top hung windows for versatile airflow and design.",
  },
  {
    icon: <FaGripHorizontal size={36} />,
    label: "Bi-folding",
    info: "Bi-folding doors for wide openings and seamless transitions.",
  },
  {
    icon: <FaBuilding size={36} />,
    label: "Facade",
    info: "Modern glass facades for commercial and residential buildings.",
  },
  {
    icon: <FaThList size={36} />,
    label: "Curtain Wall",
    info: "Curtain wall systems for sleek, expansive glass exteriors.",
  },
  {
    icon: <FaDoorOpen size={36} />,
    label: "Canopy",
    info: "Stylish and functional canopies for entrances and walkways.",
  },
  {
    icon: <FaArrowsAltH size={36} />,
    label: "Glass Railing",
    info: "Glass railings for safety and unobstructed views.",
  },
  {
    icon: <FaWarehouse size={36} />,
    label: "Shower Enclosure",
    info: "Custom glass shower enclosures for modern bathrooms.",
  },
  {
    icon: <FaBorderAll size={36} />,
    label: "Glass Partition",
    info: "Glass partitions for open, light-filled interiors.",
  },
];

export default function ServicesPage() {
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen flex flex-col">
      <TopNavBarLoggedIn />
      <main className="flex-1 bg-white">
        <div className="w-full">
          <img
            src="/sevices.avif"
            alt="services"
            className="w-full h-64 object-cover"
          />
        </div>
        <section className="max-w-3xl mx-auto px-4 py-8 text-center text-black">
          <h1 className="text-2xl md:text-3xl font-bold mb-4 border-b-2 border-black inline-block pb-1">
            Our Services
          </h1>
          <p className="text-gray-700 mt-4 mb-8 underline underline-offset-2 decoration-[#232d3b]">
            We offer a comprehensive range of services tailored to meet the needs of
            both residential and commercial clients. From precision-crafted aluminum
            windows and doors to custom glass installations, our expertise spans
            across all facets of design, fabrication, and installation. Explore our
            full list of services below and discover how we can help transform your
            space with top-tier craftsmanship and innovative solutions built for
            style, durability, and performance.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {SERVICES.map((service, idx) => (
              <ServiceCard
                key={service.label}
                icon={service.icon}
                label={service.label}
                info={service.info}
                flipped={flippedIndex === idx}
                onClick={() =>
                  setFlippedIndex(flippedIndex === idx ? null : idx)
                }
              />
            ))}
          </div>
          <div className="flex flex-col items-center mt-6">
            <div className="bg-[#232d3b] text-white rounded-full w-16 h-16 flex items-center justify-center mb-2">
              <FaCogs size={32} />
            </div>
            <span className="font-semibold text-[#232d3b]">Custom Design</span>
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
          style={{
            transform: "rotateY(180deg)",
          }}
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
