import React from "react";
import Image from "next/image";
import { FaEnvelope, FaThumbsUp, FaPhone, FaUserCircle } from "react-icons/fa";
import Link from "next/link";

export default function TopNavBarLoggedIn() {
  return (
    <>
      {/* Main Navigation */}
      <header className="w-full bg-white flex flex-col sm:flex-row items-center justify-between px-4 py-2 shadow z-10">
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="Grand East Logo" width={48} height={48} />
          <div className="font-bold text-lg text-gray-800 leading-tight">
            GRAND EAST{" "}
            <span className="block text-xs font-normal text-gray-500">
              GLASS AND ALUMINUM
            </span>
          </div>
        </div>
        <nav className="flex-1 flex justify-center items-center gap-8 ml-8">
          <Link href="/home" className="text-gray-700 hover:text-[#8B1C1C] font-medium">Home</Link>
          <Link href="/about-us" className="text-gray-700 hover:text-[#8B1C1C] font-medium">About Us</Link>
          <Link href="/services" className="text-gray-700 hover:text-[#8B1C1C] font-medium">Services We Offer</Link>
          <Link href="/products" className="text-gray-700 hover:text-[#8B1C1C] font-medium">Products</Link>
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