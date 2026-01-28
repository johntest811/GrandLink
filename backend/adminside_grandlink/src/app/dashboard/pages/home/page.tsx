"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../../Clients/Supabase/SupabaseClients";
import { logActivity, autoLogActivity } from "@/app/lib/activity";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";


type HomeContent = {
  carousel?: Array<{ image?: string; youtube_url?: string; title?: string; buttonText?: string; buttonLink?: string }>;
  explore?: Array<{ image?: string; title?: string; buttonText?: string; buttonLink?: string }>;
<<<<<<< HEAD
  featured_projects?: Array<{ image?: string; title?: string; description?: string; youtube_url?: string }>;
  services?: { images?: string[]; title?: string; description?: string; buttonText?: string; buttonLink?: string };
  about?: { logo?: string; title?: string; description?: string; buttonText?: string; buttonLink?: string };
=======
  featured_projects?: Array<{ image?: string; title?: string; description?: string }>;
  services?: {
    images?: string[];
    title?: string;
    description?: string;
    buttonText?: string;
    buttonLink?: string;
  };
  about?: {
    logo?: string;
    title?: string;
    description?: string;
    buttonText?: string;
    buttonLink?: string;
  };
>>>>>>> 25a1fd3 (newest fernandez)
  [k: string]: any;
};


