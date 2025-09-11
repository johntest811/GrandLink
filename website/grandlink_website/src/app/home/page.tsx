"use client";

import Link from "next/link";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import TopNavBarLoggedIn from "@/components/TopNavBarLoggedIn";
import Footer from "@/components/Footer";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function HomePage() {

 const [homeData, setHomeData] = useState<any>(null);


useEffect(() => {
    fetchHomeData();
  }, []);

  const fetchHomeData = async () => {
    const { data, error } = await supabase.from("home").select("*").single();
    if (error) console.error(error);
    else setHomeData(data);
  };

  if (!homeData) return <div>Loading...</div>;

  // Parse JSON arrays for slider, services, and featured projects
  const slides = JSON.parse(homeData.explore || "[]");
  const services = JSON.parse(homeData.service_offer || "[]");
  const featuredProjects = JSON.parse(homeData.featured || "[]");

  return (
    <div className="min-h-screen flex flex-col">
      <TopNavBarLoggedIn />
      <main className="flex flex-col items-center justify-center flex-1 w-full">
        {/* Hero Slider */}
        <HeroSlider slides={slides} />

        {/* Services */}
        <ServicesSection services={services} />

        {/* Featured Projects */}
        <FeaturedProjects projects={featuredProjects} />

        {/* About Section */}
        <AboutSection about={homeData.about} />
      </main>
      <Footer />
    </div>
  );
}

/* ===================== Hero Slider ===================== */
function HeroSlider({ slides }: { slides: any[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    });
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const interval = setInterval(() => emblaApi.scrollNext(), 4000);
    return () => clearInterval(interval);
  }, [emblaApi]);

  // Static slides data (replace with your own images and links)
  // const slides = [
  //   {
  //     id: 1,
  //     title: "Welcome to Grand East",
  //     image_url: "/slider1.jpg",
  //     link_url: "/about-us",
  //   },
  //   {
  //     id: 2,
  //     title: "Quality Aluminum & Glass",
  //     image_url: "/slider2.jpg",
  //     link_url: "/products",
  //   },
  //   {
  //     id: 3,
  //     title: "Modern Designs",
  //     image_url: "/slider3.jpg",
  //     link_url: "/services",
  //   },
  // ];

   return (
    <div className="relative w-full h-[500px] overflow-hidden">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((slide, idx) => (
            <div key={idx} className="flex-[0_0_100%] relative h-[500px]">
              <Image src={slide.image_url} alt={slide.title} fill className="object-cover" />
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white text-center px-4">
                <h2 className="text-3xl md:text-5xl font-bold mb-4">{slide.title}</h2>
                {slide.link_url && (
                  <Link href={slide.link_url} className="bg-red-600 px-6 py-3 rounded text-lg font-semibold hover:bg-red-700 transition">
                    Learn More
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => emblaApi?.scrollTo(idx)}
            className={`w-3 h-3 rounded-full ${idx === selectedIndex ? "bg-white" : "bg-gray-400"}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ===================== Services Section ===================== */
function ServicesSection({ services }: { services: any[] }) {
  return (
    <section className="w-full py-12 bg-white">
      <div className="max-w-screen-xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 px-4">
        {services.map((service) => (
          <div key={service.id} className="border p-4 shadow">
            <h3 className="text-xl font-bold mb-2">{service.name}</h3>
            <p className="text-gray-700 mb-2">{service.short_description}</p>
            <button className="bg-red-600 text-white px-3 py-1 rounded">
              View Details
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ===================== Featured Projects ===================== */
function FeaturedProjects({ projects }: { projects: any[] }) {
  return (
    <section className="w-full bg-slate-800 text-white py-8">
      <div className="max-w-screen-xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 px-4">
        {projects.map((proj) => (
          <div key={proj.id} className="bg-slate-700 p-4">
            <h3 className="text-lg font-semibold">{proj.title}</h3>
            <p className="text-sm mt-2">{proj.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ===================== About Section ===================== */
function AboutSection({ about }: { about: string }) {
  return (
    <section className="w-full bg-gray-200 py-8 text-black">
      <div className="max-w-screen-xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">ABOUT GRAND EAST</h2>
        <p>{about || "We are specialists in quality aluminum and glass fabrication..."}</p>
      </div>
    </section>
  );
}

