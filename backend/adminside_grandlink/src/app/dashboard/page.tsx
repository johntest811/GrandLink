"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/app/Clients/Supabase/SupabaseClients";
import NotificationBell from "@/components/NotificationBell";
import { logActivity } from "@/app/lib/activity";

type ActivityLog = {
  id: string | number;
  admin_id: string;
  admin_name: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details: string;
  page?: string;
  metadata?: string;
  created_at: string;
};

export default function DashboardPage() {
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);

  useEffect(() => {
    // Load current admin from localStorage
    const loadCurrentAdmin = () => {
      try {
        console.log("🔍 Loading current admin from localStorage...");
        const sessionData = localStorage.getItem('adminSession');
        if (sessionData) {
          const admin = JSON.parse(sessionData);
          console.log("✅ Admin loaded from session:", admin);
          setCurrentAdmin(admin);
        } else {
          console.log("❌ No admin session found");
        }
      } catch (error) {
        console.error("💥 Error loading admin session:", error);
      }
    };

    loadCurrentAdmin();
  }, []);

  useEffect(() => {
    // Fetch ALL recent activities for dashboard display
    const fetchRecentActivities = async () => {
      try {
        console.log("📋 Fetching ALL activities for dashboard...");
        const { data, error } = await supabase
          .from("activity_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          console.error("❌ Activities fetch error:", error);
          setRecentActivities([]);
          return;
        }
        
        console.log("✅ All activities fetched:", data?.length || 0);
        setRecentActivities(data || []);
      } catch (e) {
        console.error("💥 Activities fetch exception:", e);
        setRecentActivities([]);
      }
    };

    // Initial fetch
    fetchRecentActivities();

    // Set up real-time subscription for ALL activities
    const channel = supabase
      .channel("dashboard_all_activity_logs")
      .on("postgres_changes", { 
        event: "INSERT", 
        schema: "public", 
        table: "activity_logs"
      }, () => {
        console.log("🔄 Real-time activity update received (all activities)");
        fetchRecentActivities();
      })
      .subscribe();

    // Cleanup function
    return () => {
      try { 
        supabase.removeChannel(channel); 
      } catch (e) {
        console.error("Error removing channel:", e);
      }
    };
  }, []); // Empty dependency array - no dependencies that change

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case "create": return "➕";
      case "update": return "✏️";
      case "delete": return "🗑️";
      case "login": return "🔑";
      case "logout": return "🚪";
      case "accept_order": return "✅";
      case "reserve_order": return "📋";
      default: return "📝";
    }
  };

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case "create": return "border-green-500 bg-green-50";
      case "update": return "border-blue-500 bg-blue-50";
      case "delete": return "border-red-500 bg-red-50";
      case "login": return "border-purple-500 bg-purple-50";
      case "logout": return "border-gray-500 bg-gray-50";
      case "accept_order": return "border-green-500 bg-green-50";
      case "reserve_order": return "border-orange-500 bg-orange-50";
      default: return "border-indigo-500 bg-indigo-50";
    }
  };

  const getPageDisplayName = (page?: string) => {
    if (!page) return "";
    
    const pageMap: Record<string, string> = {
      "products": "Add Products",
      "UpdateProducts": "Update Products", 
      "inventory": "Inventory Management",
      "dashboard": "Dashboard",
      "settings": "Settings",
      "orders": "Orders"
    };
    
    return pageMap[page] || page;
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
  };

  const parseMetadata = (metadataStr?: string) => {
    if (!metadataStr) return null;
    try {
      return JSON.parse(metadataStr);
    } catch {
      return null;
    }
  };

  const testActivityLogging = async () => {
    if (!currentAdmin?.id) {
      alert("No admin loaded");
      return;
    }

    console.log("🧪 Testing activity logging with admin:", currentAdmin);
    
    const result = await logActivity({
      admin_id: currentAdmin.id,
      admin_name: currentAdmin.username,
      action: "create",
      entity_type: "product",
      details: "Test activity log from dashboard",
      page: "dashboard",
      metadata: { test: true }
    });

    console.log("🧪 Test result:", result);
    
    if (result.success) {
      alert("✅ Test activity logged successfully!");
    } else {
      alert("❌ Test failed: " + JSON.stringify(result.error));
    }
  };

  const testSupabaseConnection = async () => {
    try {
      console.log("🔌 Testing Supabase connection...");
      
      const { data, error } = await supabase.from("activity_logs").select("count", { count: 'exact' });
      
      if (error) {
        console.error("❌ Supabase connection error:", error);
        alert("Supabase connection failed: " + error.message);
      } else {
        console.log("✅ Supabase connected. Activity logs count:", data);
        alert("✅ Supabase connected successfully!");
      }
    } catch (err) {
      console.error("💥 Connection test failed:", err);
      alert("Connection test failed: " + err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-4">
          <button 
            onClick={testActivityLogging}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            🧪 Test Activity Log
          </button>
          <button 
            onClick={testSupabaseConnection}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            🔌 Test Supabase
          </button>
          <div className="text-sm text-gray-600">
            Welcome back, {currentAdmin?.username || "Admin"}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">📊</span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Total Products</div>
              <div className="text-2xl font-bold text-gray-900">-</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">📦</span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">All Activities</div>
              <div className="text-2xl font-bold text-gray-900">{recentActivities.length}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">🛒</span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Pending Orders</div>
              <div className="text-2xl font-bold text-gray-900">-</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm">📈</span>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Monthly Sales</div>
              <div className="text-2xl font-bold text-gray-900">-</div>
            </div>
          </div>
        </div>
      </div>

      {/* ALL Recent Activities Section - Fully Scrollable */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">All Recent Activities</h2>
            <div className="text-sm text-gray-500">
              System-wide • {recentActivities.length} total activities
            </div>
          </div>
        </div>
        
        {/* Fully Scrollable Activities Container */}
        <div className="max-h-96 overflow-y-auto">
          <div className="p-6">
            {recentActivities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-4">📝</div>
                <div className="text-lg font-medium mb-2">No recent activities</div>
                <div className="text-sm">System activities will appear here</div>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivities.map((activity) => {
                  const metadata = parseMetadata(activity.metadata);
                  const pageDisplay = getPageDisplayName(activity.page);
                  
                  return (
                    <div key={String(activity.id)} className={`flex items-start gap-4 p-4 rounded-lg border-l-4 ${getActionColor(activity.action)}`}>
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-lg">{getActionIcon(activity.action)}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {activity.action} {activity.entity_type}
                          </span>
                          {pageDisplay && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                              {pageDisplay}
                            </span>
                          )}
                          <span className="text-xs text-gray-500 ml-auto">
                            {formatTimeAgo(activity.created_at)}
                          </span>
                        </div>
                        
                        <div className="text-sm text-gray-700 mb-2">
                          {activity.details}
                        </div>
                        
                        {metadata && (
                          <div className="grid grid-cols-2 gap-3 text-xs bg-white rounded p-3 border">
                            {metadata.productName && (
                              <div>
                                <span className="font-medium text-gray-600">Product:</span> 
                                <span className="text-gray-900 ml-1">{metadata.productName}</span>
                              </div>
                            )}
                            
                            {metadata.oldInventory !== undefined && metadata.newInventory !== undefined && (
                              <div>
                                <span className="font-medium text-gray-600">Inventory:</span> 
                                <span className="text-gray-900 ml-1">
                                  {metadata.oldInventory} → {metadata.newInventory}
                                  {metadata.inventoryChange && (
                                    <span className={`ml-1 ${metadata.inventoryChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      ({metadata.inventoryChange > 0 ? '+' : ''}{metadata.inventoryChange})
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}
                            
                            {metadata.category && (
                              <div>
                                <span className="font-medium text-gray-600">Category:</span> 
                                <span className="text-gray-900 ml-1">{metadata.category}</span>
                              </div>
                            )}
                            
                            {metadata.price !== undefined && (
                              <div>
                                <span className="font-medium text-gray-600">Price:</span> 
                                <span className="text-gray-900 ml-1">₱{metadata.price}</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-400 mt-2">
                          {new Date(activity.created_at).toLocaleString()} • Admin: {activity.admin_name}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}