const SectionCard = ({
  title,
  children,
  actions,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-8">
      <div className="flex justify-between items-center px-6 py-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <div className="flex items-center gap-3">
          {actions}
          <button
            onClick={() => setOpen(!open)}
            className="text-sm text-gray-500 hover:text-black"
          >
            {open ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
      {open && <div className="p-6">{children}</div>}
    </div>
  );
};


// bucket name - change to your bucket
const BUCKET_NAME = "uploads";

export default function HomeEditor() {
  const [content, setContent] = useState<HomeContent>({});
  const [originalContent, setOriginalContent] = useState<HomeContent>({});
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [images, setImages] = useState<Array<{ name: string; url: string }>>([]);
  const [picker, setPicker] = useState<{ open: boolean; key: string; index?: number | null } | null>(null);
  const [uploading, setUploading] = useState(false);


  useEffect(() => {
    // Load current admin and log page access
    const loadAdmin = async () => {
      try {
        const sessionData = localStorage.getItem('adminSession');
        if (sessionData) {
          const admin = JSON.parse(sessionData);
          setCurrentAdmin(admin);
          
          // Log page access
          await logActivity({
            admin_id: admin.id,
            admin_name: admin.username,
            action: 'view',
            entity_type: 'page',
            details: `Admin ${admin.username} accessed Home Page editor`,
            page: 'Home',
            metadata: {
              pageAccess: true,
              adminAccount: admin.username,
              adminId: admin.id,
              timestamp: new Date().toISOString(),
              userAgent: navigator.userAgent
            }
          });
        }
      } catch (error) {
        console.error("Error loading admin:", error);
      }
    };

    loadAdmin();
  }, []);

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
          
          // Log load error
          if (currentAdmin) {
            await logActivity({
              admin_id: currentAdmin.id,
              admin_name: currentAdmin.username,
              action: 'view',
              entity_type: 'home_content_error',
              details: `Admin ${currentAdmin.username} failed to load home content: ${res.status} ${res.statusText}`,
              page: 'Home',
              metadata: {
                error: `${res.status} ${res.statusText}`,
                adminAccount: currentAdmin.username,
                timestamp: new Date().toISOString()
              }
            });
          }
          return;
        }

        if (ct.includes("application/json")) {
          const d = await res.json();
          const loadedContent = d?.content ?? d ?? {};
          setContent(loadedContent);
          setOriginalContent(JSON.parse(JSON.stringify(loadedContent))); // Deep copy for comparison
          
          // Log successful content load
          if (currentAdmin) {
            await logActivity({
              admin_id: currentAdmin.id,
              admin_name: currentAdmin.username,
              action: 'view',
              entity_type: 'home_content',
              details: `Admin ${currentAdmin.username} loaded home page content for editing`,
              page: 'Home',
              metadata: {
                sectionsLoaded: Object.keys(loadedContent),
                carouselSlides: loadedContent.carousel?.length || 0,
                exploreItems: loadedContent.explore?.length || 0,
                featuredProjects: loadedContent.featured_projects?.length || 0,
                hasServices: !!loadedContent.services,
                hasAbout: !!loadedContent.about,
                adminAccount: currentAdmin.username,
                adminId: currentAdmin.id,
                timestamp: new Date().toISOString()
              }
            });
          }
        } else {
          // handle non-json response safely
          const txt = await res.text();
          try {
            const parsed = JSON.parse(txt);
            const loadedContent = parsed?.content ?? parsed ?? {};
            setContent(loadedContent);
            setOriginalContent(JSON.parse(JSON.stringify(loadedContent)));
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
    
    if (currentAdmin) {
      load();
    }

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
        
        // Log images loaded
        if (currentAdmin && mapped.length > 0) {
          await logActivity({
            admin_id: currentAdmin.id,
            admin_name: currentAdmin.username,
            action: 'view',
            entity_type: 'home_images',
            details: `Admin ${currentAdmin.username} loaded ${mapped.length} images from storage for home page editing`,
            page: 'Home',
            metadata: {
              imagesCount: mapped.length,
              bucketName: BUCKET_NAME,
              adminAccount: currentAdmin.username,
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (e) {
        console.error("loadImages error:", e);
      }
    };
    loadImages();
  }, [currentAdmin]);

  // Enhanced content change logging
  const logContentChange = async (section: string, field: string, oldValue: any, newValue: any, index?: number) => {
    if (!currentAdmin || oldValue === newValue) return;

    const sectionName = section.charAt(0).toUpperCase() + section.slice(1);
    const indexStr = typeof index === 'number' ? ` (item ${index + 1})` : '';
    
    await logActivity({
      admin_id: currentAdmin.id,
      admin_name: currentAdmin.username,
      action: 'update',
      entity_type: `home_${section}_${field}`,
      details: `Admin ${currentAdmin.username} updated ${sectionName} ${field}${indexStr}: "${String(oldValue || '')}" → "${String(newValue || '')}"`,
      page: 'Home',
      metadata: {
        section: section,
        field: field,
        itemIndex: index,
        oldValue: oldValue,
        newValue: newValue,
        sectionName: sectionName,
        adminAccount: currentAdmin.username,
        adminId: currentAdmin.id,
        timestamp: new Date().toISOString()
      }
    });
  };

  // file upload handler - uploads to storage and refreshes image list
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentAdmin) return;
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
        
        // Log upload error
        await logActivity({
          admin_id: currentAdmin.id,
          admin_name: currentAdmin.username,
          action: 'upload',
          entity_type: 'home_image_error',
          details: `Admin ${currentAdmin.username} failed to upload image for home page: ${uploadError.message}`,
          page: 'Home',
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            error: uploadError.message,
            adminAccount: currentAdmin.username,
            timestamp: new Date().toISOString()
          }
        });
        
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

      // Log successful upload
      await logActivity({
        admin_id: currentAdmin.id,
        admin_name: currentAdmin.username,
        action: 'upload',
        entity_type: 'home_image',
        details: `Admin ${currentAdmin.username} uploaded image for home page: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
        page: 'Home',
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          fileSizeMB: (file.size / 1024 / 1024).toFixed(2),
          fileType: file.type,
          uploadPath: filePath,
          imageUrl: publicUrl,
          bucketName: BUCKET_NAME,
          adminAccount: currentAdmin.username,
          adminId: currentAdmin.id,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (err: any) {
      console.error("handleFileUpload error:", err);
      setError(String(err));
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const save = async () => {
    if (!currentAdmin) return;
    
    setSaving(true);
    setError(null);
    
    try {
      // Calculate comprehensive changes
      const changes: Array<{section: string, field: string, type: string, details: string}> = [];
      
      // Compare carousel changes
      const originalCarousel = originalContent.carousel || [];
      const currentCarousel = content.carousel || [];
      if (originalCarousel.length !== currentCarousel.length) {
        changes.push({
          section: 'carousel',
          field: 'slides',
          type: 'count_change',
          details: `Carousel slides: ${originalCarousel.length} → ${currentCarousel.length}`
        });
      }
      
      // Compare explore changes
      const originalExplore = originalContent.explore || [];
      const currentExplore = content.explore || [];
      if (originalExplore.length !== currentExplore.length) {
        changes.push({
          section: 'explore',
          field: 'items',
          type: 'count_change',
          details: `Explore items: ${originalExplore.length} → ${currentExplore.length}`
        });
      }
      
      // Compare featured projects changes
      const originalProjects = originalContent.featured_projects || [];
      const currentProjects = content.featured_projects || [];
      if (originalProjects.length !== currentProjects.length) {
        changes.push({
          section: 'featured_projects',
          field: 'projects',
          type: 'count_change', 
          details: `Featured projects: ${originalProjects.length} → ${currentProjects.length}`
        });
      }

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
      
      // Log successful save with comprehensive details
      await logActivity({
        admin_id: currentAdmin.id,
        admin_name: currentAdmin.username,
        action: "update",
        entity_type: "home_content",
        details: `Admin ${currentAdmin.username} saved home page content with ${changes.length} section changes`,
        page: "Home",
        metadata: {
          changesCount: changes.length,
          changes: changes,
          sections: {
            carousel: {
              slides: content.carousel?.length || 0,
              changed: originalCarousel.length !== currentCarousel.length
            },
            explore: {
              items: content.explore?.length || 0,
              changed: originalExplore.length !== currentExplore.length
            },
            featured_projects: {
              projects: content.featured_projects?.length || 0,
              changed: originalProjects.length !== currentProjects.length
            },
            services: {
              configured: !!content.services,
              title: content.services?.title || '',
              imagesCount: content.services?.images?.length || 0
            },
            about: {
              configured: !!content.about,
              title: content.about?.title || '',
              hasLogo: !!content.about?.logo
            }
          },
          adminAccount: currentAdmin.username,
          adminId: currentAdmin.id,
          timestamp: new Date().toISOString()
        }
      });

      // Update original content for future comparisons
      setOriginalContent(JSON.parse(JSON.stringify(content)));
      setError(null);
      
    } catch (e: any) {
      setError(e.message || "Failed");
      
      // Log save error
      if (currentAdmin) {
        await logActivity({
          admin_id: currentAdmin.id,
          admin_name: currentAdmin.username,
          action: "update",
          entity_type: "home_content_error",
          details: `Admin ${currentAdmin.username} failed to save home page content: ${e.message}`,
          page: "Home",
          metadata: {
            error: e.message,
            adminAccount: currentAdmin.username,
            timestamp: new Date().toISOString()
          }
        });
      }
    } finally {
      setSaving(false);
    }
  };

  // Enhanced array operations with logging
  const addArrayItem = async <K extends keyof HomeContent>(key: K, item: any = {}) => {
    const oldLength = Array.isArray(content[key]) ? (content[key] as any[]).length : 0;
    
    setContent((prev) => {
      const arr = Array.isArray(prev[key]) ? (prev[key] as any[]).slice() : [];
      arr.push(item);
      return { ...prev, [key]: arr } as HomeContent;
    });

    // Log array item addition
    if (currentAdmin) {
      await logActivity({
        admin_id: currentAdmin.id,
        admin_name: currentAdmin.username,
        action: 'create',
        entity_type: `home_${String(key)}_item`,
        details: `Admin ${currentAdmin.username} added new item to ${String(key)} section (now ${oldLength + 1} items)`,
        page: 'Home',
        metadata: {
          section: String(key),
          itemIndex: oldLength,
          newItemsCount: oldLength + 1,
          adminAccount: currentAdmin.username,
          adminId: currentAdmin.id,
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  const removeArrayItem = async <K extends keyof HomeContent>(key: K, index: number) => {
    const arr = Array.isArray(content[key]) ? (content[key] as any[]) : [];
    const itemToRemove = arr[index];
    const oldLength = arr.length;
    
    setContent((prev) => {
      const newArr = Array.isArray(prev[key]) ? (prev[key] as any[]).slice() : [];
      newArr.splice(index, 1);
      return { ...prev, [key]: newArr } as HomeContent;
    });

    // Log array item removal
    if (currentAdmin) {
      await logActivity({
        admin_id: currentAdmin.id,
        admin_name: currentAdmin.username,
        action: 'delete',
        entity_type: `home_${String(key)}_item`,
        details: `Admin ${currentAdmin.username} removed item from ${String(key)} section at position ${index + 1} (now ${oldLength - 1} items)`,
        page: 'Home',
        metadata: {
          section: String(key),
          removedItemIndex: index,
          removedItem: itemToRemove,
          newItemsCount: oldLength - 1,
          adminAccount: currentAdmin.username,
          adminId: currentAdmin.id,
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  // open image picker for a specific field (key) and optional index (for arrays)
  const openImagePicker = async (key: string, index?: number) => {
    setPicker({ open: true, key, index: typeof index === "number" ? index : null });
    
    // Log image picker opening
    if (currentAdmin) {
      await logActivity({
        admin_id: currentAdmin.id,
        admin_name: currentAdmin.username,
        action: 'view',
        entity_type: 'home_image_picker',
        details: `Admin ${currentAdmin.username} opened image picker for ${key}${typeof index === 'number' ? ` item ${index + 1}` : ''}`,
        page: 'Home',
        metadata: {
          pickerKey: key,
          itemIndex: index,
          adminAccount: currentAdmin.username,
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  // Enhanced image selection with logging
  const handleSelectImage = async (url: string) => {
    if (!picker || !currentAdmin) return;
    const { key, index } = picker;
    
    // Get old value for comparison
    let oldValue = '';
    if (key.includes(".")) {
      const [parent, child] = key.split(".");
      if (content[parent] && child === "images" && typeof index === "number") {
        oldValue = content[parent][child]?.[index] || '';
      } else if (content[parent]) {
        oldValue = content[parent][child] || '';
      }
    } else if (Array.isArray(content[key]) && typeof index === "number") {
      oldValue = (content[key] as any[])[index]?.image || '';
    } else {
      oldValue = content[key] as string || '';
    }
    
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

    // Log image selection
    await logActivity({
      admin_id: currentAdmin.id,
      admin_name: currentAdmin.username,
      action: 'update',
      entity_type: 'home_image_selection',
      details: `Admin ${currentAdmin.username} selected image for ${key}${typeof index === 'number' ? ` item ${index + 1}` : ''}: "${oldValue}" → "${url}"`,
      page: 'Home',
      metadata: {
        pickerKey: key,
        itemIndex: index,
        oldImageUrl: oldValue,
        newImageUrl: url,
        adminAccount: currentAdmin.username,
        adminId: currentAdmin.id,
        timestamp: new Date().toISOString()
      }
    });
    
    setPicker(null);
  };

  const closePicker = () => setPicker(null);

  // Enhanced form field handlers with logging
  const handleCarouselChange = async (index: number, field: string, value: string) => {
    const oldValue = content.carousel?.[index]?.[field as keyof typeof content.carousel[0]] || '';
    
    const arr = content.carousel || [];
    arr[index] = { ...(arr[index] || {}), [field]: value };
    setContent({ ...content, carousel: arr });
    
    await logContentChange('carousel', field, oldValue, value, index);
  };

  const handleExploreChange = async (index: number, field: string, value: string) => {
    const oldValue = content.explore?.[index]?.[field as keyof typeof content.explore[0]] || '';
    
    const arr = content.explore || [];
    arr[index] = { ...(arr[index] || {}), [field]: value };
    setContent({ ...content, explore: arr });
    
    await logContentChange('explore', field, oldValue, value, index);
  };

  const handleFeaturedProjectsChange = async (index: number, field: string, value: string) => {
    const oldValue = content.featured_projects?.[index]?.[field as keyof typeof content.featured_projects[0]] || '';
    
    const arr = content.featured_projects || [];
    arr[index] = { ...(arr[index] || {}), [field]: value };
    setContent({ ...content, featured_projects: arr });
    
    await logContentChange('featured_projects', field, oldValue, value, index);
  };

  const handleServicesChange = async (field: string, value: string) => {
    const oldValue = content.services?.[field as keyof typeof content.services] || '';
    
    setContent({ ...content, services: { ...(content.services || {}), [field]: value } });
    
    await logContentChange('services', field, oldValue, value);
  };

  const handleAboutChange = async (field: string, value: string) => {
    const oldValue = content.about?.[field as keyof typeof content.about] || '';
    
    setContent({ ...content, about: { ...(content.about || {}), [field]: value } });
    
    await logContentChange('about', field, oldValue, value);
  };

  const handleServicesImageChange = async (index: number, value: string) => {
    const oldValue = content.services?.images?.[index] || '';
    
    const imgs = (content.services?.images || []).slice();
    imgs[index] = value;
    setContent({ ...content, services: { ...(content.services || {}), images: imgs } });
    
    await logContentChange('services', 'images', oldValue, value, index);
  };

  // form control classes for visible lines
  const formControl = "w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-200";
  const formControlSmall = "border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-200";

  return (
    <div className="p-6 max-w-6xl mx-auto text-black">
    <div className="flex justify-between items-center mb-8">
      <h1 className="text-3xl font-bold">Home Page Editor</h1>
      <span className="text-sm text-gray-600">
        Editing as: {currentAdmin?.username || "Admin"}
      </span>
    </div>

<<<<<<< HEAD
      {/* Carousel */}
      <section className="mb-6 border p-4 rounded">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-black">Carousel</h2>
          <div className="flex gap-2">
            <button
              onClick={() => addArrayItem("carousel", { image: "", youtube_url: "" })}
              className="text-sm px-2 py-1 bg-gray-100 rounded text-black"
              type="button"
            >
              Add Image Slide
            </button>
            <button
              onClick={() => addArrayItem("carousel", { youtube_url: "" })}
              className="text-sm px-2 py-1 bg-gray-100 rounded text-black"
              type="button"
            >
              Add YouTube Slide
            </button>
          </div>
        </div>
        {(content.carousel || []).map((s, i) => (
          <div key={i} className="mt-3 border-t pt-3">
            <div className="flex gap-2 mb-2">
              <input 
                className={`flex-1 ${formControlSmall}`} 
                placeholder="Image URL" 
                value={s.image || ""} 
                onChange={(e) => handleCarouselChange(i, 'image', e.target.value)} 
              />
              <button className="px-2 bg-gray-100 text-black" onClick={() => openImagePicker("carousel", i)}>Choose</button>
            </div>
            <input
              className={`${formControl} mb-2`}
              placeholder="YouTube URL (optional — if set, this slide becomes a video)"
              value={s.youtube_url || ""}
              onChange={(e) => handleCarouselChange(i, 'youtube_url', e.target.value)}
            />
            <input 
              className={`${formControl} mb-2`} 
              placeholder="Title" 
              value={s.title || ""} 
              onChange={(e) => handleCarouselChange(i, 'title', e.target.value)} 
=======
    <SectionCard
  title="Carousel"
  actions={
    <button
      onClick={() => addArrayItem("carousel", {})}
      className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800"
    >
      + Add Slide
    </button>
  }
>
  <div className="space-y-6">
    {(content.carousel || []).map((s, i) => (
      <div
        key={i}
        className="bg-gray-50 border rounded-xl p-4 shadow-sm space-y-4"
      >
        {/* Image Preview */}
        {s.image && (
          <div className="w-full h-40 rounded-lg overflow-hidden bg-gray-200">
            <img
              src={s.image}
              alt="Preview"
              className="w-full h-full object-cover"
>>>>>>> 25a1fd3 (newest fernandez)
            />
          </div>
        )}

        {/* Image Picker */}
        <div className="flex gap-2">
          <input
            className={`flex-1 ${formControlSmall}`}
            placeholder="Image URL"
            value={s.image || ""}
            onChange={(e) => handleCarouselChange(i, "image", e.target.value)}
          />
          <button
            onClick={() => openImagePicker("carousel", i)}
            className="px-3 py-2 bg-gray-200 rounded-lg text-sm"
          >
            Choose
          </button>
        </div>

        <input
          className={formControl}
          placeholder="Slide Title"
          value={s.title || ""}
          onChange={(e) => handleCarouselChange(i, "title", e.target.value)}
        />

        <div className="grid grid-cols-2 gap-2">
          <input
            className={formControlSmall}
            placeholder="Button Text"
            value={s.buttonText || ""}
            onChange={(e) =>
              handleCarouselChange(i, "buttonText", e.target.value)
            }
          />
          <input
            className={formControlSmall}
            placeholder="Button Link"
            value={s.buttonLink || ""}
            onChange={(e) =>
              handleCarouselChange(i, "buttonLink", e.target.value)
            }
          />
        </div>

        <button
          onClick={() => removeArrayItem("carousel", i)}
          className="text-sm text-red-600 hover:underline"
        >
          Remove Slide
        </button>
      </div>
    ))}
  </div>
</SectionCard>


      {/* Explore */}
      <SectionCard
  title="Explore Our Products"
  actions={
    <button
      onClick={() => addArrayItem("explore", {})}
      className="px-4 py-2 bg-black text-white rounded-lg text-sm"
    >
      + Add Item
    </button>
  }
>
  <div className="space-y-6">
    {(content.explore || []).map((s, i) => (
      <div key={i} className="bg-gray-50 p-4 rounded-xl border space-y-4">
        {s.image && (
          <div className="h-32 rounded-lg overflow-hidden bg-gray-200">
            <img src={s.image} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex gap-2">
          <input
            className={`flex-1 ${formControlSmall}`}
            placeholder="Image URL"
            value={s.image || ""}
            onChange={(e) => handleExploreChange(i, "image", e.target.value)}
          />
          <button
            onClick={() => openImagePicker("explore", i)}
            className="px-3 bg-gray-200 rounded"
          >
            Choose
          </button>
        </div>

        <input
          className={formControl}
          placeholder="Title"
          value={s.title || ""}
          onChange={(e) => handleExploreChange(i, "title", e.target.value)}
        />

        <div className="grid grid-cols-2 gap-2">
          <input
            className={formControlSmall}
            placeholder="Button Text"
            value={s.buttonText || ""}
            onChange={(e) =>
              handleExploreChange(i, "buttonText", e.target.value)
            }
          />
          <input
            className={formControlSmall}
            placeholder="Button Link"
            value={s.buttonLink || ""}
            onChange={(e) =>
              handleExploreChange(i, "buttonLink", e.target.value)
            }
          />
        </div>

        <button
          onClick={() => removeArrayItem("explore", i)}
          className="text-sm text-red-600 hover:underline"
        >
          Remove Item
        </button>
      </div>
    ))}
  </div>
</SectionCard>


      {/* Featured Projects */}
<<<<<<< HEAD
      <section className="mb-6 border p-4 rounded">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-black">Featured Projects</h2>
          <button onClick={() => addArrayItem("featured_projects", {})} className="text-sm px-2 py-1 bg-gray-100 rounded text-black">Add Project</button>
        </div>
        {(content.featured_projects || []).map((p, i) => (
          <div key={i} className="mt-3 border-t pt-3">
            <div className="flex gap-2 mb-2">
              <input 
                className={`flex-1 ${formControlSmall}`} 
                placeholder="Image URL" 
                value={p.image || ""} 
                onChange={(e) => handleFeaturedProjectsChange(i, 'image', e.target.value)} 
              />
              <button className="px-2 bg-gray-100 text-black" onClick={() => openImagePicker("featured_projects", i)}>Choose</button>
            </div>
            <input 
              className={`${formControl} mb-2`} 
              placeholder="Title" 
              value={p.title || ""} 
              onChange={(e) => handleFeaturedProjectsChange(i, 'title', e.target.value)} 
            />
            <textarea 
              className={`${formControl} mb-2`} 
              placeholder="Description" 
              value={p.description || ""} 
              onChange={(e) => handleFeaturedProjectsChange(i, 'description', e.target.value)} 
            />
            <input
              className={`${formControl} mb-2`}
              placeholder="YouTube URL (e.g. https://www.youtube.com/watch?v=...)"
              value={p.youtube_url || ""}
              onChange={(e) => handleFeaturedProjectsChange(i, 'youtube_url', e.target.value)}
            />
            <button className="text-black" onClick={() => removeArrayItem("featured_projects", i)}>Remove</button>
=======
      <SectionCard
  title="Featured Projects"
  actions={
    <button
      onClick={() => addArrayItem("featured_projects", {})}
      className="px-4 py-2 bg-black text-white rounded-lg text-sm"
    >
      + Add Project
    </button>
  }
>
  <div className="space-y-6">
    {(content.featured_projects || []).map((p, i) => (
      <div key={i} className="bg-gray-50 border rounded-xl p-4 space-y-4">
        {p.image && (
          <div className="h-40 rounded-lg overflow-hidden bg-gray-200">
            <img src={p.image} className="w-full h-full object-cover" />
>>>>>>> 25a1fd3 (newest fernandez)
          </div>
        )}

        <div className="flex gap-2">
          <input
            className={`flex-1 ${formControlSmall}`}
            placeholder="Image URL"
            value={p.image || ""}
            onChange={(e) =>
              handleFeaturedProjectsChange(i, "image", e.target.value)
            }
          />
          <button
            onClick={() => openImagePicker("featured_projects", i)}
            className="px-3 bg-gray-200 rounded"
          >
            Choose
          </button>
        </div>

        <input
          className={formControl}
          placeholder="Project Title"
          value={p.title || ""}
          onChange={(e) =>
            handleFeaturedProjectsChange(i, "title", e.target.value)
          }
        />

        <textarea
          className={formControl}
          placeholder="Description"
          value={p.description || ""}
          onChange={(e) =>
            handleFeaturedProjectsChange(i, "description", e.target.value)
          }
        />

        <button
          onClick={() => removeArrayItem("featured_projects", i)}
          className="text-sm text-red-600 hover:underline"
        >
          Remove Project
        </button>
      </div>
    ))}
  </div>
</SectionCard>


      {/* Services */}
      <SectionCard title="Services We Offer">
  <div className="space-y-6">

    {/* Text Content */}
    <div className="bg-gray-50 p-4 rounded-xl border space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Section Title
        </label>
        <input
          className={formControl}
          value={content.services?.title || ""}
          onChange={(e) => handleServicesChange("title", e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          className={formControl}
          rows={4}
          value={content.services?.description || ""}
          onChange={(e) => handleServicesChange("description", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input
          className={formControlSmall}
          placeholder="Button Text"
          value={content.services?.buttonText || ""}
          onChange={(e) => handleServicesChange("buttonText", e.target.value)}
        />
        <input
          className={formControlSmall}
          placeholder="Button Link"
          value={content.services?.buttonLink || ""}
          onChange={(e) => handleServicesChange("buttonLink", e.target.value)}
        />
      </div>
    </div>

    {/* Carousel Images */}
    <div className="bg-gray-50 p-4 rounded-xl border">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-medium text-sm text-gray-800">
          Carousel Images
        </h4>
        <span className="text-xs text-gray-500">Recommended: 4 images</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {(content.services?.images || []).map((img, i) => (
          <div key={i} className="border rounded-lg p-3 bg-white space-y-2">
            {img && (
              <div className="h-28 rounded-md overflow-hidden bg-gray-200">
                <img
                  src={img}
                  alt="Service preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <input
              className={formControlSmall}
              value={img || ""}
              onChange={(e) => handleServicesImageChange(i, e.target.value)}
              placeholder="Image URL"
            />

            <div className="flex justify-between text-sm">
              <button
                onClick={() => openImagePicker("services.images", i)}
                className="text-blue-600 hover:underline"
              >
                Choose Image
              </button>
              <button
                onClick={() => {
                  const imgs = (content.services?.images || []).slice();
                  imgs.splice(i, 1);
                  setContent({
                    ...content,
                    services: { ...(content.services || {}), images: imgs },
                  });
                }}
                className="text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          const imgs = [...(content.services?.images || []), ""];
          setContent({
            ...content,
            services: { ...(content.services || {}), images: imgs },
          });
        }}
        className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800"
      >
        + Add Image
      </button>
    </div>
  </div>
</SectionCard>


      {/* About */}
     <SectionCard title="About Grand East">
  <div className="space-y-6">

    {/* Logo */}
    <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Logo Image
      </label>

      {content.about?.logo && (
        <div className="h-24 w-48 bg-white border rounded-lg flex items-center justify-center overflow-hidden">
          <img
            src={content.about.logo}
            alt="Logo Preview"
            className="max-h-full object-contain"
          />
        </div>
      )}

      <div className="flex gap-2">
        <input
          className={formControlSmall}
          value={content.about?.logo || ""}
          onChange={(e) => handleAboutChange("logo", e.target.value)}
          placeholder="Logo URL"
        />
        <button
          onClick={() => openImagePicker("about.logo")}
          className="px-3 py-2 bg-gray-200 rounded-lg text-sm"
        >
          Choose
        </button>
      </div>
    </div>

    {/* Text Content */}
    <div className="bg-gray-50 p-4 rounded-xl border space-y-4">
      <input
        className={formControl}
        placeholder="Title"
        value={content.about?.title || ""}
        onChange={(e) => handleAboutChange("title", e.target.value)}
      />

      <textarea
        className={formControl}
        rows={4}
        placeholder="Description"
        value={content.about?.description || ""}
        onChange={(e) => handleAboutChange("description", e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <input
          className={formControlSmall}
          placeholder="Button Text"
          value={content.about?.buttonText || ""}
          onChange={(e) => handleAboutChange("buttonText", e.target.value)}
        />
        <input
          className={formControlSmall}
          placeholder="Button Link"
          value={content.about?.buttonLink || ""}
          onChange={(e) => handleAboutChange("buttonLink", e.target.value)}
        />
      </div>
    </div>
  </div>
</SectionCard>


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
        <button onClick={save} disabled={saving} className="bg-red-600 text-white px-4 py-2 rounded">
          {saving ? "Saving..." : "Save"}
        </button>
        {error ? <div className="text-red-600">{error}</div> : null}
      </div>
    </div>
  );
}