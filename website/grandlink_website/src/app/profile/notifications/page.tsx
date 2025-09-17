"use client";

import { useState } from "react";

export default function ProfileNotificationsPage() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Saved! Email: ${emailEnabled}, SMS: ${smsEnabled}`);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-8 mx-auto mt-12 border border-gray-100">
      <h2 className="text-2xl font-bold mb-6 text-[#8B1C1C]">Notification Settings</h2>
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        
        {/* Email Notifications */}
        <div className="flex items-center justify-between">
          <div>
            <label className="font-semibold block">Email Notifications</label>
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
            <label className="font-semibold block">SMS Notifications</label>
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
