"use client";
import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
// Add these imports for Three.js and FBXLoader
import * as THREE from 'three';

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
  const [category, setCategory] = useState("");
  const [height, setHeight] = useState("");
  const [width, setWidth] = useState("");
  const [thickness, setThickness] = useState("");
  const [material, setMaterial] = useState("Glass");
  const [type, setType] = useState("Tinted");
  const [showPopup, setShowPopup] = useState(false);
  const [show3DViewer, setShow3DViewer] = useState(false);
  const [fbxObjectUrl, setFbxObjectUrl] = useState<string | null>(null);

  // Show popup for 2 seconds when product is added
  useEffect(() => {
    if (message === "Product added successfully!") {
      setShowPopup(true);
      const timer = setTimeout(() => setShowPopup(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Show 3D Viewer popup
  const handleOpen3DViewer = () => {
    if (fbxFile) {
      setFbxObjectUrl(URL.createObjectURL(fbxFile));
      setShow3DViewer(true);
    }
  };

  // Clean up object URL when closing viewer
  const handleClose3DViewer = () => {
    setShow3DViewer(false);
    if (fbxObjectUrl) {
      URL.revokeObjectURL(fbxObjectUrl);
      setFbxObjectUrl(null);
    }
  };

  // Three.js FBX Viewer component
  function FBXViewer({ url }: { url: string }) {
    useEffect(() => {
      let loader: any;
      let model: THREE.Group | undefined;
      let controls: any;

      async function loadFBX() {
        const { FBXLoader } = await import('three-stdlib');
        const { OrbitControls } = await import('three-stdlib');
        loader = new FBXLoader();

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        camera.position.set(0, 100, 250);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setClearColor(0x000000, 0); // transparent background
        renderer.setSize(400, 400);

        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        scene.add(ambientLight);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enableZoom = true;
        controls.enablePan = true;

        loader.load(
          url,
          (object: THREE.Group) => {
            model = object;
            scene.add(model);
          },
          undefined,
          (error: unknown) => {
            console.error('Error loading FBX:', error);
          }
        );

        const mount = document.getElementById('fbx-canvas');
        if (mount) {
          mount.innerHTML = '';
          mount.appendChild(renderer.domElement);
        }

        function animate() {
          requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        }
        animate();
      }

      loadFBX();

      return () => {
        const mount = document.getElementById('fbx-canvas');
        if (mount) mount.innerHTML = '';
      };
    }, [url]);

    return <div id="fbx-canvas" style={{ width: 400, height: 400 }} />;
  }

  // Handle product creation
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      // Upload images (max 5)
      const imageUrls: string[] = [];
      for (const img of images.slice(0, 5)) {
        const url = await uploadFile(img, 'images');
        imageUrls.push(url);
      }
      // Pad imageUrls to always have 5 elements
      while (imageUrls.length < 5) imageUrls.push("");

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
          category,
          height: height ? Number(height) : null,
          width: width ? Number(width) : null,
          thickness: thickness ? Number(thickness) : null,
          material,
          type,
          image1: imageUrls[0],
          image2: imageUrls[1],
          image3: imageUrls[2],
          image4: imageUrls[3],
          image5: imageUrls[4],
          fbx_url: fbxUrl,
        }]);

      if (error) throw error;
      setMessage("Product added successfully!");
      setName("");
      setDescription("");
      setPrice("");
      setImages([]);
      setFbxFile(null);
      setHeight("");
      setWidth("");
      setThickness("");
      setMaterial("Glass");
      setType("Tinted");
      setCategory("");
      setCarouselIndex(0);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    }
  };

  // Carousel logic for 3 images at a time
  const getCarouselImages = () => {
    if (images.length <= 3) return images;
    if (carouselIndex + 3 <= images.length) {
      return images.slice(carouselIndex, carouselIndex + 3);
    }
    // Wrap around if at the end
    return [
      ...images.slice(carouselIndex),
      ...images.slice(0, 3 - (images.length - carouselIndex))
    ];
  };

  const handlePrev = () =>
    setCarouselIndex((i) =>
      i === 0 ? Math.max(images.length - 3, 0) : i - 1
    );
  const handleNext = () =>
    setCarouselIndex((i) =>
      i + 3 >= images.length ? 0 : i + 1
    );

  // Handle image selection (max 5)
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(files.slice(0, 5));
    setCarouselIndex(0);
  };

  return (
    <div className="min-h-screen bg-[#e7eaef] flex items-center justify-center">
      <div className="max-w-5xl w-full p-8 rounded-lg shadow-lg bg-white/80 flex flex-col space-y-6">
        {/* Popup */}
        {showPopup && (
          <div className="fixed top-8 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded shadow-lg z-50 transition-opacity duration-300">
            Product added successfully!
          </div>
        )}
        {/* 3D Viewer Popup */}
        {show3DViewer && fbxObjectUrl && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "transparent" }}>
            <div className="bg-white/80 rounded-lg p-6 shadow-lg relative" style={{ background: "rgba(255,255,255,0.8)" }}>
              <button
                onClick={handleClose3DViewer}
                className="absolute top-2 right-2 text-gray-600 hover:text-black text-xl font-bold"
              >
                ×
              </button>
              <h2 className="text-lg font-bold mb-4 text-[#233a5e]">3D FBX Viewer</h2>
              <FBXViewer url={fbxObjectUrl} />
            </div>
          </div>
        )}
        <form onSubmit={handleAddProduct}>
          <div className="grid grid-cols-2 gap-6">
            {/* Product Name and Description */}
            <div className="bg-white/80 rounded-lg p-6">
              <h2 className="text-lg font-bold text-[#233a5e] mb-4">Product Name and Description</h2>
              <label className="block text-[#233a5e] font-semibold mb-1">Product Name</label>
              <input
                type="text"
                placeholder="Product Name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-gray-300 p-2 rounded bg-white text-black mb-4"
                required
              />
              <label className="block text-[#233a5e] font-semibold mb-1">Product Description</label>
              <textarea
                placeholder="Product Description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full border border-gray-300 p-2 rounded bg-white text-black"
              />
            </div>
            {/* Product Details */}
            <div className="bg-white/80 rounded-lg p-6">
              <h2 className="text-lg font-bold text-[#233a5e] mb-4">Product Details</h2>
              <div className="flex space-x-4 mb-4">
                <div>
                  <label className="block text-[#233a5e] font-semibold mb-1">Height:</label>
                  <input
                    type="number"
                    value={height}
                    onChange={e => setHeight(e.target.value)}
                    className="w-20 border border-gray-300 p-1 rounded bg-white text-black"
                  />
                </div>
                <div>
                  <label className="block text-[#233a5e] font-semibold mb-1">Width:</label>
                  <input
                    type="number"
                    value={width}
                    onChange={e => setWidth(e.target.value)}
                    className="w-20 border border-gray-300 p-1 rounded bg-white text-black"
                  />
                </div>
                <div>
                  <label className="block text-[#233a5e] font-semibold mb-1">Thickness:</label>
                  <input
                    type="number"
                    value={thickness}
                    onChange={e => setThickness(e.target.value)}
                    className="w-20 border border-gray-300 p-1 rounded bg-white text-black"
                  />
                </div>
              </div>
              <div className="flex space-x-4">
                <div>
                  <label className="block text-[#233a5e] font-semibold mb-1">Material:</label>
                  <select
                    className="border border-gray-300 p-1 rounded bg-white text-black"
                    value={material}
                    onChange={e => setMaterial(e.target.value)}
                  >
                    <option>Glass</option>
                    <option>Wood</option>
                    <option>Metal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#233a5e] font-semibold mb-1">Type:</label>
                  <select
                    className="border border-gray-300 p-1 rounded bg-white text-black"
                    value={type}
                    onChange={e => setType(e.target.value)}
                  >
                    <option>Tinted</option>
                    <option>Clear</option>
                    <option>Frosted</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {/* Category */}
            <div className="bg-white/80 rounded-lg p-6">
              <h2 className="text-lg font-bold text-[#233a5e] mb-4">Category</h2>
              <label className="block text-[#233a5e] font-semibold mb-1">Product Category</label>
              <div className="relative">
                <select
                  className="w-full border border-gray-300 p-2 rounded bg-white text-black mb-4 appearance-none"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  required
                  style={{ position: "relative", zIndex: 10 }}
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
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  ▼
                </span>
              </div>
            </div>
            {/* Product Image */}
            <div className="bg-white/80 rounded-lg p-6">
              <h2 className="text-lg font-bold text-[#233a5e] mb-4">Product Image</h2>
              <div className="flex items-center space-x-2 mb-4">
                <label
                  htmlFor="images-upload"
                  className="flex flex-col items-center justify-center w-28 h-28 border-2 border-dashed border-gray-400 rounded-lg cursor-pointer bg-[#e7eaef] hover:bg-gray-200"
                >
                  <span className="text-2xl">+</span>
                  <span className="text-xs text-[#233a5e]">Upload Photo</span>
                  <span className="text-xs text-gray-500 mt-1">(Max 5 images)</span>
                </label>
                <input
                  id="images-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="hidden"
                />
                {/* Carousel for images (show 3 at a time) */}
                {images.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="px-2 py-1 bg-gray-300 rounded text-xs"
                      disabled={images.length < 2}
                    >
                      {"<"}
                    </button>
                    {getCarouselImages().map((img, idx) => (
                      <img
                        key={idx + carouselIndex}
                        src={URL.createObjectURL(img)}
                        alt={`Product Image ${carouselIndex + idx + 1}`}
                        className="w-20 h-20 object-cover rounded-lg border border-gray-300"
                      />
                    ))}
                    <button
                      type="button"
                      onClick={handleNext}
                      className="px-2 py-1 bg-gray-300 rounded text-xs"
                      disabled={images.length < 2}
                    >
                      {">"}
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2 mb-4">
                <label
                  htmlFor="fbx-upload"
                  className="flex flex-col items-center justify-center w-28 h-10 border-2 border-dashed border-gray-400 rounded-lg cursor-pointer bg-[#e7eaef] hover:bg-gray-200"
                >
                  <span className="text-xs text-[#233a5e]">Choose Fbx File</span>
                </label>
                <input
                  id="fbx-upload"
                  type="file"
                  accept=".fbx"
                  onChange={e => setFbxFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {fbxFile && (
                  <span className="ml-2 text-xs text-black">{fbxFile.name}</span>
                )}
              </div>
              <button
                type="button"
                className={`bg-gray-300 text-[#233a5e] px-4 py-2 rounded mt-2 ${fbxFile ? 'hover:bg-gray-400 cursor-pointer' : 'cursor-not-allowed'}`}
                disabled={!fbxFile}
                onClick={handleOpen3DViewer}
              >
                Open 3D Viewer
              </button>
            </div>
          </div>
          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded font-semibold transition-colors duration-200 hover:bg-blue-800"
            >
              Add Product
            </button>
          </div>
          {/* Message */}
          {message && (
            <div className="mt-4 text-black">{message}</div>
          )}
        </form>
      </div>
    </div>
  );
}