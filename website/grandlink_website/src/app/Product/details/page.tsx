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

      // normalize additionalfeatures: accept string or string[]; fall back to features[]
      const additionalfeatures = Array.isArray(data?.additionalfeatures)
        ? data.additionalfeatures.join("\n")
        : (data?.additionalfeatures ?? (data?.features?.length ? data.features.join("\n") : ""));

      setProduct({ ...data, additionalfeatures });
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
            <h2 className="text-4xl font-bold text-black">{product.name}</h2>

            {/* Full product name below main name */}
            {product.fullproductname ? (
              <div className="text-2xl text-gray-600 mt-1">{product.fullproductname}</div>
            ) : null}

            <h3 className="text-2xl font-semibold text-gray-600 mt-2">{product.subtitle || product.series}</h3>

            {/* description moved to Key Features section */}
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
            {/* Labeled description placed at top of Key Features */}
            <div className="mb-6">
              <label className="block text-lg font-semibold text-gray-700 mb-2">Product Description</label>
              <p className="text-gray-800 text-sm md:text-base leading-relaxed">
                {product.description}
              </p>
            </div>

            <h4 className="text-red-700 font-bold mb-4 text-xl">Key Features</h4>

            {/* Dimensions & Material summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-3 rounded border flex flex-col items-center justify-center text-center">
                <div className="text-sm text-gray-500">Height</div>
                <div className="text-lg font-semibold text-gray-500">{product.height ?? "—"}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded border flex flex-col items-center justify-center text-center">
                <div className="text-sm text-gray-500">Width</div>
                <div className="text-lg font-semibold text-gray-500">{product.width ?? "—"}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded border flex flex-col items-center justify-center text-center">
                <div className="text-sm text-gray-500">Thickness</div>
                <div className="text-lg font-semibold text-gray-500">{product.thickness ?? "—"}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded border flex flex-col items-center justify-center text-center">
                <div className="text-sm text-gray-500">Material</div>
                <div className="text-lg font-semibold text-gray-500">{product.material ?? "Wood"}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded border col-span-2 sm:col-span-1 flex flex-col items-center justify-center text-center">
                <div className="text-sm text-gray-500">Type</div>
                <div className="text-lg font-semibold text-gray-500">{product.type ?? "Clear"}</div>
              </div>
            </div>

            {/* Feature list - replaced with additionalfeatures column */}
            <div className="mt-2">
              <h5 className="text-lg font-semibold text-red-700 mb-2">Additional Features</h5>
              <div className="text-lg text-gray-700 whitespace-pre-line">
                {product.additionalfeatures
                  ?? (product.features?.length ? product.features.join("\n") : "")
                }
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />

      {/* 3D Viewer Modal */}
      {show3D && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-6xl max-h-[90vh] bg-white rounded-lg shadow-lg p-4 relative flex flex-col">
            <button
              className="absolute top-3 right-3 text-gray-600 hover:text-gray-900 text-2xl z-20"
              onClick={() => setShow3D(false)}
              aria-label="Close 3D viewer"
            >
              &times;
            </button>

            {/* make viewer fill the modal and center content */}
            <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
              <ThreeDFBXViewer fbxUrl={product.fbx_url} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}