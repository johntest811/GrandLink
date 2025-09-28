'use client';

import React, { useEffect, useState } from "react";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Logo from '../../components/Logo';
import NotificationBell from "../../components/NotificationBell";
import RecentActivity from "../../components/RecentActivity";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Helper for active nav item
  const isActive = (path: string) => pathname === path;

  // Dropdown state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Sidebar navigation structure
  const navStructure = [
    { name: 'Dashboard', path: '/dashboard', icon: '📊' },
    { name: 'Announcement', path: '/dashboard/announcement', icon: '📢' },
    {
      name: 'Accounts',
      icon: '👤',
      dropdown: [
        { name: 'User Accounts', path: '/dashboard/user-accounts' },
        { name: 'Employee Account', path: '/dashboard/admins' },
      ],
    },
    { name: 'Reports', path: '/dashboard/reports', icon: '📑' },
    {
      name: 'Inventory',
      icon: '📦',
      dropdown: [
        { name: 'Update Products', path: '/dashboard/UpdateProducts' },
        { name: 'Add Products', path: '/dashboard/products' },
        { name: 'Inventory', path: '/dashboard/inventory' },
      ],
    },
    {
      name: 'Task',
      icon: '📝',
      dropdown: [
        { name: 'Assigned Task', path: '/dashboard/task/assigntask' },
        { name: 'Employee Task', path: '/dashboard/task/employeetask' },
        { name: 'Admin Task', path: '/dashboard/task/admintask' },
      ],
    },
    { name: 'Orders', path: '/dashboard/orders', icon: '🛒' },
    { name: 'Order Management', path: '/dashboard/order-management', icon: '📋' },
    { name: 'Calendar', path: '/dashboard/calendar', icon: '📅' },
    { name: 'User Inquiries', path: '/dashboard/inquiries', icon: '📨' },
    {
      name: 'Content Management',
      icon: '🗂️',
      dropdown: [
        { name: 'Home', path: '/dashboard/pages/home' },
        { name: 'About Us', path: '/dashboard/pages/about' },
        { name: 'Showrooms', path: '/dashboard/pages/showroom' },
        { name: 'Services We Offer', path: '/dashboard/pages/Service' },
        { name: 'Featured Projects', path: '/dashboard/pages/Featured' },
        { name: 'Delivery & Ordering Process', path: '/dashboard/pages/DeliveryProcess' },
        { name: 'FAQs', path: '/dashboard/pages/FAQs' },
        { name: 'Inquire Page Editor', path: '/dashboard/inquiries/editor', icon: '📝' },
      ],
    },
    { name: 'Predictive', path: '/dashboard/predictive', icon: '🔮' },
    {
      name: 'Settings',
      icon: '⚙️',
      dropdown: [
        { name: 'Settings', path: '/dashboard/settings' },
        { name: 'Audit', path: '/dashboard/settings/audit' },
      ],
    },
  ];

  useEffect(() => {
    checkAuthAndLoadAdmin();
  }, []);

  const checkAuthAndLoadAdmin = () => {
    try {
      console.log("🔍 Checking admin session...");
      
      // Get admin session from localStorage
      const sessionData = localStorage.getItem('adminSession');
      if (!sessionData) {
        console.warn("⚠️ No admin session found");
        router.push('/login');
        setLoading(false);
        return;
      }

      const adminSession = JSON.parse(sessionData);
      console.log("✅ Admin session found:", adminSession);
      
      setCurrentAdmin(adminSession);
      setLoading(false);
    } catch (error) {
      console.error("💥 Error checking admin session:", error);
      router.push('/login');
      setLoading(false);
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('adminSession');
      setCurrentAdmin(null);
      router.push('/login');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            className="text-gray-600 lg:hidden"
            onClick={() => setIsMobileSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-3">
            <Logo color="dark" />
            <div className="text-lg font-semibold text-gray-800">GrandLink Admin</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Recent Activity - Popup Style */}
          <RecentActivity
            adminId={currentAdmin?.id}
            adminName={currentAdmin?.username}
            limit={10}
            showAsDropdown={true}
          />
          
          {/* Notifications */}
          <NotificationBell
            adminId={currentAdmin?.id}
            adminRole={currentAdmin?.role || currentAdmin?.position || "admin"}
          />

          <div className="ml-2 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-medium">
              {currentAdmin?.username ? currentAdmin.username.charAt(0).toUpperCase() : "A"}
            </div>
            <div className="text-sm text-gray-800 font-medium">{currentAdmin?.username ?? "Admin User"}</div>
          </div>
        </div>
      </header>

      {/* Mobile sidebar backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-gray-800 text-white transform transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
          <div className="flex-shrink-0">
            <Logo color="light" />
          </div>
          <button className="lg:hidden text-gray-300 hover:text-white" onClick={() => setIsMobileSidebarOpen(false)}>
            <span className="text-2xl">×</span>
          </button>
        </div>

        <div className="p-4">
          <nav className="space-y-1">
            {navStructure.map((item) =>
              item.dropdown ? (
                <div key={item.name} className="mb-2">
                  <button
                    type="button"
                    className={`flex items-center w-full px-4 py-3 text-sm font-medium rounded-md transition-colors ${openDropdown === item.name ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                    onClick={() => setOpenDropdown(openDropdown === item.name ? null : item.name)}
                  >
                    <span className="mr-3">{item.icon}</span>
                    {item.name}
                    <span className="ml-auto">{openDropdown === item.name ? '▲' : '▼'}</span>
                  </button>
                  {openDropdown === item.name && (
                    <div className="ml-8 mt-1 flex flex-col gap-1">
                      {item.dropdown.map((sub) => (
                        <Link
                          key={sub.path}
                          href={sub.path}
                          className={`px-3 py-2 text-xs rounded-md transition-colors ${isActive(sub.path) ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                        >
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${isActive(item.path) ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.name}
                </Link>
              )
            )}
          </nav>
        </div>

        <div className="absolute bottom-0 w-full p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-700 hover:text-white"
          >
            <span className="mr-3">🚪</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64">
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}