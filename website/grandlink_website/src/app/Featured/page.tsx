"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../Clients/Supabase/SupabaseClients";
import UnifiedTopNavBar from "@/components/UnifiedTopNavBar";
import Footer from "@/components/Footer";

interface Project {
  id: number;
  title: string;
  description: string;
  image_url?: string;
  link_url?: string;
}

function FeaturedProjectsContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      const { data, error } = await supabase
        .from("featured_projects")
        .select("*")
        .order("id", { ascending: true });

      if (error) console.error(error);
      else setProjects(data || []);
    }

    fetchProjects();
  }, []);

  return (
    <section className="bg-[#232d3b] text-white py-16">
      {/* ================= HEADER CARD ================= */}
      <div className="max-w-5xl mx-auto px-6 mb-16">
        <div className="bg-[#1c2531]/80 backdrop-blur rounded-2xl shadow-2xl p-10 text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
            Featured Projects
          </h2>

          <div className="h-1 w-28 bg-[#B11C1C] mx-auto mb-6 rounded-full" />

          <p className="text-gray-300 text-lg md:text-xl leading-relaxed max-w-4xl mx-auto">
            Our featured projects showcase the quality, precision, and innovation
            that define Grand East. From sleek residential transformations to
            large-scale commercial installations, these projects highlight our
            commitment to delivering exceptional results. Each project is a
            testament to our craftsmanship, attention to detail, and dedication
            to client satisfaction. Explore the success stories we’re proud to
            share and see how we’ve helped bring our clients' visions to life.
          </p>
        </div>
      </div>

      {/* ================= PROJECT GRID ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 px-6 max-w-7xl mx-auto">
        {projects.map((p) => (
          <motion.div
            key={p.id}
            whileHover={{ scale: 1.06 }}
            className="cursor-pointer bg-white rounded-xl shadow-lg overflow-hidden"
            onClick={() => setSelected(p)}
          >
            <Image
              src={p.image_url || "/placeholder.jpg"}
              alt={p.title}
              width={400}
              height={300}
              className="w-full h-44 object-cover"
            />
          </motion.div>
        ))}
      </div>

      {/* ================= MODAL ================= */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 relative"
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.85 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={selected.image_url || "/placeholder.jpg"}
                alt={selected.title}
                width={600}
                height={400}
                className="rounded-xl mb-4 w-full object-cover"
              />

              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                {selected.title}
              </h3>

              <p className="text-gray-600 mb-4 leading-relaxed">
                {selected.description}
              </p>

              {selected.link_url && (
                <a
                  href={selected.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-[#B11C1C] font-semibold underline"
                >
                  View Project →
                </a>
              )}

              <button
                onClick={() => setSelected(null)}
                className="absolute top-3 right-4 text-gray-500 hover:text-red-600 text-xl"
              >
                ✕
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default function FeaturedProjectsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#232d3b]">
      <UnifiedTopNavBar />
      <main className="flex-1">
        <FeaturedProjectsContent />
      </main>
      <Footer />
    </div>
  );
}
