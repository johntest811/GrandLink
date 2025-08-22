"use client";
import { useState } from "react";
import TopNavBarLoggedIn from "@/components/TopNavBarLoggedIn";
import Footer from "@/components/Footer";

export default function FAQsPage() {
  const [activeCategory, setActiveCategory] = useState(0);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // FAQ Data grouped 
  const faqData = [
    {
      category: "Product Information",
      questions: [
        {
          question: "What products does Grand East Aluminum and Glass offer?",
          answer:
            "We offer a range of products including aluminum windows, glass doors, retractable screens, types of glass, skylights, and custom aluminum and glass solutions tailored to meet your needs.",
        },
        {
          question: "What types of glass do you offer?",
          answer:
            "We provide various types of glass including tempered, frosted, insulated, and low-E glass. Each type serves different purposes such as safety, energy efficiency, and sound insulation.",
        },
        {
          question: "What is the difference between tempered and laminated glass?",
          answer:
            "Tempered glass is heat-treated to increase its strength, whereas laminated glass consists of two or more glass layers bonded with a plastic interlayer for added impact resistance and soundproofing.",
        },
      ],
    },
    {
      category: "Installation and Services",
      questions: [
        {
          question: "Do you provide installation services?",
          answer:
            "Yes, we provide professional installation for all our products to ensure proper fit, safety, and long-term durability.",
        },
        {
          question: "How long does installation usually take?",
          answer:
            "Installation times vary depending on the size and type of product, but most standard installations are completed within 1–2 days.",
        },
      ],
    },
    {
      category: "Customization and Eco-Friendly Options",
      questions: [
        {
          question: "Can I customize the design of windows and doors?",
          answer:
            "Yes, we offer full customization for size, style, frame colors, and glass type to suit your home or business requirements.",
        },
        {
          question: "Are your products eco-friendly?",
          answer:
            "Our aluminum frames are recyclable, and we also offer energy-efficient glass options that help reduce electricity costs.",
        },
      ],
    },
    {
      category: "Benefits and Features",
      questions: [
        {
          question: "What are the benefits of aluminum frames over wood or steel?",
          answer:
            "Aluminum frames are lightweight, durable, rust-resistant, and require minimal maintenance compared to wood or steel.",
        },
        {
          question: "Do your products provide soundproofing?",
          answer:
            "Yes, our insulated and laminated glass options significantly reduce outside noise for a more peaceful indoor environment.",
        },
      ],
    },
    {
      category: "Process and Timelines",
      questions: [
        {
          question: "How do I place an order?",
          answer:
            "You can contact us through our website, email, or by phone. A sales representative will assist you with product selection and quotations.",
        },
        {
          question: "What is the typical lead time for delivery?",
          answer:
            "Lead times vary depending on customization, but most standard products are delivered within 2–4 weeks.",
        },
      ],
    },
    {
      category: "Warranty and Maintenance",
      questions: [
        {
          question: "Do your products come with a warranty?",
          answer:
            "Yes, all our products come with a manufacturer’s warranty covering defects in materials and workmanship.",
        },
        {
          question: "How should I maintain aluminum and glass products?",
          answer:
            "Maintenance is simple: regularly clean the glass with mild soap and water, and occasionally wipe down aluminum frames with a damp cloth.",
        },
      ],
    },
    {
      category: "Product-Specific FAQs",
      questions: [
        {
          question: "What makes your retractable screens unique?",
          answer:
            "Our retractable screens are designed to be sleek, durable, and easy to use, while providing ventilation and insect protection.",
        },
        {
          question: "Do you offer skylight installation?",
          answer:
            "Yes, we provide both fixed and vented skylights that allow natural light to brighten up your space.",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <TopNavBarLoggedIn />
      <main className="flex-1 bg-white">
        {/* Hero Section */}
        <section
          className="relative h-72 flex items-center justify-center text-center"
          style={{
            backgroundImage: "url('/images/.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="bg-white bg-opacity-90 px-8 py-4 rounded-md shadow-md">
            <h1 className="text-3xl font-bold">FAQs</h1>
            <p className="text-gray-600">
              Got questions about Grand East’s services? Find quick answers to
              some of the most common inquiries we receive.
            </p>
          </div>
        </section>

        {/* FAQs Section */}
        <section className="bg-[#0a223d] py-12">
          <div className="bg-white max-w-3xl mx-auto p-8 shadow-lg rounded-md">
            <h2 className="text-2xl font-bold text-center mb-8">
              Frequently Asked Questions
            </h2>

            {/* Tabs */}
            <div className="flex flex-wrap gap-4 justify-center mb-8 text-sm font-medium">
              {faqData.map((cat, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setActiveCategory(idx);
                    setOpenIndex(null);
                  }}
                  className={`${
                    activeCategory === idx
                      ? "text-red-600 border-b-2 border-red-600"
                      : "text-gray-600"
                  } hover:text-red-600 transition`}
                >
                  {cat.category}
                </button>
              ))}
            </div>

            {/* Accordion */}
            <div className="space-y-4">
              {faqData[activeCategory].questions.map((faq, idx) => (
                <div key={idx} className="border-b pb-2">
                  <button
                    className="w-full text-left flex justify-between items-center font-bold text-gray-800"
                    onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
                  >
                    {faq.question}
                    <span className="text-red-600">
                      {openIndex === idx ? "−" : "+"}
                    </span>
                  </button>
                  {openIndex === idx && (
                    <p className="mt-2 text-gray-600 text-sm">{faq.answer}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
