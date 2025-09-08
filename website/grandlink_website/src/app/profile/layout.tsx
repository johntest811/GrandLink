"use client";

import Image from "next/image";
import Link from "next/link";
import TopNavBarLoggedIn from "@/components/TopNavBarLoggedIn";
import Footer from "@/components/Footer";
import { FaUserCircle, FaMapMarkerAlt, FaBell, FaCog, FaQuestionCircle } from "react-icons/fa";
import { useState, useEffect } from "react";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await import("@/app/Clients/Supabase/SupabaseClients").then(mod => mod.supabase.auth.getUser());
      setUser(data?.user || null);
    };
    fetchUser();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <TopNavBarLoggedIn />
      <main className="flex-1 flex flex-row">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r flex flex-col items-center py-8 px-4 min-h-screen">
          {/* Profile Section */}
          <div className="flex flex-col items-center mb-8 group">
            <div className="w-20 h-20 rounded-full border border-gray-300 flex items-center justify-center mb-2 bg-white overflow-hidden group-hover:border-[#8B1C1C] transition">
              {user?.user_metadata?.avatar_url ? (
                <Image
                  src={user.user_metadata.avatar_url}
                  alt="Profile"
                  width={80}
                  height={80}
                  className="rounded-full object-cover"
                />
              ) : (
                <span className="text-gray-300 text-lg">Profile</span>
              )}
            </div>
            <h2 className="text-base font-bold mt-2 text-gray-700 group-hover:text-[#8B1C1C] transition">
              {user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "User"}
            </h2>
            {user?.email && (
              <span className="text-xs text-gray-500 mt-1">{user.email}</span>
            )}
            <button className="text-xs text-gray-500 hover:underline mt-1">Edit Profile</button>
          </div>
          {/* Sidebar Links */}
          <nav className="w-full flex flex-col gap-6">
            <Link href="/profile" className="flex items-center gap-2 text-gray-700 hover:text-[#8B1C1C] font-semibold">
              <FaUserCircle /> Profile
            </Link>
            <Link href="/profile/address" className="flex items-center gap-2 text-gray-700 hover:text-[#8B1C1C] font-semibold">
              <FaMapMarkerAlt /> My Address
            </Link>
            <Link href="/profile/notifications" className="flex items-center gap-2 text-gray-700 hover:text-[#8B1C1C] font-semibold">
              <FaBell /> Notification Settings
            </Link>
            <Link href="/profile/settings" className="flex items-center gap-2 text-gray-700 hover:text-[#8B1C1C] font-semibold">
              <FaCog /> Settings
            </Link>
            <Link href="/FAQs" className="flex items-center gap-2 text-gray-700 hover:text-[#8B1C1C] font-semibold">
              <span className="font-bold text-lg">!</span> FAQs
            </Link>
            <Link href="#" className="flex items-center gap-2 text-gray-700 hover:text-[#8B1C1C] font-semibold">
              <FaQuestionCircle /> Help Centre
            </Link>
            <Link href="#" className="flex items-center gap-2 text-gray-700 hover:text-[#8B1C1C] ">
              <span className="font-bold text-lg">?</span> Inquire
            </Link>
          </nav>
          <button className="bg-[#8B1C1C] text-white px-6 py-2 rounded font-semibold mt-10 w-full hover:bg-[#a83232] transition">
            Logout
          </button>
        </aside>
        {/* Page Content */}
        <section className="flex-1 flex flex-col">
          {children}
        </section>
      </main>
      <Footer />
    </div>
  );
}