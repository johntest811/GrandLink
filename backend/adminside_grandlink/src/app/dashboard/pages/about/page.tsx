"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../Clients/Supabase/SupabaseClients";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Edit3 } from "lucide-react";

interface About {
  id: number;
  grand: string;
  description: string;
  mission: string;
  vision: string;
}

export default function AdminAboutPage() {
  const [about, setAbout] = useState<About | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Partial<About>>({});

  useEffect(() => {
    fetchAbout();
  }, []);

  const fetchAbout = async () => {
    const { data, error } = await supabase.from("about").select("*").single();
    if (!error && data) {
      setAbout(data);
      setForm(data);
    } else {
      console.error(error);
    }
  };

  const handleSave = async () => {
    if (!about) return;
    setLoading(true);
    const { error } = await supabase
      .from("about")
      .update({
        grand: form.grand,
        description: form.description,
        mission: form.mission,
        vision: form.vision,
        updated_at: new Date(),
      })
      .eq("id", about.id);

    setLoading(false);
    if (!error) {
      setEditing(false);
      fetchAbout();
    } else {
      console.error(error);
    }
  };

  if (!about) {
    return <p className="text-center mt-10 text-black">Loading...</p>;
  }

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      <h1 className="text-3xl font-bold mb-6 text-black">Admin – About Page</h1>

      <Card className="shadow-lg rounded-2xl border border-gray-900 bg-white">
        <CardContent className="p-6 space-y-6">
          {!editing ? (
            <>
              <div>
                <h2 className="text-xl font-semibold text-black mb-2">Grand</h2>
                <p className="text-black">{about.grand}</p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-black mb-2">Description</h2>
                <p className="text-black">{about.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-xl font-semibold text-black mb-2">Mission</h2>
                  <p className="text-black">{about.mission}</p>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-black mb-2">Vision</h2>
                  <p className="text-black">{about.vision}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <Input
                placeholder="Grand Title"
                value={form.grand || ""}
                onChange={(e) => setForm({ ...form, grand: e.target.value })}
                className="text-black placeholder:text-black"
              />
              <Textarea
                placeholder="Description"
                rows={3}
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="text-black placeholder:text-black"
              />
              <Textarea
                placeholder="Mission"
                rows={3}
                value={form.mission || ""}
                onChange={(e) => setForm({ ...form, mission: e.target.value })}
                className="text-black placeholder:text-black"
              />
              <Textarea
                placeholder="Vision"
                rows={3}
                value={form.vision || ""}
                onChange={(e) => setForm({ ...form, vision: e.target.value })}
                className="text-black placeholder:text-black"
              />
            </div>
          )}

          <div className="flex gap-3">
            {!editing && (
              <Button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Edit3 size={18} /> Edit
              </Button>
            )}
            {editing && (
              <>
                <Button
                  onClick={handleSave}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setForm(about);
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}