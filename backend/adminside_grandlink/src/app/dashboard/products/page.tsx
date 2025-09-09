"use client";
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://gijnybivawnsilzqegik.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdpam55Yml2YXduc2lsenFlZ2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyODAyMjUsImV4cCI6MjA2OTg1NjIyNX0.-gO8DcuK9-Q7nQmHRGnKJX3j8W0xHk925KlALBth1gU"
);

const uploadFile = async (file: File, folder: string) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${uuidv4()}.${fileExt}`;
  const { data, error } = await supabase.storage
    .from('products')
    .upload(`${folder}/${fileName}`, file);

  if (error) throw error;
  return supabase.storage.from('products').getPublicUrl(`${folder}/${fileName}`).data.publicUrl;
};

export default function ProductsAdminPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [fbxFile, setFbxFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Example: handle product creation (replace with your API logic)
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      // Upload images
      const imageUrls = [];
      for (const img of images) {
        const url = await uploadFile(img, 'images');
        imageUrls.push(url);
      }

      // Upload FBX file
      let fbxUrl = "";
      if (fbxFile) {
        fbxUrl = await uploadFile(fbxFile, 'fbx');
      }

      // Insert product into Supabase
      const { error } = await supabase
        .from('products')
        .insert([{
          name,
          description,
          price: Number(price),
          images: imageUrls,
          fbx_url: fbxUrl,
        }]);

      if (error) throw error;
      setMessage("Product added successfully!");
      setName("");
      setDescription("");
      setPrice("");
      setImages([]);
      setFbxFile(null);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    }
  };

  // Carousel logic
  const handlePrev = () => setCarouselIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  const handleNext = () => setCarouselIndex((i) => (i === images.length - 1 ? 0 : i + 1));

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Add Product</h2>
      <form onSubmit={handleAddProduct} className="space-y-4">
        <input
          type="text"
          placeholder="Product Name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={e => setPrice(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={e => setImages(Array.from(e.target.files || []))}
        />
        <input
          type="file"
          accept=".fbx"
          onChange={e => setFbxFile(e.target.files?.[0] || null)}
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Add Product</button>
      </form>
      {message && <div className="mt-4 text-green-600">{message}</div>}

      {/* Carousel Preview */}
      {images.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Image Carousel Preview</h3>
          <div className="flex items-center space-x-4">
            <button onClick={handlePrev}>&lt;</button>
            <img
              src={URL.createObjectURL(images[carouselIndex])}
              alt={`Product Image ${carouselIndex + 1}`}
              className="w-40 h-40 object-cover rounded"
            />
            <button onClick={handleNext}>&gt;</button>
          </div>
        </div>
      )}
    </div>
  );
}