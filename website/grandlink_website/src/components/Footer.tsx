import { FaFacebookF } from "react-icons/fa";
import { FiPhone } from "react-icons/fi";

export default function Footer() {
  return (
    <footer className="bg-[#f5f5f5] pt-8">
      {/* Top Links */}
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-lg font-semibold mb-6 text-black">Quick Links</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-8">
          {/* About */}
          <div>
            <h3 className="font-bold mb-2 text-black">About Us</h3>
            <ul className="space-y-1">
              <li>
                <a href="/showroom" className="footer-link">
                  Showroom
                </a>
              </li>
              <li>
                <a href="/locations" className="footer-link">
                  Locations
                </a>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-bold mb-2 text-black">Services We Offer</h3>
            <ul className="space-y-1">
              <li>
                <a href="/services" className="footer-link">
                  List of Services
                </a>
              </li>
              <li>
                <a href="/Featured" className="footer-link">
                  Featured Projects
                </a>
              </li>
              <li>
                <a href="/order-process" className="footer-link">
                  Delivery & Order Process
                </a>
              </li>
            </ul>
          </div>

         {/* Products */}
   <div>
  <details className="group">
    <summary className="flex items-center justify-between cursor-pointer font-bold text-black mb-2 list-none">
      <span>Products</span>

      {/* Dropdown Icon */}
      <svg
        className="w-4 h-4 transition-transform group-open:rotate-180"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M19 9l-7 7-7-7" />
      </svg>
    </summary>

    <ul className="mt-2 space-y-1 pl-1">
      <li><a href="/Product" className="footer-link">All Products</a></li>
      <li><a href="/Product?category=Doors" className="footer-link">Doors</a></li>
      <li><a href="/Product?category=Windows" className="footer-link">Windows</a></li>
      <li><a href="/Product?category=Enclosure" className="footer-link">Enclosure</a></li>
      <li><a href="/Product?category=Casement" className="footer-link">Casement</a></li>
      <li><a href="/Product?category=Sliding" className="footer-link">Sliding</a></li>
      <li><a href="/Product?category=Railings" className="footer-link">Railings</a></li>
      <li><a href="/Product?category=Canopy" className="footer-link">Canopy</a></li>
      <li><a href="/Product?category=Curtain Wall" className="footer-link">Curtain Wall</a></li>
    </ul>
  </details>
</div>

          {/* FAQs */}
          <div>
            <h3 className="font-bold mb-2 text-black">FAQs</h3>
            <ul className="space-y-1">
              <li>
                <a href="/FAQs" className="footer-link">
                  FAQs
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Contact Bar */}
      <div className="bg-[#232d3b] py-4 px-4 flex flex-col md:flex-row items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Facebook */}
          <a
            href="https://www.facebook.com/grandeast.aluminum/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Grand East Facebook"
          >
            <FaFacebookF className="text-white text-2xl bg-[#4267B2] rounded p-1 w-8 h-8 hover:opacity-80 transition" />
          </a>

          {/* Phone */}
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white">
            <FiPhone className="text-[#232d3b] text-2xl" />
          </span>

          <span className="text-white text-sm md:text-lg">
            Smart | 0908 281 0586 • Globe (Viber) | 0927 764 0475
          </span>
        </div>

        <div className="mt-4 md:mt-0">
          <a
            href="/Inquire"
            className="bg-[#8B1C1C] text-white px-8 py-2 rounded font-semibold hover:bg-[#a83232] transition text-sm"
          >
            INQUIRE NOW
          </a>
        </div>
      </div>

      {/* Copyright */}
      <div className="bg-[#1c2430] text-center py-3 px-4">
        <p className="text-gray-400 text-sm">
          © {new Date().getFullYear()} Grand East Aluminum. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
