"use client";

import TopNavBarLoggedIn from "@/components/TopNavBarLoggedIn";
import Footer from "@/components/Footer";
import Image from "next/image";
import { FaMapMarkerAlt, FaBell, FaCog, FaQuestionCircle } from "react-icons/fa";

export default function UserProfilePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <TopNavBarLoggedIn />
      <main className="flex-1 flex flex-row">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r flex flex-col items-center py-8 px-4">
          {/* Profile Section */}
          <div className="flex flex-col items-center mb-8">
            <Image
              src="/default-profile.png" // Place your profile image in public/default-profile.png
              alt="Profile"
              width={80}
              height={80}
              className="rounded-full border border-gray-300"
            />
            <h2 className="text-base font-bold mt-2">Elton John Lee</h2>
            <button className="text-xs text-gray-500 hover:underline mt-1">
              Edit Profile
            </button>
          </div>
          {/* Sidebar Links */}
          <nav className="w-full flex flex-col gap-4">
            <a
              href="#"
              className="flex items-center gap-2 text-[#8B1C1C] font-semibold"
            >
              <FaMapMarkerAlt /> My Address
            </a>
            <a
              href="#"
              className="flex items-center gap-2 text-gray-700 hover:text-[#8B1C1C]"
            >
              <FaBell /> Notification Settings
            </a>
            <a
              href="#"
              className="flex items-center gap-2 text-gray-700 hover:text-[#8B1C1C]"
            >
              <FaCog /> Settings
            </a>
            <a
              href="#"
              className="flex items-center gap-2 text-[#8B1C1C] font-semibold"
            >
              <span className="font-bold text-lg">!</span> FAQs
            </a>
            <a
              href="#"
              className="flex items-center gap-2 text-gray-700 hover:text-[#8B1C1C]"
            >
              <FaQuestionCircle /> Help Centre
            </a>
            <a
              href="#"
              className="flex items-center gap-2 text-gray-700 hover:text-[#8B1C1C]"
            >
              <span className="font-bold text-lg">?</span> Inquire
            </a>
          </nav>
          <button className="bg-[#8B1C1C] text-white px-6 py-2 rounded font-semibold mt-10 w-full hover:bg-[#a83232] transition">
            Logout
          </button>
        </aside>
        {/* Main Content */}
        <section className="flex-1 flex flex-col px-8 py-8">
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button className="px-6 py-2 border rounded bg-[#8B1C1C] text-white font-semibold">
              All
            </button>
            <button className="px-6 py-2 border rounded bg-white text-gray-700 font-semibold">
              My List
            </button>
            <button className="px-6 py-2 border rounded bg-white text-gray-700 font-semibold">
              Reserve
            </button>
            <button className="px-6 py-2 border rounded bg-white text-gray-700 font-semibold">
              Order
            </button>
            <button className="px-6 py-2 border rounded bg-white text-gray-700 font-semibold">
              Completed
            </button>
            <button className="px-6 py-2 border rounded bg-white text-gray-700 font-semibold">
              Cancelled
            </button>
          </div>
          {/* Search Bar */}
          <div className="mb-2">
            <input
              type="text"
              placeholder="you can search by order id or product name"
              className="w-full border rounded px-4 py-2 bg-gray-100 text-gray-700"
            />
          </div>
          <hr className="mb-4" />
          {/* No Orders Yet */}
          <div className="flex flex-1 items-center justify-center border rounded bg-white">
            <div className="flex flex-col items-center">
              <Image
                src="/no-orders.png"
                alt="No Orders"
                width={80}
                height={80}
              />
              <p className="mt-4 text-gray-600 text-lg font-medium">
                No Orders yet
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}