"use client";
import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../Clients/Supabase/SupabaseClients';
import { logActivity } from '@/app/lib/activity';
import { createNotification, checkLowStockAlerts } from '@/app/lib/notifications';
import * as THREE from 'three';

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
  const [fullProductName, setFullProductName] = useState("");
  const [additionalFeatures, setAdditionalFeatures] = useState("");
  const [price, setPrice] = useState("");
  const [inventory, setInventory] = useState("0");
  const [images, setImages] = useState<File[]>([]);
  const [fbxFile, setFbxFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
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
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);

  // Show popup for 2 seconds when product is added
  useEffect(() => {
    if (message === "Product added successfully!") {
      setShowPopup(true);
      const timer = setTimeout(() => setShowPopup(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Load current admin
  useEffect(() => {
    const loadAdmin = async () => {
      try {
        console.log("🔍 Loading current admin...");
        
        // Try localStorage first
        const sessionData = localStorage.getItem('adminSession');
        if (sessionData) {
          const admin = JSON.parse(sessionData);
          setCurrentAdmin(admin);
          console.log("✅ Admin loaded from localStorage:", admin);
          
          // Log page visit
          await logActivity({
            admin_id: admin.id,
            admin_name: admin.username,
            action: 'view',
            entity_type: 'page',
            details: `Accessed Add Products page`,
            page: 'products',
            metadata: {
              pageAccess: true,
              adminAccount: admin.username,
              timestamp: new Date().toISOString()
            }
          });
          return;
        }
        
        // Fallback to Supabase auth
        const { data: sessionUser } = await supabase.auth.getUser();
        if (!sessionUser?.user?.id) {
          console.warn("⚠️ No user session found");
          return;
        }
        
        const userId = sessionUser.user.id;
        const { data: adminRows } = await supabase
          .from("admins")
          .select("*")
          .eq("id", userId);
        
        if (!adminRows || adminRows.length === 0) {
          // Create admin record
          const { data: newAdmin, error: createError } = await supabase
            .from("admins")
            .insert({
              id: userId,
              username: sessionUser.user.email?.split('@')[0] || 'Admin',
              role: 'admin',
              position: 'Admin',
              created_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (!createError && newAdmin) {
            setCurrentAdmin(newAdmin);
            console.log("✅ Created and loaded new admin:", newAdmin);
          }
        } else {
          const admin = adminRows[0];
          setCurrentAdmin(admin);
          console.log("✅ Admin loaded from database:", admin);
        }
        
      } catch (e) {
        console.error("💥 Load admin exception:", e);
      }
    };

    loadAdmin();
  }, []);

  // Log field changes
  const logFieldChange = async (fieldName: string, oldValue: any, newValue: any) => {
    if (!currentAdmin || oldValue === newValue) return;
    
    await logActivity({
      admin_id: currentAdmin.id,
      admin_name: currentAdmin.username,
      action: 'update',
      entity_type: 'form_field',
      details: `Modified ${fieldName} in Add Products form: "${oldValue}" → "${newValue}"`,
      page: 'products',
      metadata: {
        fieldName,
        oldValue,
        newValue,
        formType: 'add_product',
        adminAccount: currentAdmin.username
      }
    });
  };

  // Enhanced field change handlers with logging
  const handleNameChange = (newValue: string) => {
    const oldValue = name;
    setName(newValue);
    if (oldValue && oldValue !== newValue) {
      logFieldChange('Product Name', oldValue, newValue);
    }
  };

  const handleDescriptionChange = (newValue: string) => {
    const oldValue = description;
    setDescription(newValue);
    if (oldValue && oldValue !== newValue) {
      logFieldChange('Description', oldValue, newValue);
    }
  };

  const handlePriceChange = (newValue: string) => {
    const oldValue = price;
    setPrice(newValue);
    if (oldValue && oldValue !== newValue) {
      logFieldChange('Price', oldValue, newValue);
    }
  };

  const handleInventoryChange = (newValue: string) => {
    const oldValue = inventory;
    setInventory(newValue);
    if (oldValue && oldValue !== newValue) {
      logFieldChange('Inventory', oldValue, newValue);
    }
  };

  const handleCategoryChange = (newValue: string) => {
    const oldValue = category;
    setCategory(newValue);
    if (oldValue && oldValue !== newValue) {
      logFieldChange('Category', oldValue, newValue);
    }
  };

  // Show 3D Viewer popup
  const handleOpen3DViewer = async () => {
    if (fbxFile) {
      setFbxObjectUrl(URL.createObjectURL(fbxFile));
      setShow3DViewer(true);
      
      // Log 3D viewer usage
      if (currentAdmin) {
        await logActivity({
          admin_id: currentAdmin.id,
          admin_name: currentAdmin.username,
          action: 'view',
          entity_type: '3d_model',
          details: `Opened 3D FBX viewer for file: ${fbxFile.name}`,
          page: 'products',
          metadata: {
            fileName: fbxFile.name,
            fileSize: fbxFile.size,
            fileType: 'fbx',
            adminAccount: currentAdmin.username
          }
        });
      }
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

  // Log file uploads
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const oldCount = images.length;
    const newImages = files.slice(0, 5);
    setImages(newImages);
    setCarouselIndex(0);
    
    if (currentAdmin && newImages.length !== oldCount) {
      await logActivity({
        admin_id: currentAdmin.id,
        admin_name: currentAdmin.username,
        action: 'upload',
        entity_type: 'product_images',
        details: `Selected ${newImages.length} product images (${newImages.map(f => f.name).join(', ')})`,
        page: 'products',
        metadata: {
          imageCount: newImages.length,
          fileNames: newImages.map(f => f.name),
          totalSize: newImages.reduce((sum, f) => sum + f.size, 0),
          adminAccount: currentAdmin.username
        }
      });
    }
  };

  const handleFbxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    const oldFileName = fbxFile?.name;
    setFbxFile(file);
    
    if (currentAdmin && file && file.name !== oldFileName) {
      await logActivity({
        admin_id: currentAdmin.id,
        admin_name: currentAdmin.username,
        action: 'upload',
        entity_type: 'fbx_file',
        details: `Selected FBX file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
        page: 'products',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          fileType: 'fbx',
          adminAccount: currentAdmin.username
        }
      });
    }
  };

  // Three.js FBX Viewer component (unchanged)
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
        renderer.setClearColor(0x000000, 0);
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

  // Enhanced product creation with detailed logging
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    
    try {
      console.log("🚀 Starting product creation...");
      
      // Log form submission attempt
      if (currentAdmin) {
        await logActivity({
          admin_id: currentAdmin.id,
          admin_name: currentAdmin.username,
          action: 'create',
          entity_type: 'product_form_submission',
          details: `Initiated product creation for "${name}" in category "${category}"`,
          page: 'products',
          metadata: {
            productName: name,
            category,
            price: Number(price) || 0,
            inventory: Number(inventory) || 0,
            hasImages: images.length > 0,
            hasFbx: !!fbxFile,
            adminAccount: currentAdmin.username
          }
        });
      }
      
      // Upload images (max 5)
      const imageUrls: string[] = [];
      for (let i = 0; i < images.slice(0, 5).length; i++) {
        const img = images[i];
        try {
          const url = await uploadFile(img, 'images');
          imageUrls.push(url);
          
          // Log individual image upload
          if (currentAdmin) {
            await logActivity({
              admin_id: currentAdmin.id,
              admin_name: currentAdmin.username,
              action: 'upload',
              entity_type: 'product_image',
              details: `Uploaded product image ${i + 1}/5: ${img.name}`,
              page: 'products',
              metadata: {
                fileName: img.name,
                fileSize: img.size,
                imageIndex: i + 1,
                productName: name,
                adminAccount: currentAdmin.username
              }
            });
          }
        } catch (uploadError) {
          console.error(`Failed to upload image ${i + 1}:`, uploadError);
          if (currentAdmin) {
            await logActivity({
              admin_id: currentAdmin.id,
              admin_name: currentAdmin.username,
              action: 'upload',
              entity_type: 'product_image_error',
              details: `Failed to upload image ${i + 1}: ${img.name} - ${uploadError}`,
              page: 'products',
              metadata: {
                fileName: img.name,
                error: String(uploadError),
                imageIndex: i + 1,
                adminAccount: currentAdmin.username
              }
            });
          }
        }
      }
      
      // Pad imageUrls to always have 5 elements
      while (imageUrls.length < 5) imageUrls.push("");

      // Upload FBX file
      let fbxUrl = "";
      if (fbxFile) {
        try {
          fbxUrl = await uploadFile(fbxFile, 'fbx');
          
          // Log FBX upload
          if (currentAdmin) {
            await logActivity({
              admin_id: currentAdmin.id,
              admin_name: currentAdmin.username,
              action: 'upload',
              entity_type: 'fbx_file',
              details: `Uploaded FBX file: ${fbxFile.name} for product "${name}"`,
              page: 'products',
              metadata: {
                fileName: fbxFile.name,
                fileSize: fbxFile.size,
                productName: name,
                adminAccount: currentAdmin.username
              }
            });
          }
        } catch (fbxError) {
          console.error("FBX upload failed:", fbxError);
          if (currentAdmin) {
            await logActivity({
              admin_id: currentAdmin.id,
              admin_name: currentAdmin.username,
              action: 'upload',
              entity_type: 'fbx_file_error',
              details: `Failed to upload FBX file: ${fbxFile.name} - ${fbxError}`,
              page: 'products',
              metadata: {
                fileName: fbxFile.name,
                error: String(fbxError),
                adminAccount: currentAdmin.username
              }
            });
          }
        }
      }

      console.log("📦 Inserting product into database...");
      // Insert product into Supabase and return inserted row
      const { data: insertedProduct, error: insertErr } = await supabase
        .from('products')
        .insert([{
          name,
          fullproductname: fullProductName,
          additionalfeatures: additionalFeatures,
          description,
          price: Number(price) || 0,
          inventory: Number(inventory) || 0,
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
        }])
        .select()
        .single();

      if (insertErr) {
        console.error("❌ Product insertion error:", insertErr);
        
        // Log database error
        if (currentAdmin) {
          await logActivity({
            admin_id: currentAdmin.id,
            admin_name: currentAdmin.username,
            action: 'create',
            entity_type: 'product_error',
            details: `Failed to create product "${name}": ${insertErr.message}`,
            page: 'products',
            metadata: {
              productName: name,
              error: insertErr.message,
              errorCode: insertErr.code,
              adminAccount: currentAdmin.username
            }
          });
        }
        
        throw insertErr;
      }

      console.log("✅ Product inserted successfully:", insertedProduct);

      // Enhanced activity logging for successful creation
      if (currentAdmin?.id) {
        console.log("📝 Logging product creation activity...");
        
        try {
          const activityResult = await logActivity({
            admin_id: currentAdmin.id,
            admin_name: currentAdmin.username || currentAdmin.id,
            action: "create",
            entity_type: "product",
            entity_id: insertedProduct.id,
            page: "products",
            details: `Successfully created new product "${name}" in ${category} category with ${inventory} initial inventory`,
            metadata: {
              productId: insertedProduct.id,
              productName: name,
              fullProductName: fullProductName,
              category,
              price: Number(price) || 0,
              initialInventory: Number(inventory) || 0,
              material,
              type,
              dimensions: {
                height: height ? Number(height) : null,
                width: width ? Number(width) : null,
                thickness: thickness ? Number(thickness) : null
              },
              filesUploaded: {
                images: images.length,
                fbx: !!fbxFile
              },
              createdAt: new Date().toISOString(),
              adminAccount: currentAdmin.username || currentAdmin.id
            }
          });
          
          if (activityResult?.success) {
            console.log("✅ Product creation activity logged successfully");
          } else {
            console.error("❌ Failed to log product creation activity:", activityResult?.error);
          }
        } catch (activityError) {
          console.error("💥 Product creation activity logging exception:", activityError);
        }

        // Create notification for new product
        await createNotification({
          title: "New Product Added",
          message: `Product "${name}" has been added to ${category} category by ${currentAdmin.username || 'Admin'}`,
          recipient_role: "all",
          type: "general",
          priority: "medium",
        });

        // Check for low stock on the new product
        if (Number(inventory) <= 5) {
          await createNotification({
            title: Number(inventory) === 0 ? "New Product Out of Stock" : "New Product Low Stock",
            message: `Newly added product "${name}" ${Number(inventory) === 0 ? 'has no stock' : `has only ${inventory} items`}`,
            recipient_role: "all",
            type: "stock",
            priority: Number(inventory) === 0 ? "high" : "medium",
          });
        }
      } else {
        console.warn("⚠️ Skipping activity logging - admin not loaded");
      }

      setMessage("Product added successfully!");
      console.log("🎉 Product creation completed successfully!");
      
      // Log form reset
      if (currentAdmin) {
        await logActivity({
          admin_id: currentAdmin.id,
          admin_name: currentAdmin.username,
          action: 'update',
          entity_type: 'form_reset',
          details: `Reset Add Products form after successful creation of "${name}"`,
          page: 'products',
          metadata: {
            createdProductName: name,
            createdProductId: insertedProduct.id,
            adminAccount: currentAdmin.username
          }
        });
      }
      
      // Reset form
      setName("");
      setFullProductName("");
      setDescription("");
      setAdditionalFeatures("");
      setPrice("");
      setInventory("0");
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
      console.error("💥 Product creation failed:", err);
      setMessage(`Error: ${err.message}`);
      
      // Log general error
      if (currentAdmin) {
        await logActivity({
          admin_id: currentAdmin.id,
          admin_name: currentAdmin.username,
          action: 'create',
          entity_type: 'product_creation_error',
          details: `Product creation failed for "${name}": ${err.message}`,
          page: 'products',
          metadata: {
            productName: name,
            error: err.message,
            stack: err.stack,
            adminAccount: currentAdmin.username
          }
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Carousel logic for 3 images at a time
  const getCarouselImages = () => {
    if (images.length <= 3) return images;
    if (carouselIndex + 3 <= images.length) {
      return images.slice(carouselIndex, carouselIndex + 3);
    }
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

  return (
    <div className="min-h-screen bg-[#e7eaef] flex items-center justify-center">
      <div className="max-w-5xl w-full p-8 rounded-lg shadow-lg bg-white/80 flex flex-col space-y-6">
        {/* Title */}
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-[#505A89] mb-2 tracking-tight">ADD PRODUCTS</h1>
          <div className="text-sm text-gray-600">
            {currentAdmin ? (
              <span className="text-green-600">✅ Admin: {currentAdmin.username || currentAdmin.id}</span>
            ) : (
              <span className="text-yellow-600">⏳ Loading admin...</span>
            )}
          </div>
        </div>

        {/* Success Popup */}
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
                onChange={e => handleNameChange(e.target.value)}
                className="w-full border border-gray-300 p-2 rounded bg-white text-black mb-4"
                required
              />

              <div className="mt-2">
                <label className="block text-[#233a5e] font-semibold mb-1">Full Product Name</label>
                <input
                  type="text"
                  placeholder="Full Product Name"
                  value={fullProductName}
                  onChange={e => setFullProductName(e.target.value)}
                  className="w-full border border-gray-300 p-2 rounded bg-white text-black mb-4"
                />
              </div>

              <label className="block text-[#233a5e] font-semibold mb-1">Product Description</label>
              <textarea
                placeholder="Product Description"
                value={description}
                onChange={e => handleDescriptionChange(e.target.value)}
                className="w-full border border-gray-300 p-2 rounded bg-white text-black"
              />

              <div className="mt-4">
                <label className="block text-[#233a5e] font-semibold mb-1">Additional Features</label>
                <textarea
                  placeholder="One feature per line or free text"
                  value={additionalFeatures}
                  onChange={e => setAdditionalFeatures(e.target.value)}
                  className="w-full border border-gray-300 p-2 rounded bg-white text-black"
                  rows={3}
                />
              </div>
            </div>

            {/* Product Details */}
            <div className="bg-white/80 rounded-lg p-6">
              <h2 className="text-lg font-bold text-[#233a5e] mb-4">Product Details</h2>
              <label className="block text-[#233a5e] font-semibold mb-1">Price (PHP)</label>
              <input
                type="number"
                value={price}
                onChange={e => handlePriceChange(e.target.value)}
                className="w-full border border-gray-300 p-2 rounded bg-white text-black mb-4"
                placeholder="0.00"
                required
                min="0"
              />
              <label className="block text-[#233a5e] font-semibold mb-1">Inventory</label>
              <input
                type="number"
                value={inventory}
                onChange={e => handleInventoryChange(e.target.value)}
                className="w-full border border-gray-300 p-2 rounded bg-white text-black mb-4"
                placeholder="0"
                min="0"
              />
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
                  onChange={e => handleCategoryChange(e.target.value)}
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
                  onChange={handleImageUpload}
                  className="hidden"
                />
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
                  onChange={handleFbxUpload}
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
              disabled={loading}
              className={`flex items-center justify-center gap-2 px-6 py-2 rounded font-semibold transition-colors duration-200 ${
                loading ? "bg-blue-600 opacity-70 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-800"
              } text-white`}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path>
                  </svg>
                  Adding...
                </>
              ) : (
                "Add Product"
              )}
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