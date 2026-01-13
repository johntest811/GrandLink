"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../Clients/Supabase/SupabaseClients";

type ContentRow = {
  id: string;
  title: string;
  description: string;
  phone?: string | null;
  email?: string | null;
  facebook?: string | null;
  updated_at: string;
};

export default function InquireContentEditor() {
  const [content, setContent] = useState<ContentRow | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [facebook, setFacebook] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("inqruire_content")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (!mounted) return;

        if (data) {
          setContent(data);
          setTitle(data.title);
          setDescription(data.description);
          setPhone(data.phone ?? "");
          setEmail(data.email ?? "");
          setFacebook(data.facebook ?? "");
        } else {
          setContent(null);
          setTitle("Inquire Now");
          setDescription(
            "We’re happy to help you bring your vision to life. Kindly provide us with your requirements and contact information below. Our team will get back to you as soon as possible."
          );
          setPhone("0927-574-9475");
          setEmail("grand-east@gmail.com");
          setFacebook("facebook.com/grandeast");
        }
      } catch (err) {
        console.error("load inquire content", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) {
      alert("Title and description are required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        facebook: facebook.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (content?.id) {
        const { error } = await supabase
          .from("inqruire_content")
          .update(payload)
          .eq("id", content.id);
        if (error) throw error;
        alert("Content updated.");
      } else {
        const { data, error } = await supabase
          .from("inqruire_content")
          .insert([payload])
          .select()
          .maybeSingle();
        if (error) throw error;
        setContent(data ?? null);
        alert("Content created.");
      }
    } catch (err) {
      console.error("save inquire content", err);
      alert("Could not save content.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 text-black">
      {/* Header */}
      <header className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold">Inquire Page Editor</h1>
          <p className="text-gray-500 text-sm">
            Manage content displayed on the Inquire page
          </p>
        </div>

        <Link
          href="/dashboard/inquiries"
          className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm font-medium"
        >
          ← Back to Inquiries
        </Link>
      </header>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-md border p-8">
        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading…</div>
        ) : (
          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold mb-1">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Inquire page title"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold mb-1">
                Side Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="w-full rounded-lg border px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Text shown on the left side of the inquire page"
              />
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border px-4 py-2"
                  placeholder="Phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border px-4 py-2"
                  placeholder="Email address"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Facebook
                </label>
                <input
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  className="w-full rounded-lg border px-4 py-2"
                  placeholder="Facebook URL"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  if (!content) {
                    setTitle("Inquire Now");
                    setDescription(
                      "We’re happy to help you bring your vision to life. Kindly provide us with your requirements and contact information below. Our team will get back to you as soon as possible."
                    );
                    setPhone("0927-574-9475");
                    setEmail("grand-east@gmail.com");
                    setFacebook("facebook.com/grandeast");
                  } else {
                    setTitle(content.title);
                    setDescription(content.description);
                    setPhone(content.phone ?? "");
                    setEmail(content.email ?? "");
                    setFacebook(content.facebook ?? "");
                  }
                }}
                className="px-4 py-2 rounded-lg border bg-gray-100 hover:bg-gray-200 text-sm"
              >
                Reset
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
