'use client';

import Image from 'next/image';
import { useState } from 'react';
import { motion } from 'framer-motion';

const services = [
  {
    title: 'Heavy Duty',
    icon: '/icons/heavy-duty.png',
    description: 'Strong and durable aluminum systems built for tough environments.',
  },
  {
    title: 'Sliding',
    icon: '/icons/sliding.png',
    description: 'Smooth-sliding windows and doors for modern, space-saving solutions.',
  },
  {
    title: 'Awning',
    icon: '/icons/awning.png',
    description: 'Hinged at the top to allow ventilation and protection from rain.',
  },
  {
    title: 'Casement',
    icon: '/icons/casement.png',
    description: 'Side-hinged windows offering unobstructed views and airflow.',
  },
  {
    title: 'Top Hung',
    icon: '/icons/top-hung.png',
    description: 'Windows hinged at the top, ideal for compact and secure openings.',
  },
  {
    title: 'Bi-folding',
    icon: '/icons/bifolding.png',
    description: 'Space-efficient, elegant doors folding to open large areas.',
  },
  {
    title: 'Facade',
    icon: '/icons/facade.png',
    description: 'Custom aluminum-glass facades that add style and performance.',
  },
  {
    title: 'Curtain Wall',
    icon: '/icons/curtain-wall.png',
    description: 'Non-structural glass walls for contemporary building exteriors.',
  },
  {
    title: 'Canopy',
    icon: '/icons/canopy.png',
    description: 'Protective glass/aluminum canopies for walkways and entrances.',
  },
  {
    title: 'Glass Railing',
    icon: '/icons/glass-railing.png',
    description: 'Modern glass railings that combine safety and transparency.',
  },
  {
    title: 'Shower Enclosure',
    icon: '/icons/shower.png',
    description: 'Sleek, watertight glass enclosures for modern bathrooms.',
  },
  {
    title: 'Glass Partition',
    icon: '/icons/glass-partition.png',
    description: 'Interior glass dividers to separate spaces with elegance.',
  },
  {
    title: 'Custom Design',
    icon: '/icons/custom.png',
    description: 'Tailored solutions to meet your unique space and design needs.',
  },
];

export default function ServicesPage() {
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold text-center mb-4">Our Services</h1>
      <p className="text-center text-lg text-gray-700 max-w-2xl mx-auto mb-10">
        We offer a comprehensive range of services tailored to meet the needs of both residential and commercial clients. From precision-crafted aluminum windows and doors to custom glass installations, our expertise spans across all stages of design, fabrication, and installation.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {services.map((service, index) => (
          <motion.div
            key={index}
            onClick={() => setFlippedIndex(index === flippedIndex ? null : index)}
            className="w-full h-48 cursor-pointer perspective"
          >
            <motion.div
              animate={{ rotateY: flippedIndex === index ? 180 : 0 }}
              transition={{ duration: 0.6 }}
              className="relative w-full h-full transform-style-preserve-3d"
            >
              {/* Front */}
              <div className="absolute inset-0 bg-white shadow-md rounded-2xl flex flex-col items-center justify-center backface-hidden p-4">
                <Image src={service.icon} alt={service.title} width={48} height={48} />
                <p className="mt-4 text-lg font-medium text-center">{service.title}</p>
              </div>
              {/* Back */}
              <div className="absolute inset-0 bg-gray-100 shadow-md rounded-2xl flex items-center justify-center backface-hidden transform rotateY-180 p-4">
                <p className="text-sm text-center text-gray-800">{service.description}</p>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
