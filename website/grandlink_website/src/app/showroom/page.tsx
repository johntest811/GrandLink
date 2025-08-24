"use client";

import { useEffect, useRef, useState } from "react";

type Branch = {
  name: string;
  image: string;
  details: string;
  preview?: string;
};

const branches: Branch[] = [
  {
    name: "BALINTAWAK BRANCH",
    image: "/branches/balintawak.jpg",
    details: "Unit A-24 CW Home Depot, Apolonio Samson, Quezon City. Contact: 09532718804.",
  },
  {
    name: "STA. ROSA BRANCH",
    image: "/branches/starosa.jpg",
    details: "Unit 8 CW Home Depot, Sta. Rosa, Laguna. Mam Maddy - 09754201355.",
  },
  {
    name: "UGONG BRANCH",
    image: "/branches/ugong.jpg",
    details: "Unit B-30 CW Home Depot, Pasig City. Mam Cheng - 09770881000.",
  },
  {
    name: "MAKATI BRANCH",
    image: "/branches/makati.jpg",
    details: "123 Ayala Avenue, Makati City. Contact: 09981234567.",
  },
  {
    name: "CEBU BRANCH",
    image: "/branches/cebu.jpg",
    details: "456 SM Seaside Complex, Cebu City. Contact: 09876543210.",
  },
  {
    name: "DAVAO BRANCH",
    image: "/branches/davao.jpg",
    details: "789 Abreeza Mall, Davao City. Contact: 09171234567.",
  },
  // add more branches
];

function Expandable({ open, children }: { open: boolean; children: React.ReactNode }) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [maxH, setMaxH] = useState(0);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    if (open) {
      const h = el.scrollHeight;
      requestAnimationFrame(() => setMaxH(h));
    } else {
      setMaxH(0);
    }
  }, [open, children]);

  return (
    <div
      style={{ maxHeight: maxH }}
      className="overflow-hidden transition-[max-height] duration-400 ease-in-out"
      aria-hidden={!open}
    >
      <div
        ref={innerRef}
        className={`transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      >
        {children}
      </div>
    </div>
  );
}

export default function ShowroomPage() {
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenIndex((curr) => (curr === id ? null : id));
  };

  // split into rows of 3
  const chunked = [];
  for (let i = 0; i < branches.length; i += 3) {
    chunked.push(branches.slice(i, i + 3));
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <h2 className="text-center text-3xl font-extrabold leading-tight">
        Visit us
        <br />
        <span className="inline-block mt-1">at our Showroom Locations</span>
      </h2>
      <div className="w-16 h-1 bg-red-600 mx-auto mt-3 mb-10 rounded-full" />

      {chunked.map((row, rowIdx) => (
        <div key={rowIdx} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mb-10">
          {row.map((b, i) => {
            const id = `branch-${rowIdx}-${i}`;
            const preview =
              b.preview ?? (b.details.length > 110 ? b.details.slice(0, 110) + "…" : b.details);
            const isOpen = openIndex === id;

            return (
              <article
                key={id}
                className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden"
              >
                <img src={b.image} alt={b.name} className="w-full h-48 object-cover" />

                <div className="p-4">
                  <h3 className="text-center text-lg font-semibold">{b.name}</h3>

                  <p className="mt-3 text-sm text-gray-700 min-h-[72px]">{preview}</p>

                  <Expandable open={isOpen}>
                    <p className="mt-2 text-sm text-gray-700">{b.details}</p>
                  </Expandable>

                  <button
                    onClick={() => toggle(id)}
                    className="mt-2 text-red-600 font-semibold text-sm hover:underline"
                  >
                    {isOpen ? "Show Less" : "Show More"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ))}
    </div>
  );
}
