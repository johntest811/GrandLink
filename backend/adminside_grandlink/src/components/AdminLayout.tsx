"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/app/Clients/Supabase/SupabaseClients";
import { logActivity } from "@/app/lib/activity";
import NotificationBell from "./NotificationBell";
import RecentActivity from "./RecentActivity";

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    checkAuthAndLoadAdmin();
  }, []);

  const checkAuthAndLoadAdmin = async () => {
    try {
      console.log("🔍 Checking authentication status...");
      
      // Check localStorage for admin session
      const sessionData = localStorage.getItem('adminSession');
      if (!sessionData) {
        console.warn("⚠️ No admin session found");
        router.push('/login');
        setLoading(false);
        return;
      }

      const session = JSON.parse(sessionData);
      console.log("📋 Session found:", session);

      // Verify admin still exists and is active
      const { data: adminData, error: adminError } = await supabase
        .from("admins")
        .select("*")
        .eq("id", session.id)
        .single();
      
      if (adminError || !adminData) {
        console.error("❌ Admin verification failed:", adminError);
        localStorage.removeItem('adminSession');
        router.push('/login');
        setLoading(false);
        return;
      }
      
      // Check if account is still active
      if (!adminData.is_active) {
        console.warn("⚠️ Admin account is deactivated");
        localStorage.removeItem('adminSession');
        router.push('/login');
        setLoading(false);
        return;
      }
      
      console.log("✅ Admin verified:", adminData);
      setCurrentAdmin(adminData);
      
    } catch (e) {
      console.error("💥 Auth check exception:", e);
      localStorage.removeItem('adminSession');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Log logout activity before signing out
      if (currentAdmin?.id) {
        await logActivity({
          admin_id: currentAdmin.id,
          admin_name: currentAdmin.username || currentAdmin.id,
          action: "logout",
          entity_type: "admin",
          details: `Admin "${currentAdmin.username}" logged out from the system`,
          page: "auth",
          metadata: {
            logoutTime: new Date().toISOString()
          }
        });
        console.log("📝 Logout activity logged");
      }

      // Clear session and redirect
      localStorage.removeItem('adminSession');
      setCurrentAdmin(null);
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      // Force logout even if logging fails
      localStorage.removeItem('adminSession');
      setCurrentAdmin(null);
      router.push("/login");
    }
  };

  const sidebarLinks = [
    { href: "/dashboard", label: "Dashboard", icon: "🏠" },
    { href: "/dashboard/products", label: "Add Products", icon: "➕" },
    { href: "/dashboard/UpdateProducts", label: "Update Products", icon: "📝" },
    { href: "/dashboard/inventory", label: "Inventory", icon: "📦" },
    { href: "/dashboard/orders", label: "Orders", icon: "🛒" },
    { href: "/dashboard/admins", label: "Admin Accounts", icon: "👥" },
    { href: "/dashboard/users", label: "Users", icon: "👤" },
    { href: "/dashboard/notification/admin", label: "Notifications", icon: "🔔" },
  ];

  const isActivePage = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  // Show loading spinner while checking auth
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
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`bg-gradient-to-b from-[#233a5e] to-[#1a2942] text-white transition-all duration-300 flex flex-col ${
          isSidebarOpen ? "w-64" : "w-16"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/20">
          <div className="flex items-center justify-between">
            {isSidebarOpen && (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-lg">🏢</span>
                </div>
                <span className="font-bold text-lg">GrandLink</span>
              </div>
            )}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 rounded hover:bg-white/20 transition-colors"
            >
              {isSidebarOpen ? "◀" : "▶"}
            </button>
          </div>
        </div>

        {/* Admin Info */}
        {isSidebarOpen && currentAdmin && (
          <div className="p-4 border-b border-white/20">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-lg font-semibold">
                  {currentAdmin.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {currentAdmin.username}
                </p>
                <p className="text-xs text-white/70 truncate">
                  {currentAdmin.position || 'Administrator'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto sidebar-scroll">
          <div className="p-2 space-y-1">
            {sidebarLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActivePage(link.href)
                    ? "bg-white/20 text-white shadow-sm"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="text-lg mr-3">{link.icon}</span>
                {isSidebarOpen && <span>{link.label}</span>}
              </Link>
            ))}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/20">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white rounded-lg transition-colors"
          >
            <span className="text-lg mr-3">🚪</span>
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-gray-900">
                  Admin Panel
                </h1>
              </div>

              {/* Header Actions */}
              <div className="flex items-center space-x-4">
                {/* Recent Activities Dropdown - Popup Style */}
                <RecentActivity 
                  adminId={currentAdmin?.id} 
                  adminName={currentAdmin?.username}
                  limit={10}
                  showAsDropdown={true}
                />

                {/* Notifications */}
                <NotificationBell 
                  adminId={currentAdmin?.id}
                  adminRole={currentAdmin?.role || 'admin'}
                />

                {/* Admin Info Display */}
                {currentAdmin && (
                  <div className="flex items-center space-x-3 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {currentAdmin.username}
                      </p>
                      <p className="text-xs text-gray-500">
                        {currentAdmin.position || 'Administrator'} • {currentAdmin.role || 'admin'}
                      </p>
                    </div>
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-sm text-indigo-600 font-semibold">
                        {currentAdmin.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
          <div className="container mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;