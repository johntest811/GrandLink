import Image from "next/image";

export default function AboutUsPage() {
  return (
    <div className="min-h-screen font-sans bg-white flex flex-col">
      {/* Header */}
      <header className="w-full bg-white flex flex-col sm:flex-row items-center justify-between px-6 py-4 shadow z-10">
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="Grand East Logo" width={48} height={48} />
          <div className="font-bold text-lg text-gray-800 leading-tight">
            GRAND EAST{" "}
            <span className="block text-xs font-normal text-gray-500">
              GLASS AND ALUMINUM
            </span>
          </div>
        </div>
        <nav className="flex gap-6 items-center mt-4 sm:mt-0">
          <a href="/" className="text-gray-700 hover:text-[#8B1C1C] font-medium">Home</a>
          <a href="/about-us" className="text-[#8B1C1C] font-semibold border-b-2 border-[#8B1C1C]">About Us</a>
          <a href="/services" className="text-gray-700 hover:text-[#8B1C1C] font-medium">Services We Offer</a>
          <a href="/products" className="text-gray-700 hover:text-[#8B1C1C] font-medium">Products</a>
          <a href="/faqs" className="text-gray-700 hover:text-[#8B1C1C] font-medium">FAQs</a>
          <button className="bg-[#8B1C1C] text-white px-4 py-2 rounded font-semibold ml-2 hover:bg-[#a83232] transition">INQUIRE NOW</button>
          <div className="ml-2">
            <span className="material-icons text-3xl text-gray-600">account_circle</span>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative w-full h-64 sm:h-80 flex items-center justify-center bg-cover bg-center" style={{ backgroundImage: 'url("/background-login.jpg")' }}>
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="relative z-10 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">About Us</h2>
          <p className="text-xl sm:text-2xl text-white font-semibold">High Quality, Long lasting performance</p>
        </div>
      </section>

      {/* About Content */}
      <section className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg px-6 py-8 mt-[-60px] z-20 relative">
        <div className="flex flex-col items-center">
          <Image src="/logo.svg" alt="Grand East Logo" width={80} height={80} className="mb-4" />
          <p className="text-center text-gray-700 text-base sm:text-lg">
            The Company was founded in 2015. We developed from a small team to today. We have gone through 8 years together. We are grateful to all the employees who grow with us and thank our customers for their firm choice. We have been focusing on the production process and product details, we have served more customers, we are also growing under the witness of communication with customers. Today, we have modern automated production equipment, 10,000 square meters of production workshop and 3,000 square meters of product storage factories.
          </p>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="flex flex-col sm:flex-row gap-4 max-w-4xl mx-auto mt-8">
        <div className="flex-1 bg-[#8B1C1C] text-white rounded-lg p-6 shadow">
          <h3 className="text-xl font-bold mb-2">MISSION</h3>
          <p className="text-base">
            To offer affordable and high quality products to be the top customer choice in the industry. Provide exceptional support and exceed expectations.
          </p>
        </div>
        <div className="flex-1 bg-[#232d3b] text-white rounded-lg p-6 shadow">
          <h3 className="text-xl font-bold mb-2">VISION</h3>
          <p className="text-base">
            We aim to be the most recognized and trusted Glass and Aluminum company through delivering high quality and innovative design products that can fulfill all customers’ needs.
          </p>
        </div>
      </section>

      {/* Quick Links Footer */}
      <footer className="bg-white border-t mt-12 py-6 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-4 gap-6 text-xs text-gray-700">
          <div>
            <div className="font-bold mb-2">Quick Links</div>
            <div>About Us</div>
            <div>Showrooms</div>
            <div>Locations</div>
          </div>
          <div>
            <div className="font-bold mb-2">Services We Offer</div>
            <div>List of Services</div>
            <div>Featured Projects</div>
            <div>Delivery & Order Process</div>
          </div>
          <div>
            <div className="font-bold mb-2">Products</div>
            <div>Doors</div>
            <div>Windows</div>
            <div>Railings</div>
            <div>Canopy</div>
            <div>Curtain Wall</div>
          </div>
          <div>
            <div className="font-bold mb-2">FAQs</div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between mt-6 text-xs text-gray-600">
          <div>
            Smart | 09082810586 Globe (Viber) | 09277640475
          </div>
          <button className="bg-[#8B1C1C] text-white px-4 py-2 rounded font-semibold mt-2 sm:mt-0 hover:bg-[#a83232] transition">INQUIRE NOW</button>
        </div>
      </footer>
    </div>
  )
}