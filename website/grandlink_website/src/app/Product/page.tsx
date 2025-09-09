// app/products/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import TopNavBarLoggedIn from "@/components/TopNavBarLoggedIn";
import Footer from "@/components/Footer";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products");
        let data = await res.json();
        if (Array.isArray(data)) {
          setProducts(data);
        } else {
          setProducts([]);
          console.error("API did not return an array:", data);
        }
      } catch (err) {
        setProducts([]);
        console.error("Fetch error:", err);
      }
      setLoading(false);
    };
    fetchProducts();
  }, []);

  // Get unique categories from products
  const categories = [
    "All Products",
    "Doors",
    "Window",
    "Enclosure",
    "Casement",
    "Sliding",
    "Railings",
    "Canopy",
    "Curtain Wall",
  ];

  const [selectedCategory, setSelectedCategory] = useState("All Products");

  // Helper to get the first available image from product table
  const getProductImage = (prod: any) => {
    return (
      prod.image1 ||
      prod.image2 ||
      prod.image3 ||
      prod.image4 ||
      prod.image5 ||
      "https://placehold.co/400x300?text=No+Image"
    );
  };

  // Filter products by category
  const filteredProducts =
    selectedCategory === "All Products"
      ? products
      : products.filter((p) => (p.category || "") === selectedCategory);

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
          {loading ? (
            <div className="text-center text-gray-500">Loading products...</div>
          ) : Array.isArray(filteredProducts) && filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {filteredProducts.map((prod) => (
                <Link
                  key={prod.id}
                  href={`/Product/details?id=${prod.id}`}
                  className="border p-2 rounded hover:shadow-lg transition block"
                >
                  {getProductImage(prod) && (
                    <Image
                      src={getProductImage(prod)}
                      alt={prod.name}
                      width={400}
                      height={300}
                      className="w-full h-40 object-cover rounded"
                    />
                  )}
                  <p className="mt-2 text-center text-sm font-medium">
                    {prod.name}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500">No products found.</div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
