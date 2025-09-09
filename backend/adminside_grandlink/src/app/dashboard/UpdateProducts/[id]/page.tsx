"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  type?: string;
  image1?: string;
  image2?: string;
  image3?: string;
  image4?: string;
  image5?: string;
  material?: string;
  height?: number;
  width?: number;
  thickness?: number;
  fbx_url?: string;
};

const supabase = createClient(
  "https://gijnybivawnsilzqegik.supabase.co",
  "your-real-anon-key-here"
);

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchProduct = async () => {
      const res = await fetch(`/api/products/${productId}`);
      const result = await res.json();
      if (res.ok) setProduct(result.product);
      setLoading(false);
    };
    if (productId) fetchProduct();
  }, [productId]);

  const handleChange = (field: keyof Product, value: any) => {
    if (!product) return;
    setProduct({ ...product, [field]: value });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    const result = await res.json();
    if (res.ok) {
      setMessage("Product updated successfully!");
      setTimeout(() => router.push("/dashboard/UpdateProducts"), 1200);
    } else {
      setMessage("Error updating product: " + (result.error || "Unknown error"));
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof Product
  ) => {
    if (!e.target.files || !product) return;
    const file = e.target.files[0];
    const filePath = `products/${field}/${product.id}_${file.name}`;
    const { data, error } = await supabase.storage
      .from("public")
      .upload(filePath, file, { upsert: true });
    if (error) {
      setMessage(`Error uploading file: ${error.message}`);
      return;
    }
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${data?.path}`;
    setProduct({ ...product, [field]: url });
    setMessage("File uploaded!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xl text-[#505A89]">
        Loading product...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xl text-red-600">
        Product not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <h1 className="text-3xl font-bold mb-6 text-[#505A89]">Edit Product</h1>
      <form onSubmit={handleUpdate} className="bg-white shadow rounded-lg p-6 space-y-4 max-w-2xl mx-auto text-black">
        <div>
          <label className="block font-medium mb-1 text-black">Name</label>
          <input
            type="text"
            value={product.name}
            onChange={e => handleChange("name", e.target.value)}
            className="border px-3 py-2 rounded w-full text-black bg-white"
            required
          />
        </div>
        <div>
          <label className="block font-medium mb-1 text-black">Description</label>
          <textarea
            value={product.description}
            onChange={e => handleChange("description", e.target.value)}
            className="border px-3 py-2 rounded w-full text-black bg-white"
          />
        </div>
        <div>
          <label className="block font-medium mb-1 text-black">Price</label>
          <input
            type="number"
            value={product.price}
            onChange={e => handleChange("price", Number(e.target.value))}
            className="border px-3 py-2 rounded w-full text-black bg-white"
            required
          />
        </div>
        <div>
          <label className="block font-medium mb-1 text-black">Category</label>
          <select
            value={product.category}
            onChange={e => handleChange("category", e.target.value)}
            className="border px-3 py-2 rounded w-full text-black bg-white"
            required
          >
            <option value="">Select Category</option>
            <option value="Doors">Doors</option>
            <option value="Windows">Windows</option>
            <option value="Enclosures">Enclosures</option>
            <option value="Casement">Casement</option>
            <option value="Sliding">Sliding</option>
            <option value="Railings">Railings</option>
            <option value="Canopy">Canopy</option>
            <option value="Curtain Wall">Curtain Wall</option>
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1 text-black">Type</label>
          <select
            value={product.type || ""}
            onChange={e => handleChange("type", e.target.value)}
            className="border px-3 py-2 rounded w-full text-black bg-white"
          >
            <option value="">Select Type</option>
            <option value="Tinted">Tinted</option>
            <option value="Clear">Clear</option>
            <option value="Frosted">Frosted</option>
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1 text-black">Material</label>
          <select
            value={product.material || ""}
            onChange={e => handleChange("material", e.target.value)}
            className="border px-3 py-2 rounded w-full text-black bg-white"
          >
            <option value="">Select Material</option>
            <option value="Glass">Glass</option>
            <option value="Wood">Wood</option>
            <option value="Metal">Metal</option>
          </select>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block font-medium mb-1 text-black">Height</label>
            <input
              type="number"
              value={product.height || ""}
              onChange={e => handleChange("height", Number(e.target.value))}
              className="border px-3 py-2 rounded w-full text-black bg-white"
            />
          </div>
          <div>
            <label className="block font-medium mb-1 text-black">Width</label>
            <input
              type="number"
              value={product.width || ""}
              onChange={e => handleChange("width", Number(e.target.value))}
              className="border px-3 py-2 rounded w-full text-black bg-white"
            />
          </div>
          <div>
            <label className="block font-medium mb-1 text-black">Thickness</label>
            <input
              type="number"
              value={product.thickness || ""}
              onChange={e => handleChange("thickness", Number(e.target.value))}
              className="border px-3 py-2 rounded w-full text-black bg-white"
            />
          </div>
        </div>
        <div>
          <label className="block font-medium mb-1 text-black">FBX File</label>
          <input
            type="file"
            accept=".fbx"
            onChange={e => handleFileUpload(e, "fbx_url")}
            className="border px-3 py-2 rounded w-full text-black bg-white"
          />
          {product.fbx_url && (
            <a href={product.fbx_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm">
              View current FBX file
            </a>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4,5].map(i => (
            <div key={i}>
              <label className="block font-medium mb-1 text-black">{`Image${i}`}</label>
              <input
                type="file"
                accept="image/*"
                onChange={e => handleFileUpload(e, `image${i}` as keyof Product)}
                className="border px-3 py-2 rounded w-full text-black bg-white"
              />
              {product[`image${i}` as keyof Product] && (
                <img
                  src={product[`image${i}` as keyof Product] as string}
                  alt={`Image${i}`}
                  className="mt-2 w-full h-24 object-cover rounded"
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-4">
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded font-semibold hover:bg-blue-800"
          >
            Update Product
          </button>
          <button
            type="button"
            className="bg-gray-300 text-[#505A89] px-6 py-2 rounded font-semibold hover:bg-gray-400"
            onClick={() => router.push("/dashboard/UpdateProducts")}
          >
            Cancel
          </button>
        </div>
        {message && <div className="text-center text-green-600 mt-2">{message}</div>}
      </form>
    </div>
  );
}