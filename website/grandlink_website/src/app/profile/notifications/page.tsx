"use client";

import { useState } from "react";
import { supabase } from "@/app/Clients/Supabase/SupabaseClients";
import React from "react";

export default function ProfileNotificationsPage() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  // load saved preferences on mount
  React.useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      const prefs = (user?.user_metadata as any)?.notifications;
      if (prefs) {
        setEmailEnabled(Boolean(prefs.emailEnabled));
        setSmsEnabled(Boolean(prefs.smsEnabled));
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // save to user metadata (client-side update)
    const { error } = await supabase.auth.updateUser({
      data: { notifications: { emailEnabled, smsEnabled } },
    });
    if (error) {
      console.error("save preferences error", error);
      alert("Could not save preferences");
      return;
    }
    alert("Saved!");
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-8 mx-auto mt-12 border border-gray-100">
      <h2 className="text-2xl font-bold mb-6 text-[#8B1C1C]">Notification Settings</h2>
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        {/* Email Notifications */}
        <div className="flex items-center justify-between">
          <div>
            <label className="font-semibold block text-gray-700">Email Notifications</label>
            <p className="text-sm text-gray-500">Get updates via email about orders & messages.</p>
          </div>
          <button
            type="button"
            onClick={() => setEmailEnabled(!emailEnabled)}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
              emailEnabled ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
                emailEnabled ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* SMS Notifications */}
        <div className="flex items-center justify-between">
          <div>
            <label className="font-semibold block text-gray-700">SMS Notifications</label>
            <p className="text-sm text-gray-500">Receive important updates directly to your phone.</p>
          </div>
          <button
            type="button"
            onClick={() => setSmsEnabled(!smsEnabled)}
            className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
              smsEnabled ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
                smsEnabled ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          className="bg-[#8B1C1C] text-white px-6 py-3 rounded-xl font-semibold mt-4 hover:bg-[#a83232] transition shadow"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
