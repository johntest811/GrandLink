"use client";
import { useState, useEffect } from "react";
import { FaUsers, FaCheck, FaCalendarAlt, FaFilter, FaEdit } from "react-icons/fa";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  type?: string;
  image1?: string;
  date_added?: string;
};

export default function UpdateProductPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchProducts = async () => {
      const res = await fetch("/api/products");
      const result = await res.json();
      if (res.ok) setProducts(result.products);
    };
    fetchProducts();
  }, []);

  const types = Array.from(new Set(products.map(p => p.type).filter(Boolean)));
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  const filteredProducts = products.filter(product => {
    const typeMatch = typeFilter === "All" || product.type === typeFilter;
    const categoryMatch = categoryFilter === "All" || product.category === categoryFilter;
    return typeMatch && categoryMatch;
  });

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".dropdown-type") && !target.closest(".dropdown-category")) {
        setShowTypeDropdown(false);
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <h1 className="text-4xl font-bold mb-6 text-[#505A89] tracking-tight">UPDATE PRODUCTS</h1>
      <div className="flex gap-4 mb-6">
        <button
          className={`flex items-center gap-2 bg-[#505A89] text-white px-5 py-2 rounded font-semibold ${typeFilter === "All" && categoryFilter === "All" ? "ring-2 ring-[#233a5e]" : ""}`}
          onClick={() => {
            setTypeFilter("All");
            setCategoryFilter("All");
          }}
        >
          <FaUsers /> All Products
        </button>
        <div className="relative dropdown-type">
          <button
            className={`flex items-center gap-2 bg-[#505A89] text-white px-5 py-2 rounded font-semibold ${typeFilter !== "All" ? "ring-2 ring-[#233a5e]" : ""}`}
            onClick={() => {
              setShowTypeDropdown(!showTypeDropdown);
              setShowCategoryDropdown(false);
            }}
          >
            <FaCheck /> All Types
          </button>
          {showTypeDropdown && (
            <div className="absolute left-0 mt-2 bg-white shadow-lg rounded z-10 min-w-[150px] text-black">
              <ul>
                <li>
                  <button
                    className={`block w-full text-left px-4 py-2 hover:bg-gray-100 text-black ${typeFilter === "All" ? "font-bold" : ""}`}
                    onClick={() => { setTypeFilter("All"); setShowTypeDropdown(false); }}
                  >
                    All Types
                  </button>
                </li>
                {types.map(type => (
                  <li key={type}>
                    <button
                      className={`block w-full text-left px-4 py-2 hover:bg-gray-100 text-black ${typeFilter === type ? "font-bold" : ""}`}
                      onClick={() => { setTypeFilter(type ?? ""); setShowTypeDropdown(false); }}
                    >
                      {type}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="relative dropdown-category">
          <button
            className={`flex items-center gap-2 bg-[#505A89] text-white px-5 py-2 rounded font-semibold ${categoryFilter !== "All" ? "ring-2 ring-[#233a5e]" : ""}`}
            onClick={() => {
              setShowCategoryDropdown(!showCategoryDropdown);
              setShowTypeDropdown(false);
            }}
          >
            <FaFilter /> Filter
          </button>
          {showCategoryDropdown && (
            <div className="absolute left-0 mt-2 bg-white shadow-lg rounded z-10 min-w-[150px] text-black">
              <ul>
                <li>
                  <button
                    className={`block w-full text-left px-4 py-2 hover:bg-gray-100 text-black ${categoryFilter === "All" ? "font-bold" : ""}`}
                    onClick={() => { setCategoryFilter("All"); setShowCategoryDropdown(false); }}
                  >
                    All Categories
                  </button>
                </li>
                {categories.map(category => (
                  <li key={category}>
                    <button
                      className={`block w-full text-left px-4 py-2 hover:bg-gray-100 text-black ${categoryFilter === category ? "font-bold" : ""}`}
                      onClick={() => { setCategoryFilter(category); setShowCategoryDropdown(false); }}
                    >
                      {category}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <div className="bg-[#505A89] rounded-t-lg overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="text-white px-4 py-3 font-semibold">Product Image</th>
              <th className="text-white px-4 py-3 font-semibold">Product Type</th>
              <th className="text-white px-4 py-3 font-semibold">Category</th>
              <th className="text-white px-4 py-3 font-semibold">Product Name</th>
              <th className="text-white px-4 py-3 font-semibold">Description</th>
              <th className="text-white px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white text-black">
            {filteredProducts.map(product => (
              <tr key={product.id} className="border-b last:border-b-0 text-black">
                <td className="px-4 py-4 text-black">
                  {product.image1 ? (
                    <img src={product.image1} alt={product.name} className="w-24 h-20 object-cover rounded" />
                  ) : (
                    <div className="w-24 h-20 bg-gray-200 rounded flex items-center justify-center text-gray-400">No Image</div>
                  )}
                </td>
                <td className="px-4 py-4 font-semibold text-[#505A89] text-black">{product.type || ""}</td>
                <td className="px-4 py-4 font-semibold text-black">{product.category || ""}</td>
                <td className="px-4 py-4 font-bold text-black">{product.name}</td>
                <td className="px-4 py-4 text-black">{product.description}</td>
                <td className="px-4 py-4">
                  <button
                    className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-semibold"
                    onClick={() => router.push(`/dashboard/UpdateProducts/${product.id}`)}
                  >
                    <FaEdit /> Edit
                  </button>
                </td>
              </tr>
            ))}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No products found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Edit modal or drawer can be implemented here if editId is set */}
    </div>
  );
}