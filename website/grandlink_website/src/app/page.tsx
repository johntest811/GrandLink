import { FaEnvelope, FaLock, FaUser } from "react-icons/fa";
import Image from "next/image";
import TopNavBarLoggedIn from "@/components/TopNavBarLoggedIn";
import Footer from "@/components/Footer";

export default function RegisterPage() {
  return (
    <div
      className="relative min-h-screen font-sans bg-cover bg-center flex flex-col"
      style={{ backgroundImage: 'url("/background-login.jpg")' }}
    >
      <TopNavBarLoggedIn />
      
      <main className="flex-1 flex flex-col items-center justify-center bg-cover bg-center">
        
      
        <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-lg">
          Welcome to Grand East Glass and Aluminum
        </h1>
        <p className="text-lg text-white drop-shadow-lg mb-8 text-center max-w-xl">
          We provide top-quality glass and aluminum products and services for your
          home and business needs.
        </p>
        {/* Add more static content or components here as needed */}
      </main>
      <Footer />
    </div>
  );
}
