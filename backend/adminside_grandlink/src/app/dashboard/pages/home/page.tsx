"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../../../Clients/Supabase/SupabaseClients";

type HomeContent = {
  carousel?: Array<{ image?: string; title?: string; buttonText?: string; buttonLink?: string }>;
  explore?: Array<{ image?: string; title?: string; buttonText?: string; buttonLink?: string }>;
  featured_projects?: Array<{ image?: string; title?: string; description?: string }>;
  services?: { images?: string[]; title?: string; description?: string; buttonText?: string; buttonLink?: string };
  about?: { logo?: string; title?: string; description?: string; buttonText?: string; buttonLink?: string };
  [k: string]: any;
};

// bucket name - change to your bucket
const BUCKET_NAME = "uploads";

export default function HomeEditor() {
  const [content, setContent] = useState<HomeContent>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // image picker state & loaded images
  const [images, setImages] = useState<Array<{ name: string; url: string }>>([]);
  const [picker, setPicker] = useState<{ open: boolean; key: string; index?: number | null } | null>(null);

  // upload state
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        // Use website API if NEXT_PUBLIC_WEBSITE_URL is set, otherwise call local /api/home
        const siteBase = (process.env.NEXT_PUBLIC_WEBSITE_URL || "").replace(/\/$/, "");
        const apiUrl = siteBase ? `${siteBase}/api/home` : "/api/home";
        const res = await fetch(apiUrl, { credentials: "include" });
        const ct = (res.headers.get("content-type") || "").toLowerCase();

        if (!res.ok) {
          const text = await res.text();
          console.error("Failed to load /api/home:", res.status, text);
          setError(`Failed to load home content: ${res.status} ${res.statusText}`);
          return;
        }

        if (ct.includes("application/json")) {
          const d = await res.json();
          setContent(d?.content ?? d ?? {});
        } else {
          // handle non-json response safely
          const txt = await res.text();
          try {
            const parsed = JSON.parse(txt);
            setContent(parsed?.content ?? parsed ?? {});
          } catch (err) {
            console.error("Invalid JSON from /api/home:", txt);
            setError("Invalid JSON response from /api/home");
          }
        }
      } catch (err: any) {
        console.error("Fetch error /api/home:", err);
        setError(String(err));
      }
    };
    load();

    // load images from supabase storage (public bucket expected)
    const loadImages = async () => {
      try {
        const { data, error } = await supabase.storage.from(BUCKET_NAME).list("", { limit: 200 });
        if (error) {
          console.error("storage.list error:", error);
          return;
        }

        const makePublicUrl = (fileName: string) => {
          // Build a safe encoded public storage URL directly to avoid StorageApiError
          // (do not call getPublicUrl() on the client - it can throw for some keys)
          const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
          return `${base}/storage/v1/object/public/${BUCKET_NAME}/${encodeURIComponent(fileName)}`;
        };

        const mapped = (data || []).map((f: any) => {
          // sanitize and produce a safe URL
          const url = makePublicUrl(f.name);
          return { name: f.name, url };
        });
        setImages(mapped);
      } catch (e) {
        console.error("loadImages error:", e);
      }
    };
    loadImages();
  }, []);

  // file upload handler - uploads to storage and refreshes image list
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      // sanitize filename: remove problematic characters that Storage rejects
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const filePath = `${Date.now()}_${safeName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        console.error("upload error:", uploadError);
        setError(uploadError.message || "Upload failed");
        setUploading(false);
        return;
      }

      // build public url safely (encode path)
      const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
      const publicUrl = `${base}/storage/v1/object/public/${BUCKET_NAME}/${encodeURIComponent(filePath)}`;

      // prepend new image to list and automatically select it (optional)
      setImages((prev) => [{ name: filePath, url: publicUrl }, ...prev]);
      if (picker) {
        handleSelectImage(publicUrl);
      }
    } catch (err: any) {
      console.error("handleFileUpload error:", err);
      setError(String(err));
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/home", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      let json: any = null;
      if (ct.includes("application/json")) {
        json = await res.json();
      } else {
        const txt = await res.text();
        try { json = JSON.parse(txt); } catch { json = { message: txt }; }
      }
      if (!res.ok) throw new Error(json?.error || json?.message || "save failed");
      // success
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  // small helpers for editing arrays
  // safer add/remove helpers that use functional state updates (avoid reading stale `content`)
  const addArrayItem = <K extends keyof HomeContent>(key: K, item: any = {}) => {
    setContent((prev) => {
      const arr = Array.isArray(prev[key]) ? (prev[key] as any[]).slice() : [];
      arr.push(item);
      return { ...prev, [key]: arr } as HomeContent;
    });
  };

  const removeArrayItem = <K extends keyof HomeContent>(key: K, index: number) => {
    setContent((prev) => {
      const arr = Array.isArray(prev[key]) ? (prev[key] as any[]).slice() : [];
      arr.splice(index, 1);
      return { ...prev, [key]: arr } as HomeContent;
    });
  };

  // open image picker for a specific field (key) and optional index (for arrays)
  const openImagePicker = (key: string, index?: number) => {
    setPicker({ open: true, key, index: typeof index === "number" ? index : null });
  };

  // handle image selection
  const handleSelectImage = (url: string) => {
    if (!picker) return;
    const { key, index } = picker;
    setContent((prev) => {
      const next = { ...prev };
      if (key.includes(".")) {
        // support nested keys like "services.images"
        const [parent, child] = key.split(".");
        if (!next[parent]) next[parent] = {};
        if (child === "images") {
          const arr = Array.isArray(next[parent][child]) ? next[parent][child].slice() : [];
          if (typeof index === "number") arr[index] = url;
          else arr.push(url);
          next[parent][child] = arr;
        } else {
          next[parent][child] = url;
        }
      } else {
        // array keys or direct
        if (Array.isArray(next[key])) {
          const arr = (next[key] as any[]).slice();
          if (typeof index === "number") arr[index] = { ...(arr[index] || {}), image: url };
          else arr.push({ image: url });
          next[key] = arr;
        } else {
          // set direct value (e.g. about.logo)
          next[key] = url as any;
        }
      }
      return next;
    });
    setPicker(null);
  };

  const closePicker = () => setPicker(null);

  // form control classes for visible lines
  const formControl = "w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-200";
  const formControlSmall = "border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-200";

  return (
    <div className="p-6 max-w-5xl mx-auto text-black">
      <h1 className="text-2xl font-bold mb-4 text-black">Home Page Editor</h1>

      {/* Carousel */}
      <section className="mb-6 border p-4 rounded">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-black">Carousel</h2>
          <button onClick={() => addArrayItem("carousel", {})} className="text-sm px-2 py-1 bg-gray-100 rounded text-black">Add Slide</button>
        </div>
        {(content.carousel || []).map((s, i) => (
          <div key={i} className="mt-3 border-t pt-3">
            <div className="flex gap-2 mb-2">
              <input className={`flex-1 ${formControlSmall}`} placeholder="Image URL" value={s.image || ""} onChange={(e) => { const arr = content.carousel || []; arr[i] = { ...(arr[i] || {}), image: e.target.value }; setContent({ ...content, carousel: arr }); }} />
              <button className="px-2 bg-gray-100 text-black" onClick={() => openImagePicker("carousel", i)}>Choose</button>
            </div>
            <input className={`${formControl} mb-2`} placeholder="Title" value={s.title || ""} onChange={(e) => { const arr = content.carousel || []; arr[i] = { ...(arr[i] || {}), title: e.target.value }; setContent({ ...content, carousel: arr }); }} />
            <div className="flex gap-2">
              <input className={`flex-1 ${formControlSmall}`} placeholder="Button Text" value={s.buttonText || ""} onChange={(e) => { const arr = content.carousel || []; arr[i] = { ...(arr[i] || {}), buttonText: e.target.value }; setContent({ ...content, carousel: arr }); }} />
              <input className={`flex-1 ${formControlSmall}`} placeholder="Button Link" value={s.buttonLink || ""} onChange={(e) => { const arr = content.carousel || []; arr[i] = { ...(arr[i] || {}), buttonLink: e.target.value }; setContent({ ...content, carousel: arr }); }} />
              <button className="text-black" onClick={() => removeArrayItem("carousel", i)}>Remove</button>
            </div>
          </div>
        ))}
      </section>

      {/* Explore */}
      <section className="mb-6 border p-4 rounded">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-black">Explore Our Products</h2>
          <button onClick={() => addArrayItem("explore", {})} className="text-sm px-2 py-1 bg-gray-100 rounded text-black">Add Item</button>
        </div>
        {(content.explore || []).map((s, i) => (
          <div key={i} className="mt-3 border-t pt-3">
            <div className="flex gap-2 mb-2">
              <input className={`flex-1 ${formControlSmall}`} placeholder="Image URL" value={s.image || ""} onChange={(e) => { const arr = content.explore || []; arr[i] = { ...(arr[i] || {}), image: e.target.value }; setContent({ ...content, explore: arr }); }} />
              <button className="px-2 bg-gray-100 text-black" onClick={() => openImagePicker("explore", i)}>Choose</button>
            </div>
            <input className={`${formControl} mb-2`} placeholder="Title" value={s.title || ""} onChange={(e) => { const arr = content.explore || []; arr[i] = { ...(arr[i] || {}), title: e.target.value }; setContent({ ...content, explore: arr }); }} />
            <div className="flex gap-2">
              <input className={`flex-1 ${formControlSmall}`} placeholder="Button Text" value={s.buttonText || ""} onChange={(e) => { const arr = content.explore || []; arr[i] = { ...(arr[i] || {}), buttonText: e.target.value }; setContent({ ...content, explore: arr }); }} />
              <input className={`flex-1 ${formControlSmall}`} placeholder="Button Link" value={s.buttonLink || ""} onChange={(e) => { const arr = content.explore || []; arr[i] = { ...(arr[i] || {}), buttonLink: e.target.value }; setContent({ ...content, explore: arr }); }} />
              <button className="text-black" onClick={() => removeArrayItem("explore", i)}>Remove</button>
            </div>
          </div>
        ))}
      </section>

      {/* Featured Projects */}
      <section className="mb-6 border p-4 rounded">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-black">Featured Projects</h2>
          <button onClick={() => addArrayItem("featured_projects", {})} className="text-sm px-2 py-1 bg-gray-100 rounded text-black">Add Project</button>
        </div>
        {(content.featured_projects || []).map((p, i) => (
          <div key={i} className="mt-3 border-t pt-3">
            <div className="flex gap-2 mb-2">
              <input className={`flex-1 ${formControlSmall}`} placeholder="Image URL" value={p.image || ""} onChange={(e) => { const arr = content.featured_projects || []; arr[i] = { ...(arr[i] || {}), image: e.target.value }; setContent({ ...content, featured_projects: arr }); }} />
              <button className="px-2 bg-gray-100 text-black" onClick={() => openImagePicker("featured_projects", i)}>Choose</button>
            </div>
            <input className={`${formControl} mb-2`} placeholder="Title" value={p.title || ""} onChange={(e) => { const arr = content.featured_projects || []; arr[i] = { ...(arr[i] || {}), title: e.target.value }; setContent({ ...content, featured_projects: arr }); }} />
            <textarea className={`${formControl} mb-2`} placeholder="Description" value={p.description || ""} onChange={(e) => { const arr = content.featured_projects || []; arr[i] = { ...(arr[i] || {}), description: e.target.value }; setContent({ ...content, featured_projects: arr }); }} />
            <button className="text-black" onClick={() => { const arr = (content.featured_projects || []).slice(); arr.splice(i, 1); setContent({ ...content, featured_projects: arr }); }}>Remove</button>
          </div>
        ))}
      </section>

      {/* Services */}
      <section className="mb-6 border p-4 rounded">
        <h2 className="font-semibold text-black">Service We Offer</h2>
        <div className="mt-3">
          <label className="block text-sm">Title</label>
          <input className={`${formControl} mb-2`} value={content.services?.title || ""} onChange={(e) => setContent({ ...content, services: { ...(content.services || {}), title: e.target.value } })} />
          <label className="block text-sm">Description</label>
          <textarea className={`${formControl} mb-2`} value={content.services?.description || ""} onChange={(e) => setContent({ ...content, services: { ...(content.services || {}), description: e.target.value } })} />
          <label className="block text-sm">Button Text / Link</label>
          <div className="flex gap-2 mb-2">
            <input className={`flex-1 ${formControlSmall}`} placeholder="Button Text" value={content.services?.buttonText || ""} onChange={(e) => setContent({ ...content, services: { ...(content.services || {}), buttonText: e.target.value } })} />
            <input className={`flex-1 ${formControlSmall}`} placeholder="Button Link" value={content.services?.buttonLink || ""} onChange={(e) => setContent({ ...content, services: { ...(content.services || {}), buttonLink: e.target.value } })} />
          </div>

          <div>
            <label className="block text-sm mb-1">Carousel Images (4)</label>
            {(content.services?.images || []).map((img, i) => (
              <div key={i} className="flex gap-2 mb-1">
                <input className={`flex-1 ${formControlSmall}`} value={img || ""} onChange={(e) => { const imgs = (content.services?.images || []).slice(); imgs[i] = e.target.value; setContent({ ...content, services: { ...(content.services || {}), images: imgs } }); }} />
                <button className="px-2 bg-gray-100 text-black" onClick={() => openImagePicker("services.images", i)}>Choose</button>
                <button className="text-black" onClick={() => { const imgs = (content.services?.images || []).slice(); imgs.splice(i, 1); setContent({ ...content, services: { ...(content.services || {}), images: imgs } }); }}>Remove</button>
              </div>
            ))}
            <div>
              <button onClick={() => { const imgs = [...(content.services?.images || []), ""]; setContent({ ...content, services: { ...(content.services || {}), images: imgs } }); }} className="text-sm px-2 py-1 bg-gray-100 rounded text-black">Add Image</button>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="mb-6 border p-4 rounded">
        <h2 className="font-semibold text-black">ABOUT GRAND EAST</h2>
        <div className="mt-3">
          <label className="block text-sm">Logo Image URL</label>
          <div className="flex gap-2 mb-2">
            <input className="flex-1" value={content.about?.logo || ""} onChange={(e) => setContent({ ...content, about: { ...(content.about || {}), logo: e.target.value } })} />
            <button className="px-2 bg-gray-100 text-black" onClick={() => openImagePicker("about.logo")}>Choose</button>
          </div>
          <label className="block text-sm">Title</label>
          <input className="w-full mb-2" value={content.about?.title || ""} onChange={(e) => setContent({ ...content, about: { ...(content.about || {}), title: e.target.value } })} />
          <label className="block text-sm">Description</label>
          <textarea className="w-full mb-2" value={content.about?.description || ""} onChange={(e) => setContent({ ...content, about: { ...(content.about || {}), description: e.target.value } })} />
          <div className="flex gap-2">
            <input className="flex-1" placeholder="Button Text" value={content.about?.buttonText || ""} onChange={(e) => setContent({ ...content, about: { ...(content.about || {}), buttonText: e.target.value } })} />
            <input className="flex-1" placeholder="Button Link" value={content.about?.buttonLink || ""} onChange={(e) => setContent({ ...content, about: { ...(content.about || {}), buttonLink: e.target.value } })} />
          </div>
        </div>
      </section>

      {/* Image picker modal / inline panel */}
      {picker?.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white max-w-4xl w-full p-4 rounded shadow-lg">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-black">Choose Image</h3>
              <button onClick={closePicker} className="text-sm px-2 py-1 bg-gray-100 rounded text-black">Close</button>
            </div>

            {/* Upload form */}
            <div className="mb-3 flex items-center gap-3">
              <label className="text-sm text-black">Upload from your computer:</label>
              {/* accept AVIF explicitly and fallback to image/* */}
              <input type="file" accept="image/*,.avif" onChange={handleFileUpload} />
              {uploading ? <span className="text-sm text-black">Uploading...</span> : null}
            </div>

            <div className="grid grid-cols-4 gap-3 max-h-64 overflow-auto">
              {images.length === 0 ? <div className="col-span-4 text-sm text-gray-500">No images found in storage bucket "{BUCKET_NAME}". Upload images to Supabase Storage or change BUCKET_NAME.</div> : null}
              {images.map((img) => (
                <button key={img.name} onClick={() => handleSelectImage(img.url)} className="border rounded overflow-hidden">
                  <img src={img.url} alt={img.name} className="w-full h-24 object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button onClick={save} disabled={saving} className="bg-red-600 text-black px-4 py-2 rounded">{saving ? "Saving..." : "Save"}</button>
        {error ? <div className="text-black">{error}</div> : null}
      </div>
    </div>
  );
}