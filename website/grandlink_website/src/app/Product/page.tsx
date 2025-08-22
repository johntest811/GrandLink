// app/products/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import TopNavBarLoggedIn from "@/components/TopNavBarLoggedIn";
import Footer from "@/components/Footer";

export default function ProductsPage() {
  // Sample products with slug for details page
  const products = [
    { id: 1, name: "GE 196", image: "/images/ge196.jpg", category: "Doors", slug: "ge-196" },
    { id: 2, name: "GE 137", image: "/images/ge137.jpg", category: "Windows", slug: "ge-137" },
    { id: 3, name: "GE 175", image: "/images/ge175.jpg", category: "Casement", slug: "ge-175" },
    { id: 4, name: "GE 137", image: "/images/ge137-2.jpg", category: "Sliding", slug: "ge-137-2" },
    { id: 5, name: "GE 196", image: "/images/ge196-2.jpg", category: "Doors", slug: "ge-196-2" },
    { id: 6, name: "GE 410", image: "/images/ge410.jpg", category: "Windows", slug: "ge-410" },
    { id: 7, name: "GE 413", image: "/images/ge413.jpg", category: "Enclosure", slug: "ge-413" },
    { id: 8, name: "GE 410", image: "/images/ge410-2.jpg", category: "Casement", slug: "ge-410-2" },
    { id: 9, name: "Store Enclosure", image: "/images/store-enclosure.jpg", category: "Enclosure", slug: "store-enclosure" },
    { id: 10, name: "Glass Railing", image: "/images/glass-railing.jpg", category: "Rails", slug: "glass-railing" },
    { id: 11, name: "Nathan 126", image: "/images/nathan126.jpg", category: "Doors", slug: "nathan-126" },
    { id: 12, name: "GE 48", image: "/images/ge48.jpg", category: "Windows", slug: "ge-48" },
  ];

  const categories = [
    "All Products", "Doors", "Windows", "Enclosure",
    "Casement", "Sliding", "Rails", "Canopy", "Curtain Wall"
  ];

  const [selectedCategory, setSelectedCategory] = useState("All Products");

  // Filter products by category
  const filteredProducts =
    selectedCategory === "All Products"
      ? products
      : products.filter((p) => p.category === selectedCategory);

  return (
    <div className="min-h-screen flex flex-col">
      <TopNavBarLoggedIn />
      <main className="flex-1 bg-white">
        {/* Category Tabs */}
        <section className="py-6 border-b">
          <div className="flex flex-wrap justify-center gap-4 text-sm font-medium">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded transition ${
                  selectedCategory === cat
                    ? "text-red-600 border-b-2 border-red-600"
                    : "text-gray-700 hover:text-red-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* Product Grid */}
        <section className="py-10 max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {filteredProducts.map((prod) => (
              <Link
                key={prod.id}
                href={`/products/${prod.slug}`} // Goes to product details
                className="border p-2 rounded hover:shadow-lg transition block"
              >
                <Image
                  src={prod.image}
                  alt={prod.name}
                  width={400}
                  height={300}
                  className="w-full h-40 object-cover rounded"
                />
                <p className="mt-2 text-center text-sm font-medium">{prod.name}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
