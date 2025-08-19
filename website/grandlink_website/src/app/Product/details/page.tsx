// app/products/[category]/[slug]/page.tsx
"use client";
import { useParams } from "next/navigation";

const allProducts = [
  { id: 1, name: "GE 196", slug: "ge-196", image: "/images/ge196.jpg", category: "doors", description: "Premium door system with durable design." },
  { id: 2, name: "GE 137", slug: "ge-137", image: "/images/ge137.jpg", category: "windows", description: "Classic aluminum window with clear finish." },
  { id: 3, name: "GE 175", slug: "ge-175", image: "/images/ge175.jpg", category: "casement", description: "Casement window with smooth opening system." },
  { id: 5, name: "Store Enclosure", slug: "store-enclosure", image: "/images/store-enclosure.jpg", category: "enclosure", description: "Full glass store enclosure with aluminum framing." },
];

export default function ProductDetailPage() {
  const params = useParams();
  const { category, slug } = params as { category: string; slug: string };

  const product = allProducts.find((p) => p.category === category && p.slug === slug);

  if (!product) {
    return <p className="text-center mt-10">Product not found.</p>;
  }

  return (
    <main className="bg-white py-10 max-w-4xl mx-auto px-4">
      <div className="border rounded-lg shadow p-6">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-80 object-cover rounded"
        />
        <h1 className="text-2xl font-bold mt-4">{product.name}</h1>
        <p className="text-gray-600 mt-2">{product.description}</p>
      </div>
    </main>
  );
}
