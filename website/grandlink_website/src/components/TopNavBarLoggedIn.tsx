"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { FaEnvelope, FaThumbsUp, FaPhone, FaUserCircle, FaChevronDown } from "react-icons/fa";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/Clients/Supabase/SupabaseClients";

export default function TopNavBarLoggedIn() {
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    fetchUser();
  }, []);
  const [hoveredDropdown, setHoveredDropdown] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Helper to get nav bar bottom position for dropdown
  const getNavBottom = () => {
    if (navRef.current) {
      const rect = navRef.current.getBoundingClientRect();
      return rect.bottom;
    }
    return 60; // fallback
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
        setShowConfirm(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setShowConfirm(true);
  };

  const confirmLogout = () => {
    setShowConfirm(false);
    setOpen(false);
    router.push("/login"); // Replace with your actual logout logic if needed
  };

  return (
    <>
      {/* Main Navigation */}
      <header className="w-full bg-white flex flex-col sm:flex-row items-center justify-between px-4 py-2 shadow z-20 relative">
        <div className="flex items-center gap-2 mb-3 mt-3">
          <Image src="/Ge Logo.avif" alt="Grand East Logo" width={170} height={170} />
        </div>
        <nav ref={navRef} className="flex-1 flex justify-center items-center gap-8 ml-8 relative z-30">
          <Link href="/home" className="text-gray-700 hover:text-[#8B1C1C] font-medium">Home</Link>
          
          {/* About Us Dropdown */}
          <div
            className="relative group"
            onMouseEnter={() => setHoveredDropdown("about")}
            onMouseLeave={() => setHoveredDropdown(null)}
          >
            <Link
              href="/about-us"
              className="flex items-center gap-1 text-gray-700 hover:text-[#8B1C1C] font-medium"
            >
              About Us <FaChevronDown className="text-xs mt-1" />
            </Link>
            {hoveredDropdown === "about" && (
              <div
                className="fixed left-auto bg-white shadow rounded z-50 min-w-[180px]"
                style={{
                  top: getNavBottom(),
                  left: navRef.current
                    ? navRef.current.querySelectorAll("a")[1]?.getBoundingClientRect().left
                    : 200,
                }}
              >
                {/* <Link href="/about-us" className="block px-4 py-2 hover:bg-gray-100 text-gray-700">About Us</Link> */}
                <Link href="/showroom" className="block px-4 py-2 hover:bg-gray-100 text-gray-700">Showroom</Link>
                {/* <Link href="/locations" className="block px-4 py-2 hover:bg-gray-100 text-gray-700">Locations</Link> */}
              </div>
            )}
          </div>

          {/* Services We Offer Dropdown */}
          <div
            className="relative group"
            onMouseEnter={() => setHoveredDropdown("services")}
            onMouseLeave={() => setHoveredDropdown(null)}
          >
            <Link
              href="/services"
              className="flex items-center gap-1 text-gray-700 hover:text-[#8B1C1C] font-medium"
            >
              Services We Offer <FaChevronDown className="text-xs mt-1" />
            </Link>
            {hoveredDropdown === "services" && (
              <div
                className="fixed left-auto bg-white shadow rounded z-50 min-w-[220px]"
                style={{
                  top: getNavBottom(),
                  left: navRef.current
                    ? navRef.current.querySelectorAll("a")[2]?.getBoundingClientRect().left
                    : 350,
                }}
              >
                {/* <Link href="/services" className="block px-4 py-2 hover:bg-gray-100 text-gray-700">List of Services</Link> */}
                <Link href="/Featured" className="block px-4 py-2 hover:bg-gray-100 text-gray-700">Featured Projects</Link>
                <Link href="/order-process" className="block px-4 py-2 hover:bg-gray-100 text-gray-700">Delivery & Ordering Process</Link>
              </div>
            )}
          </div>

          {/* Products Dropdown */}
          <div
            className="relative group"
            onMouseEnter={() => setHoveredDropdown("products")}
            onMouseLeave={() => setHoveredDropdown(null)}
          >
            <Link
              href="/Product"
              className="flex items-center gap-1 text-gray-700 hover:text-[#8B1C1C] font-medium"
            >
              Products <FaChevronDown className="text-xs mt-1" />
            </Link>
            {hoveredDropdown === "products" && (
              <div
                className="fixed left-auto bg-white shadow rounded z-50 min-w-[200px]"
                style={{
                  top: getNavBottom(),
                  left: navRef.current
                    ? navRef.current.querySelectorAll("a")[3]?.getBoundingClientRect().left
                    : 500,
                }}
              >
                <Link href="/products/doors" className="block px-4 py-2 hover:bg-gray-100 text-gray-700">Doors</Link>
                <Link href="/products/enclosures" className="block px-4 py-2 hover:bg-gray-100 text-gray-700">Enclosures</Link>
                <Link href="/products/windows" className="block px-4 py-2 hover:bg-gray-100 text-gray-700">Windows</Link>
                <Link href="/products/railings" className="block px-4 py-2 hover:bg-gray-100 text-gray-700">Railings</Link>
                <Link href="/products/canopy" className="block px-4 py-2 hover:bg-gray-100 text-gray-700">Canopy</Link>
                <Link href="/products/curtain-wall" className="block px-4 py-2 hover:bg-gray-100 text-gray-700">Curtain Wall</Link>
              </div>
            )}
          </div>

          <Link href="/FAQs" className="text-gray-700 hover:text-[#8B1C1C] font-medium">FAQs</Link>
        </nav>
        
        <div className="flex items-center gap-4">
          <Link href="/Inquire">
          <button className="bg-[#8B1C1C] text-white px-4 py-2 rounded font-semibold hover:bg-[#a83232] transition">
            INQUIRE NOW
          </button>
          </Link>
          <div className="relative" ref={dropdownRef}>
            <div
              className="flex items-center gap-2 cursor-pointer group"
              onMouseEnter={() => setOpen(true)}
              onClick={() => setOpen((prev) => !prev)}
            >
              {user?.user_metadata?.avatar_url ? (
                <Image
                  src={user.user_metadata.avatar_url}
                  alt="Profile"
                  width={40}
                  height={40}
                  className="rounded-full border border-gray-300 group-hover:border-[#8B1C1C] transition"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-700 group-hover:text-[#8B1C1C] border border-gray-300 group-hover:border-[#8B1C1C] transition">
                  {user?.email ? user.email[0].toUpperCase() : <FaUserCircle />}
                </div>
              )}
              {user?.email && (
                <span className="text-sm font-medium text-gray-700 group-hover:text-[#8B1C1C] transition">{user.email}</span>
              )}
            </div>
            {open && (
              <div
                className="absolute right-0 mt-2 w-40 bg-white rounded shadow-lg border z-50"
                onMouseLeave={() => setOpen(false)}
              >
                <button
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-800"
                  onClick={() => {
                    setOpen(false);
                    router.push("/profile");
                  }}
                >
                  Profile
                </button>
                <button
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-800"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            )}
            {showConfirm && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
                <div className="bg-white rounded-lg shadow-lg p-6 w-80">
                  <h3 className="text-black font-semibold mb-4">Confirm Logout</h3>
                  <p className="mb-6 text-gray-700">Are you sure you want to logout?</p>
                  <div className="flex justify-end gap-3">
                    <button
                      className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300"
                      onClick={() => setShowConfirm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                      onClick={confirmLogout}
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      {/* Contact Bar */}
      <div className="w-full bg-[#232d3b] text-white flex flex-col sm:flex-row items-center justify-center gap-4 py-2 px-2 text-xs sm:text-sm z-10">
        <div className="flex items-center gap-1">
          <FaEnvelope className="text-base" /> grandeast.org@gmail.com
        </div>
        <span className="hidden sm:inline">|</span>
        <div className="flex items-center gap-1">
          <FaThumbsUp className="text-base" /> Click here visit to our FB Page
        </div>
        <span className="hidden sm:inline">|</span>
        <div className="flex items-center gap-1">
          <FaPhone className="text-base" /> Smart || 09082810586 Globe (Viber) || 09277640475
        </div>
      </div>
    </>
  );
}