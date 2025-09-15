"use client";
import { useState } from "react";

type Product = {
  image: string;
  name: string;
  description?: string;
};

type ProductCategory = {
  name: string;
  products: Product[];
};

const initialData: ProductCategory[] = [
  {
    name: "Doors",
    products: [
      {
        image: "https://your-image-url.com/door1.jpg",
        name: "GE 105",
        description: "",
      },
      {
        image: "https://your-image-url.com/door2.jpg",
        name: "GE 157",
        description: "",
      },
    ],
  },
  {
    name: "Windows",
    products: [
      {
        image: "https://your-image-url.com/window1.jpg",
        name: "GE 110",
        description: "",
      },
    ],
  },
  {
    name: "Enclosure",
    products: [
      {
        image: "https://your-image-url.com/enclosure1.jpg",
        name: "Shower Enclosure",
        description: "",
      },
    ],
  },
  // Add more categories as needed
];

export default function AdminProductsPage() {
  const [categories, setCategories] = useState<ProductCategory[]>(initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Category name change
  const handleCategoryNameChange = (idx: number, value: string) => {
    setCategories((prev) =>
      prev.map((cat, i) => (i === idx ? { ...cat, name: value } : cat))
    );
  };

  // Product field change
  const handleProductChange = (
    catIdx: number,
    prodIdx: number,
    field: keyof Product,
    value: string
  ) => {
    setCategories((prev) =>
      prev.map((cat, i) =>
        i === catIdx
          ? {
              ...cat,
              products: cat.products.map((prod, j) =>
                j === prodIdx ? { ...prod, [field]: value } : prod
              ),
            }
          : cat
      )
    );
  };

  // Add product
  const handleAddProduct = (catIdx: number) => {
    setCategories((prev) =>
      prev.map((cat, i) =>
        i === catIdx
          ? {
              ...cat,
              products: [
                ...cat.products,
                { image: "", name: "", description: "" },
              ],
            }
          : cat
      )
    );
  };

  // Remove product
  const handleRemoveProduct = (catIdx: number, prodIdx: number) => {
    setCategories((prev) =>
      prev.map((cat, i) =>
        i === catIdx
          ? {
              ...cat,
              products: cat.products.filter((_, j) => j !== prodIdx),
            }
          : cat
      )
    );
  };

  // Add category
  const handleAddCategory = () => {
    setCategories((prev) => [
      ...prev,
      { name: "New Category", products: [] },
    ]);
  };

  // Remove category
  const handleRemoveCategory = (catIdx: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== catIdx));
  };

  // Save handler (replace with API call)
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Example: await fetch("/api/products", { method: "PUT", body: JSON.stringify(categories) });
      console.log("Saved products:", categories);
      alert("Products saved successfully!");
    } catch (e: any) {
      setError("Failed to save products");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-10">
      <div className="max-w-6xl mx-auto bg-white p-8 rounded-2xl shadow-lg">
        <h1 className="text-3xl font-bold mb-6 text-center">Admin - Manage Products</h1>
        {categories.map((cat, catIdx) => (
          <div key={catIdx} className="mb-10 border-b pb-6">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={cat.name}
                onChange={(e) => handleCategoryNameChange(catIdx, e.target.value)}
                className="font-semibold text-lg border-b px-2 py-1 flex-1"
              />
              <button
                className="text-red-600 px-2"
                onClick={() => handleRemoveCategory(catIdx)}
                disabled={categories.length === 1}
                title="Remove Category"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {cat.products.map((prod, prodIdx) => (
                <div key={prodIdx} className="mb-6 bg-gray-50 p-4 rounded-lg shadow">
                  <label className="block font-semibold mb-1">Image URL</label>
                  <input
                    type="text"
                    value={prod.image}
                    onChange={(e) =>
                      handleProductChange(catIdx, prodIdx, "image", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1 mb-2"
                  />
                  {prod.image && (
                    <img
                      src={prod.image}
                      alt={prod.name}
                      className="w-full h-32 object-cover rounded mb-2 border"
                    />
                  )}
                  <label className="block font-semibold mb-1">Product Name</label>
                  <input
                    type="text"
                    value={prod.name}
                    onChange={(e) =>
                      handleProductChange(catIdx, prodIdx, "name", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1 mb-2"
                  />
                  <label className="block font-semibold mb-1">Description</label>
                  <textarea
                    value={prod.description || ""}
                    onChange={(e) =>
                      handleProductChange(catIdx, prodIdx, "description", e.target.value)
                    }
                    rows={2}
                    className="w-full border rounded px-2 py-1 mb-2"
                  />
                  <button
                    className="text-red-600 text-sm"
                    onClick={() => handleRemoveProduct(catIdx, prodIdx)}
                    title="Remove Product"
                  >
                    Remove Product
                  </button>
                </div>
              ))}
            </div>
            <button
              className="bg-blue-100 text-blue-700 px-3 py-1 rounded mb-2"
              onClick={() => handleAddProduct(catIdx)}
            >
              + Add Product
            </button>
          </div>
        ))}
        <button
          className="bg-green-100 text-green-700 px-4 py-2 rounded mb-6"
          onClick={handleAddCategory}
        >
          + Add Category
        </button>
        <button
          onClick={handleSave}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {error && <div className="mt-2 text-red-600">{error}</div>}
      </div>
    </div>
  );
}