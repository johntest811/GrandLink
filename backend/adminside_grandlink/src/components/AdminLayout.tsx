import Image from "next/image";
import { FaHistory, FaBell, FaUserCircle, FaSignOutAlt } from "react-icons/fa";

export function AdminNavBar() {
  return (
    <header className="w-full bg-white flex items-center justify-between px-6 py-2 border-b border-gray-300 shadow-sm">
      <div className="flex items-center gap-3">
        <Image src="/logo.svg" alt="Grand East Logo" width={48} height={48} />
        <div>
          <span className="font-bold text-xl text-black tracking-wide">
            GRAND <span className="text-[#8B1C1C]">EAST</span>
          </span>
          <div className="text-xs text-gray-700 font-medium leading-tight">
            GLASS AND ALUMINUM
          </div>
        </div>
      </div>
      <div className="flex items-center gap-8">
        <FaHistory className="text-3xl text-[#2c3748]" />
        <FaBell className="text-3xl text-[#2c3748]" />
        <FaUserCircle className="text-3xl text-[#2c3748]" />
      </div>
    </header>
  );
}

export function AdminSidePanel() {
  return (
    <aside className="bg-[#2c3748] text-white w-56 min-h-screen py-6 px-4 flex flex-col justify-between">
      <nav className="space-y-2 text-lg font-medium">
        <div className="hover:text-[#8B1C1C] cursor-pointer">Dashboard</div>
        <div className="hover:text-[#8B1C1C] cursor-pointer">Announcements</div>
        <div className="hover:text-[#8B1C1C] cursor-pointer flex items-center justify-between">
          Accounts <span className="text-xs">&#94;</span>
        </div>
        <div className="hover:text-[#8B1C1C] cursor-pointer">Reports</div>
        <div className="hover:text-[#8B1C1C] cursor-pointer flex items-center justify-between">
          Inventory <span className="text-xs">&#94;</span>
        </div>
        <div className="hover:text-[#8B1C1C] cursor-pointer">Employee Task</div>
        <div className="hover:text-[#8B1C1C] cursor-pointer">Orders</div>
        <div className="hover:text-[#8B1C1C] cursor-pointer">Order Management</div>
        <div className="hover:text-[#8B1C1C] cursor-pointer">Calendar</div>
        <div className="hover:text-[#8B1C1C] cursor-pointer">Content Management</div>
        <div className="hover:text-[#8B1C1C] cursor-pointer">Predictive</div>
        <div className="hover:text-[#8B1C1C] cursor-pointer flex items-center justify-between">
          Settings <span className="text-xs">&#94;</span>
        </div>
      </nav>
      <div className="flex items-center gap-2 text-gray-300 hover:text-[#8B1C1C] cursor-pointer mt-8">
        <FaSignOutAlt className="text-xl" />
        <span className="text-base font-semibold">LOG OUT</span>
      </div>
    </aside>
  );
}

// Usage in a Next.js page or layout:
// import { AdminNavBar, AdminSidePanel } from "@/components/AdminLayout";

// export default function AdminPage() {
//   return (
//     <>
//       <AdminNavBar />
//       <div className="flex">
//         <AdminSidePanel />
//         <main className="flex-1">{/* admin content here */}</main>
//       </div>
//     </>
//   );
// }