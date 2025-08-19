// app/page.tsx
import Image from "next/image";
import Link from "next/link";
import { sql } from "@vercel/postgres";
import useEmblaCarousel from "embla-carousel-react";
import { useEffect, useState } from "react";

export const dynamic = "force-static";

export default async function HomePage() {
  //for dynamic images database
    const { rows: slides } = await sql`
    SELECT id, title, image_url, link_url
    FROM sliders
    ORDER BY created_at DESC
    LIMIT 5
  `;


  return (
    <main className="flex flex-col items-center justify-center">
      {/* Hero Section */}
      
       <HeroSlider slides={slides} />

      {/* Product Categories */}
      <section className="max-w-screen-xl mx-auto py-8">
        <ProductCategory
          title="Newest Products"
          identifier="newest"
          items={["GE 103", "GE 79", "GE 116"]}
        />
        <ProductCategory
          title="Most Viewed"
          identifier="most-viewed"
          items={["GE 120", "GE 77", "GE 08"]}
        />
        <ProductCategory
          title="Most Purchased"
          identifier="most-purchased"
          items={["Shower Enclosure", "GE 79", "Modish 180"]}
        />
      </section>

      {/* Explore Section */}
      <ExploreSection />

      {/* Featured Projects */}
      <FeaturedProjects />

      {/* Services */}
      <ServicesSection />

      {/* About */}
      <AboutSection />

     
    </main>
  );
}


// Slider Component
function HeroSlider({ slides }: { slides: any[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    });
  }, [emblaApi]);

  // Manual autoplay implementation
  useEffect(() => {
    if (!emblaApi) return;
    const interval = setInterval(() => {
      emblaApi.scrollNext();
    }, 4000); // Change slide every 4 seconds
    return () => clearInterval(interval);
  }, [emblaApi]);

  return (
    <div className="relative w-full h-[500px] overflow-hidden">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="flex-[0_0_100%] relative h-[500px]"
            >
              <Image
                src={slide.image_url}
                alt={slide.title}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white text-center px-4">
                <h2 className="text-3xl md:text-5xl font-bold mb-4">
                  {slide.title}
                </h2>
                {slide.link_url && (
                  <Link
                    href={slide.link_url}
                    className="bg-red-600 px-6 py-3 rounded text-lg font-semibold hover:bg-red-700 transition"
                  >
                    Learn More
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => emblaApi?.scrollTo(idx)}
            className={`w-3 h-3 rounded-full ${
              idx === selectedIndex ? "bg-white" : "bg-gray-400"
            }`}
          ></button>
        ))}
      </div>
    </div>
  );
}


function ProductCategory({ title, identifier, items }: { title: string; identifier: string; items: string[] }) {
  return (
    <div className="mb-8" id={identifier}>
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <div className="grid grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item} className="border shadow p-4">
            <div className="h-40 bg-gray-200 flex items-center justify-center">
              {/* Image placeholder */}
              <span className="text-gray-500">Image</span>
            </div>
            <h3 className="mt-2 font-semibold text-center">{item}</h3>
            <button className="mt-2 bg-red-600 text-white px-3 py-1 rounded w-full">View Now</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExploreSection() {
  const categories = ["Aluminum", "Glass", "Cabinets"];
  return (
    <section className="w-full bg-gray-100 py-8">
      <div className="max-w-screen-xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Explore Our Products</h2>
        <div className="grid grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div key={cat} className="bg-white shadow p-4">
              <div className="h-32 bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500">Image</span>
              </div>
              <h3 className="font-semibold text-lg mt-2">{cat}</h3>
              <button className="mt-2 bg-red-600 text-white px-3 py-1 rounded">View More</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedProjects() {
  return (
    <section className="w-full bg-slate-800 text-white py-8">
      <div className="max-w-screen-xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Featured Projects</h2>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((proj) => (
            <div key={proj} className="bg-slate-700 p-4">
              <div className="h-32 bg-gray-500 flex items-center justify-center mb-2">
                <span className="text-gray-300">Image</span>
              </div>
              <h3 className="text-lg font-semibold">Project {proj}</h3>
              <p className="text-sm mt-2">Description or testimonial goes here...</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ServicesSection() {
  return (
    <section className="w-full py-12 bg-white border-t relative">
      <div className="max-w-screen-xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 px-4 relative">

        {/* Vertical divider line (gray and thicker) */}
        <div className="hidden md:block absolute top-0 bottom-0 left-1/2 w-1 bg-gray-300 z-10"></div>

        {/* Horizontal divider line (gray and thicker) */}
        <div className="absolute left-0 right-0 top-1/2 h-1 bg-gray-300 z-10"></div>

        {/* Upper Left Quadrant - Image Gallery */}
        <div className="order-1 md:order-1 relative z-20 pr-4 pb-4"> {/* Padding to avoid touching the center lines */}
          <div className="grid grid-cols-4 gap-2">
           <div className="col-span-4 flex justify-center">
            <div className="w-full max-w-md aspect-[16/9] bg-gray-300 flex items-center justify-center">
              <span className="text-gray-500">Main Image</span>
            </div>
          </div>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-video bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-sm">Image {i}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upper Right Quadrant - Services Text */}
        <div className="order-2 md:order-2 flex flex-col justify-center relative z-20 pl-4 pb-4">
          <h2 className="text-3xl font-bold mb-4">Service <br />We Offer</h2>
          <p className="text-gray-700 mb-6">
            Grand East brings you top-tier aluminum and glass solutions, expertly crafted for both residential and commercial spaces. From sleek windows and doors to stunning facades, our services are designed to enhance both style and durability. Elevate your property with the perfect blend of innovation and elegance.
          </p>
          <button className="border border-black px-4 py-2 font-medium hover:bg-gray-100 transition w-fit">
            Know More about Our Service
          </button>
        </div>

        {/* Lower Left Quadrant - About Grand East */}
        <div className="order-4 md:order-3 bg-slate-800 text-white p-6 mt-4 relative z-20 pr-4 pt-4">
          <h3 className="text-2xl font-bold mb-2">ABOUT <br />GRAND EAST</h3>
          <div className="h-1 w-12 bg-red-600 mb-4"></div>
          <p className="text-sm mb-4 leading-relaxed">
            At Grand East, we specialize in creating modern, durable, and stylish solutions that redefine residential and commercial spaces. With a passion for precision and a commitment to quality, our expert team delivers exceptional aluminum and glass installations that stand the test of time. Whether you're upgrading your home or transforming your business, we provide innovative designs that combine functionality with aesthetic appeal, ensuring your vision becomes a reality.
          </p>
          <button className="bg-red-600 text-white px-4 py-2 font-semibold hover:bg-red-700 transition">
            VIEW MORE
          </button>
        </div>

        {/* Lower Right Quadrant - Logo Placeholder */}
        <div className="order-3 md:order-4 flex items-center justify-center relative z-20 pl-4 pt-4">
          <div className="w-full h-48 border bg-gray-100 flex items-center justify-center">
            <span className="text-gray-400 text-lg">LOGO IMAGE</span>
          </div>
        </div>
      </div>
    </section>
  );
}



function AboutSection() {
  return (
    <section className="w-full bg-gray-200 py-8">
      <div className="max-w-screen-xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">ABOUT GRAND EAST</h2>
        <p>We are specialists in quality aluminum and glass fabrication...</p>
      </div>
    </section>
  );
}


