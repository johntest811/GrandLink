import Image from "next/image";

export default function AdminNavBar() {
  return (
    <header className="w-full bg-white flex items-center px-6 py-2 border-b border-gray-300 shadow-sm">
      <div className="flex items-center gap-3">
        <Image
          src="/logo.svg"
          alt="Grand East Logo"
          width={48}
          height={48}
          className="h-12 w-12 object-contain"
        />
        <div>
          <span className="font-bold text-xl text-black tracking-wide">
            GRAND <span className="text-[#8B1C1C]">EAST</span>
          </span>
          <div className="text-xs text-gray-700 font-medium leading-tight">
            GLASS AND ALUMINUM
          </div>
        </div>
      </div>
    </header>
  );
}