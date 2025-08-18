import { FaEnvelope, FaLock } from "react-icons/fa"; // Add this import at the top
import Image from "next/image";
import TopNavBar from "@/components/TopNavBar";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen font-sans bg-cover bg-center flex flex-col" style={{ backgroundImage: 'url("/background-login.jpg")' }}>
      <TopNavBar />
      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center">
        <div className="bg-white/95 rounded-xl shadow-lg px-8 py-10 w-full max-w-md flex flex-col items-center relative z-10">
          <h1 className="text-3xl font-bold text-center mb-6 text-[#8B1C1C]">Login</h1>
          <form className="w-full flex flex-col gap-4">
            <div>
              <label className="font-semibold text-sm mb-1 block" htmlFor="email">Gmail</label>
              <div className="flex items-center border border-gray-400 rounded-lg px-3 py-2 bg-gray-100">
                <FaEnvelope className="text-gray-500 mr-2" /> {/* Changed to icon */}
                <input id="email" type="email" placeholder="Please Enter your Gmail Address" className="bg-transparent outline-none flex-1 text-gray-700 placeholder-gray-400" />
              </div>
            </div>
            <div>
              <label className="font-semibold text-sm mb-1 block" htmlFor="password">Password</label>
              <div className="flex items-center border border-gray-400 rounded-lg px-3 py-2 bg-gray-100">
                <FaLock className="text-gray-500 mr-2" /> {/* Changed to icon */}
                <input id="password" type="password" placeholder="Please Enter your password" className="bg-transparent outline-none flex-1 text-gray-700 placeholder-gray-400" />
              </div>
            </div>
            <div className="flex justify-end text-xs">
              <a href="forgotpass" className="text-blue-600 hover:underline">Forgot Password</a>
            </div>
            <button type="submit" className="bg-[#232d3b] text-white font-semibold rounded w-full py-2 mt-2 hover:bg-[#1a222e] transition">LOGIN</button>
          </form>
          <button className="flex items-center gap-2 bg-gray-100 border border-gray-300 rounded px-4 py-2 mt-4 w-full justify-center hover:bg-gray-200 transition">
            <Image src="/google-icon.svg" alt="Google" width={20} height={20} />
            <span className="font-medium text-gray-700">Sign in with Google</span>
          </button>
          <div className="text-xs text-center mt-4 text-gray-600">
            Don’t have an account yet? <a href="register" className="text-blue-600 hover:underline">Sign Up</a>
          </div>
        </div>
      </main>
      {/* Optional: Overlay for background dimming */}
      <div className="absolute inset-0 bg-black/30 -z-0" aria-hidden="true"></div>
    </div>
  );
}
