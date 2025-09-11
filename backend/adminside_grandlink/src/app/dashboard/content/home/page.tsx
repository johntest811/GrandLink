"use client";

import React, { useEffect, useState } from "react";

type HomeContent = {
  carousel?: Array<{ image?: string; title?: string; buttonText?: string; buttonLink?: string }>;
  explore?: Array<{ image?: string; title?: string; buttonText?: string; buttonLink?: string }>;
  featured_projects?: Array<{ image?: string; title?: string; description?: string }>;
  services?: { images?: string[]; title?: string; description?: string; buttonText?: string; buttonLink?: string };
  about?: { logo?: string; title?: string; description?: string; buttonText?: string; buttonLink?: string };
  [k: string]: any;
};

export default function HomeEditor() {
  const [content, setContent] = useState<HomeContent>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/home").then((r) => r.json()).then((d) => {
      if (d?.content) setContent(d.content);
      else if (d) setContent(d);
    }).catch((e) => setError(String(e)));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/home", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "save failed");
      // optionally refresh content
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  };

  // small helpers for editing arrays
  const ensureArray = <K extends keyof HomeContent>(key: K) => {
    if (!Array.isArray(content[key])) setContent({ ...content, [key]: [] });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Home Page Editor</h1>

      {/* Carousel */}
      <section className="mb-6 border p-4 rounded">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">Carousel</h2>
          <button onClick={() => { ensureArray("carousel"); (content.carousel as any[]).push({}); setContent({ ...content }); }} className="text-sm px-2 py-1 bg-gray-100 rounded">Add Slide</button>
        </div>
        {(content.carousel || []).map((s, i) => (
          <div key={i} className="mt-3 border-t pt-3">
            <input className="w-full mb-2" placeholder="Image URL" value={s.image || ""} onChange={(e) => { const arr = content.carousel || []; arr[i] = { ...(arr[i] || {}), image: e.target.value }; setContent({ ...content, carousel: arr }); }} />
            <input className="w-full mb-2" placeholder="Title" value={s.title || ""} onChange={(e) => { const arr = content.carousel || []; arr[i] = { ...(arr[i] || {}), title: e.target.value }; setContent({ ...content, carousel: arr }); }} />
            <div className="flex gap-2">
              <input className="flex-1" placeholder="Button Text" value={s.buttonText || ""} onChange={(e) => { const arr = content.carousel || []; arr[i] = { ...(arr[i] || {}), buttonText: e.target.value }; setContent({ ...content, carousel: arr }); }} />
              <input className="flex-1" placeholder="Button Link" value={s.buttonLink || ""} onChange={(e) => { const arr = content.carousel || []; arr[i] = { ...(arr[i] || {}), buttonLink: e.target.value }; setContent({ ...content, carousel: arr }); }} />
              <button className="text-red-600" onClick={() => { const arr = (content.carousel || []).slice(); arr.splice(i, 1); setContent({ ...content, carousel: arr }); }}>Remove</button>
            </div>
          </div>
        ))}
      </section>

      {/* Explore */}
      <section className="mb-6 border p-4 rounded">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">Explore Our Products</h2>
          <button onClick={() => { ensureArray("explore"); (content.explore as any[]).push({}); setContent({ ...content }); }} className="text-sm px-2 py-1 bg-gray-100 rounded">Add Item</button>
        </div>
        {(content.explore || []).map((s, i) => (
          <div key={i} className="mt-3 border-t pt-3">
            <input className="w-full mb-2" placeholder="Image URL" value={s.image || ""} onChange={(e) => { const arr = content.explore || []; arr[i] = { ...(arr[i] || {}), image: e.target.value }; setContent({ ...content, explore: arr }); }} />
            <input className="w-full mb-2" placeholder="Title" value={s.title || ""} onChange={(e) => { const arr = content.explore || []; arr[i] = { ...(arr[i] || {}), title: e.target.value }; setContent({ ...content, explore: arr }); }} />
            <div className="flex gap-2">
              <input className="flex-1" placeholder="Button Text" value={s.buttonText || ""} onChange={(e) => { const arr = content.explore || []; arr[i] = { ...(arr[i] || {}), buttonText: e.target.value }; setContent({ ...content, explore: arr }); }} />
              <input className="flex-1" placeholder="Button Link" value={s.buttonLink || ""} onChange={(e) => { const arr = content.explore || []; arr[i] = { ...(arr[i] || {}), buttonLink: e.target.value }; setContent({ ...content, explore: arr }); }} />
              <button className="text-red-600" onClick={() => { const arr = (content.explore || []).slice(); arr.splice(i, 1); setContent({ ...content, explore: arr }); }}>Remove</button>
            </div>
          </div>
        ))}
      </section>

      {/* Featured Projects */}
      <section className="mb-6 border p-4 rounded">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">Featured Projects</h2>
          <button onClick={() => { ensureArray("featured_projects"); (content.featured_projects as any[]).push({}); setContent({ ...content }); }} className="text-sm px-2 py-1 bg-gray-100 rounded">Add Project</button>
        </div>
        {(content.featured_projects || []).map((p, i) => (
          <div key={i} className="mt-3 border-t pt-3">
            <input className="w-full mb-2" placeholder="Image URL" value={p.image || ""} onChange={(e) => { const arr = content.featured_projects || []; arr[i] = { ...(arr[i] || {}), image: e.target.value }; setContent({ ...content, featured_projects: arr }); }} />
            <input className="w-full mb-2" placeholder="Title" value={p.title || ""} onChange={(e) => { const arr = content.featured_projects || []; arr[i] = { ...(arr[i] || {}), title: e.target.value }; setContent({ ...content, featured_projects: arr }); }} />
            <textarea className="w-full mb-2" placeholder="Description" value={p.description || ""} onChange={(e) => { const arr = content.featured_projects || []; arr[i] = { ...(arr[i] || {}), description: e.target.value }; setContent({ ...content, featured_projects: arr }); }} />
            <button className="text-red-600" onClick={() => { const arr = (content.featured_projects || []).slice(); arr.splice(i, 1); setContent({ ...content, featured_projects: arr }); }}>Remove</button>
          </div>
        ))}
      </section>

      {/* Services */}
      <section className="mb-6 border p-4 rounded">
        <h2 className="font-semibold">Service We Offer</h2>
        <div className="mt-3">
          <label className="block text-sm">Title</label>
          <input className="w-full mb-2" value={content.services?.title || ""} onChange={(e) => setContent({ ...content, services: { ...(content.services || {}), title: e.target.value } })} />
          <label className="block text-sm">Description</label>
          <textarea className="w-full mb-2" value={content.services?.description || ""} onChange={(e) => setContent({ ...content, services: { ...(content.services || {}), description: e.target.value } })} />
          <label className="block text-sm">Button Text / Link</label>
          <div className="flex gap-2 mb-2">
            <input className="flex-1" placeholder="Button Text" value={content.services?.buttonText || ""} onChange={(e) => setContent({ ...content, services: { ...(content.services || {}), buttonText: e.target.value } })} />
            <input className="flex-1" placeholder="Button Link" value={content.services?.buttonLink || ""} onChange={(e) => setContent({ ...content, services: { ...(content.services || {}), buttonLink: e.target.value } })} />
          </div>

          <div>
            <label className="block text-sm mb-1">Carousel Images (4)</label>
            {(content.services?.images || []).map((img, i) => (
              <div key={i} className="flex gap-2 mb-1">
                <input className="flex-1" value={img || ""} onChange={(e) => { const imgs = (content.services?.images || []).slice(); imgs[i] = e.target.value; setContent({ ...content, services: { ...(content.services || {}), images: imgs } }); }} />
                <button className="text-red-600" onClick={() => { const imgs = (content.services?.images || []).slice(); imgs.splice(i, 1); setContent({ ...content, services: { ...(content.services || {}), images: imgs } }); }}>Remove</button>
              </div>
            ))}
            <div>
              <button onClick={() => { const imgs = [...(content.services?.images || []), ""]; setContent({ ...content, services: { ...(content.services || {}), images: imgs } }); }} className="text-sm px-2 py-1 bg-gray-100 rounded">Add Image</button>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="mb-6 border p-4 rounded">
        <h2 className="font-semibold">ABOUT GRAND EAST</h2>
        <div className="mt-3">
          <label className="block text-sm">Logo Image URL</label>
          <input className="w-full mb-2" value={content.about?.logo || ""} onChange={(e) => setContent({ ...content, about: { ...(content.about || {}), logo: e.target.value } })} />
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

      <div className="flex items-center gap-4">
        <button onClick={save} disabled={saving} className="bg-red-600 text-white px-4 py-2 rounded">{saving ? "Saving..." : "Save"}</button>
        {error ? <div className="text-red-600">{error}</div> : null}
      </div>
    </div>
  );
}