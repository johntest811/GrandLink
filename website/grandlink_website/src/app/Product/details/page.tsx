"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import TopNavBarLoggedIn from "@/components/TopNavBarLoggedIn";
import Footer from "@/components/Footer";
import dynamic from "next/dynamic";

const ThreeDFBXViewer = dynamic(() => import("./ThreeDFBXViewer"), { ssr: false });

export default function ProductDetailsPage() {
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");
  const [product, setProduct] = useState<any>(null);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [show3D, setShow3D] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) return;
      const res = await fetch(`/api/products?id=${productId}`);
      const data = await res.json();
      setProduct(data);
    };
    fetchProduct();
  }, [productId]);

  if (!product) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const images: string[] = product.images?.length
    ? product.images
    : [product.image1, product.image2, product.image3, product.image4, product.image5].filter(Boolean);

  const handlePrev = () => setCarouselIdx((idx) => (idx === 0 ? images.length - 1 : idx - 1));
  const handleNext = () => setCarouselIdx((idx) => (idx === images.length - 1 ? 0 : idx + 1));

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <TopNavBarLoggedIn />
      <div className="flex-1 flex flex-col items-center py-10 bg-white">
        <div className="w-full max-w-4xl xl:max-w-6xl bg-white rounded shadow p-12">
          {/* Carousel */}
          <div className="relative flex flex-col items-center">
            <Image
              src={images[carouselIdx] || "https://placehold.co/800x500?text=No+Image"}
              alt={product.name}
              width={1200}
              height={700}
              className="w-full h-[36rem] object-cover rounded"
            />
            {/* Transparent Arrow Buttons */}
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 text-black hover:text-red-600 px-2 py-2 rounded-full transition flex items-center justify-center"
              style={{ background: "none", zIndex: 2 }}
              onClick={handlePrev}
              aria-label="Previous"
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path d="M24 14L18 20L24 26" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-black hover:text-red-600 px-2 py-2 rounded-full transition flex items-center justify-center"
              style={{ background: "none", zIndex: 2 }}
              onClick={handleNext}
              aria-label="Next"
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path d="M16 14L22 20L16 26" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {/* Thumbnails */}
            <div className="flex gap-2 mt-4 justify-center">
              {images.map((img, idx) => (
                <Image
                  key={idx}
                  src={img}
                  alt={`Thumbnail ${idx + 1}`}
                  width={90}
                  height={90}
                  className={`rounded border cursor-pointer ${carouselIdx === idx ? "border-red-600" : "border-gray-300"}`}
                  onClick={() => setCarouselIdx(idx)}
                />
              ))}
            </div>
          </div>
          {/* Product Info */}
          <div className="mt-10">
            <h2 className="text-4xl font-bold">{product.name}</h2>
            <h3 className="text-2xl font-semibold text-gray-600">{product.subtitle || product.series}</h3>
            <p className="text-gray-700 text-lg mt-4">{product.description}</p>
          </div>
          {/* Actions */}
          <div className="flex gap-8 mt-10">
            <button
              disabled={!product.fbx_url}
              onClick={() => setShow3D(true)}
              className={`flex flex-col items-center px-6 py-4 rounded border ${product.fbx_url ? "bg-black text-white" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}
              title="View 3D"
            >
              <span className="font-bold text-base">3D</span>
              <span className="text-base">3D View</span>
            </button>
            <button className="flex flex-col items-center px-6 py-4 rounded border bg-gray-100 text-gray-700">
              <span className="font-bold text-base">♥</span>
              <span className="text-base">Add to Wishlist</span>
            </button>
            <button className="bg-red-600 text-white px-8 py-4 rounded font-semibold text-xl">Reserve Now</button>
          </div>
          {/* Key Features */}
          <div className="mt-12 border-t pt-8">
            <h4 className="text-red-700 font-bold mb-4 text-xl">Key Features</h4>
            <ul className="text-lg text-gray-700 list-disc pl-8">
              {product.features?.length
                ? product.features.map((f: string, i: number) => <li key={i}>{f}</li>)
                : (
                  <>
                    <li><b>Single pane (5-10mm):</b> Optimal for natural light and ventilation.</li>
                    <li><b>Double pane (5-6mm):</b> Enhanced energy efficiency and sound insulation.</li>
                    <li><b>French option (7×15, 5-6mm):</b> Adds a unique, stylish touch.</li>
                    <li><b>3-track design:</b> Allows maximum airflow.</li>
                    <li><b>Sliding with fixed panel:</b> Functional with a modern aesthetic.</li>
                    <li><b>Wall Allowance:</b> 11mm</li>
                    <li><b>Aluminum Thickness:</b> 1.1mm</li>
                    <li><b>Optional screen:</b> Customizable for your preference.</li>
                  </>
                )
              }
            </ul>
          </div>
        </div>
      </div>
      <Footer />

      {/* 3D Viewer Modal */}
      {show3D && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-2xl"
              onClick={() => setShow3D(false)}
            >
              &times;
            </button>
            <ThreeDFBXViewer fbxUrl={product.fbx_url} width={1200} height={700} />
          </div>
        </div>
      )}
    </div>
  );
}