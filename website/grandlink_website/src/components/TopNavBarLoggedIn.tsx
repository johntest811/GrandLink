"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { FaEnvelope, FaThumbsUp, FaPhone, FaUserCircle, FaChevronDown } from "react-icons/fa";
import Link from "next/link";

export default function TopNavBarLoggedIn() {
  const [hoveredDropdown, setHoveredDropdown] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Helper to get nav bar bottom position for dropdown
  const getNavBottom = () => {
    if (navRef.current) {
      const rect = navRef.current.getBoundingClientRect();
      return rect.bottom;
    }
    return 60; // fallback
  };

  return (
    <>
      {/* Main Navigation */}
      <header className="w-full bg-white flex flex-col sm:flex-row items-center justify-between px-4 py-2 shadow z-20 relative">
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="Grand East Logo" width={48} height={48} />
          <div className="font-bold text-lg text-gray-800 leading-tight">
            GRAND EAST{" "}
            <span className="block text-xs font-normal text-gray-500">
              GLASS AND ALUMINUM
            </span>
          </div>
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
                <Link href="/locations" className="block px-4 py-2 hover:bg-gray-100 text-gray-700">Locations</Link>
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
                <Link href="/projects" className="block px-4 py-2 hover:bg-gray-100 text-gray-700">Featured Projects</Link>
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
          <button className="bg-[#8B1C1C] text-white px-4 py-2 rounded font-semibold hover:bg-[#a83232] transition">
            INQUIRE NOW
          </button>
          <FaUserCircle className="text-3xl text-gray-700" />
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