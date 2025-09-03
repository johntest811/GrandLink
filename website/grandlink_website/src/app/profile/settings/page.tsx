"use client";

export default function ProfileSettingsPage() {
  return (
    <div className="bg-white rounded-xl shadow-lg w-full max-w-xl p-8 mx-auto mt-12">
      <h2 className="text-2xl font-bold mb-6 text-[#8B1C1C]">Account Settings</h2>
      <form className="flex flex-col gap-4">
        <label className="font-semibold">Change Password</label>
        <input type="password" placeholder="New Password" className="border rounded px-3 py-2" />
        <input type="password" placeholder="Confirm New Password" className="border rounded px-3 py-2" />
        <button className="bg-[#8B1C1C] text-white px-4 py-2 rounded font-semibold mt-2 hover:bg-[#a83232] transition">
          Save Changes
        </button>
      </form>
    </div>
  );
}