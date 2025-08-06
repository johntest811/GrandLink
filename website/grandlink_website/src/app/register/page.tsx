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
      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="bg-white/95 rounded-xl shadow-lg px-8 py-10 w-full max-w-md flex flex-col items-center relative z-10 mt-12 mb-12">
          {/* Added mt-12 for top space and mb-12 for bottom space */}
          <h1 className="text-3xl font-bold text-center mb-6 text-[#8B1C1C]">Register</h1>
          <form className="w-full flex flex-col gap-4">
            <div>
              <label className="font-semibold text-sm mb-1 block" htmlFor="name">
                Full Name
              </label>
              <div className="flex items-center border border-gray-400 rounded-lg px-3 py-2 bg-gray-100">
                <FaUser className="text-gray-500 mr-2" />
                <input
                  id="name"
                  type="text"
                  placeholder="Please Enter your Full Name"
                  className="bg-transparent outline-none flex-1 text-gray-700 placeholder-gray-400"
                  autoComplete="name"
                />
              </div>
            </div>
            <div>
              <label className="font-semibold text-sm mb-1 block" htmlFor="email">
                Gmail
              </label>
              <div className="flex items-center border border-gray-400 rounded-lg px-3 py-2 bg-gray-100">
                <FaEnvelope className="text-gray-500 mr-2" />
                <input
                  id="email"
                  type="email"
                  placeholder="Please Enter your Gmail Address"
                  className="bg-transparent outline-none flex-1 text-gray-700 placeholder-gray-400"
                  autoComplete="email"
                />
              </div>
            </div>
            <div>
              <label className="font-semibold text-sm mb-1 block" htmlFor="password">
                Password
              </label>
              <div className="flex items-center border border-gray-400 rounded-lg px-3 py-2 bg-gray-100">
                <FaLock className="text-gray-500 mr-2" />
                <input
                  id="password"
                  type="password"
                  placeholder="Please Enter your password"
                  className="bg-transparent outline-none flex-1 text-gray-700 placeholder-gray-400"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div>
              <label className="font-semibold text-sm mb-1 block" htmlFor="confirm-password">
                Confirm Password
              </label>
              <div className="flex items-center border border-gray-400 rounded-lg px-3 py-2 bg-gray-100">
                <FaLock className="text-gray-500 mr-2" />
                <input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm your password"
                  className="bg-transparent outline-none flex-1 text-gray-700 placeholder-gray-400"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <button
              type="submit"
              className="bg-[#232d3b] text-white font-semibold rounded w-full py-2 mt-2 hover:bg-[#1a222e] transition"
            >
              REGISTER
            </button>
          </form>
          <button className="flex items-center gap-2 bg-gray-100 border border-gray-300 rounded px-4 py-2 mt-4 w-full justify-center hover:bg-gray-200 transition">
            <Image src="/google-icon.svg" alt="Google" width={20} height={20} />
            <span className="font-medium text-gray-700">Sign up with Google</span>
          </button>
          <div className="text-xs text-center mt-4 text-gray-600">
            Already have an account?{" "}
            <a href="login" className="text-blue-600 hover:underline">
              Login
            </a>
          </div>
        </div>
      </main>
      {/* Optional: Overlay for background dimming */}
      <div className="absolute inset-0 bg-black/30 -z-0" aria-hidden="true"></div>
    </div>
  );
}
