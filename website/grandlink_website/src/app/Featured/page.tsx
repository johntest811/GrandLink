"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

// Sample 
const projects = [
  {
    id: 1,
    name: "Modern Glass House",
    img: "/projects/p1.jpg",
    link: "https://example.com/project1",
    details: "A sleek modern glass house with premium aluminum framing."
  },
  {
    id: 2,
    name: "Luxury Villa",
    img: "/projects/p2.jpg",
    link: "https://example.com/project2",
    details: "A luxury villa featuring wide sliding doors and open living spaces."
  },
  {
    id: 3,
    name: "Commercial Building",
    img: "/projects/p3.jpg",
    link: "https://example.com/project3",
    details: "High-rise commercial building with energy-efficient windows."
  },
  // add more
];

export default function FeaturedProjects() {
  const [selected, setSelected] = useState<any>(null);

  return (
    <div className="bg-white py-10">
      <h2 className="text-3xl font-bold text-center mb-6">Featured Projects</h2>
      <p className="text-center text-gray-600 max-w-2xl mx-auto mb-10">
        Explore our showcase of premium residential and commercial installations.
        Each project is a testament to our craftsmanship and client satisfaction.
      </p>

      {/* Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 px-4">
        {projects.map((p) => (
          <motion.div
            key={p.id}
            whileHover={{ scale: 1.05 }}
            className="cursor-pointer"
            onClick={() => setSelected(p)}
          >
            <Image
              src={p.img}
              alt={p.name}
              width={400}
              height={300}
              className="w-full h-40 object-cover rounded-lg shadow"
            />
          </motion.div>
        ))}
      </div>

      {/* Modal Preview */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              className="bg-white rounded-xl shadow-xl max-w-lg w-full p-5 relative"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={selected.img}
                alt={selected.name}
                width={600}
                height={400}
                className="rounded-lg mb-4 w-full object-cover"
              />
              <h3 className="text-xl font-bold">{selected.name}</h3>
              <p className="text-gray-600 my-2">{selected.details}</p>
              <a
                href={selected.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 font-semibold underline"
              >
                View Project
              </a>
              <button
                onClick={() => setSelected(null)}
                className="absolute top-2 right-2 text-gray-600 hover:text-red-500 text-lg"
              >
                ✕
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
