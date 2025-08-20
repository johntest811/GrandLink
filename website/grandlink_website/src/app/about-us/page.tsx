"use client";

import TopNavBarLoggedIn from "@/components/TopNavBarLoggedIn";
import Footer from "@/components/Footer";
import Image from "next/image";

export default function AboutUsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNavBarLoggedIn />
      <main className="flex-1 bg-white">
        {/* Hero Section */}
        <div className="relative w-full h-56 md:h-64">
          <Image
            src="/services-hero.jpg"
            alt="About Us Hero"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 border-b-2 border-[#8B1C1C] inline-block pb-1 px-4">
              About Us
            </h1>
            <h2 className="text-lg md:text-2xl font-semibold italic text-white drop-shadow mt-2">
              High Quality, Long lasting performance
            </h2>
          </div>
        </div>

        {/* Company Info */}
        <section className="bg-white px-4 py-8 flex flex-col items-center">
          <Image
            src="/grand-east-logo.png"
            alt="Grand East Glass and Aluminum"
            width={120}
            height={60}
            className="mb-4"
          />
          <h3 className="text-xl font-bold mb-2 text-center text-black">
            GRAND EAST
            <br />
            GLASS AND ALUMINUM
          </h3>
          <p className="max-w-2xl text-center text-gray-700 mb-6">
            The Company was founded in 2015, We developed from a small team to
            today, We have gone through 8 years together. We are grateful to all
            the employees who grow with us and thank our customers for their firm
            choice. We have been focusing on the production process and product
            details, we have served more customers, we are also growing under the
            witness of communication with customers. Today, we have modern
            automated production equipment, 10,000 square meters of production
            workshop and 3,000 square meters of product storage factories.
          </p>
        </section>

        {/* Mission and Vision */}
        <section className="flex flex-col md:flex-row w-full">
          <div className="flex-1 bg-[#8B1C1C] text-white flex flex-col items-center justify-center py-16 px-8 min-h-[260px]">
            <h4 className="text-2xl font-bold mb-4 tracking-wider">MISSION</h4>
            <p className="text-center text-base max-w-lg">
              To offer cost-effective and high quality products and to be a high
              value partner for our customers. Providing exceptional support and
              services.
            </p>
          </div>
          <div className="flex-1 bg-[#232d3b] text-white flex flex-col items-center justify-center py-16 px-8 min-h-[260px]">
            <h4 className="text-2xl font-bold mb-4 tracking-wider">VISION</h4>
            <p className="text-center text-base max-w-lg">
              We aim to be the most recognized and largest Glass and Aluminum
              industry through providing quality and highly competitive designed
              products that will fulfill all customers' needs.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}