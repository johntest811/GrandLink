import { FaEnvelope, FaLock, FaUser } from "react-icons/fa";
import Image from "next/image";

export default function RegisterPage() {
  return (
    <div
      className="relative min-h-screen font-sans bg-cover bg-center flex flex-col"
      style={{ backgroundImage: 'url("/background-login.jpg")' }}
    >
      {/* Header */}
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
        <button className="bg-[#8B1C1C] text-white px-4 py-2 rounded font-semibold mt-2 sm:mt-0 hover:bg-[#a83232] transition">
          INQUIRE NOW
        </button>
      </header>
      {/* Contact Bar */}
      <div className="w-full bg-[#232d3b] text-white flex flex-col sm:flex-row items-center justify-center gap-4 py-2 px-2 text-xs sm:text-sm z-10">
        <div className="flex items-center gap-1">
          <span className="material-icons text-base">email</span> grandeast.org@gmail.com
        </div>
        <span className="hidden sm:inline">|</span>
        <div className="flex items-center gap-1">
          <span className="material-icons text-base">thumb_up</span> Click here visit to our FB Page
        </div>
        <span className="hidden sm:inline">|</span>
        <div className="flex items-center gap-1">
          <span className="material-icons text-base">call</span> Smart | 09082810586 Globe (Viber) | 09277640475
        </div>
   </div>
    </div>
  );
}
