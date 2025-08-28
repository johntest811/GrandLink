"use client";

import React from "react";

export default function OrderPage() {
  const sidebarLinks = [
    "My Address",
    "Notification Settings",
    "Settings",
    "FAQs",
    "Help Centre",
    "Inquire",
  ];

  const orders: { id: number; status: string; name: string }[] = [];

  const tabs = ["All", "My List", "Reserve", "Order", "Completed", "Cancelled"];
  const [activeTab, setActiveTab] = React.useState("All");

  return (
    <div className="flex min-h-screen bg-gray-100 p-6">
      {/* Sidebar */}
      <aside className="w-1/4 bg-white shadow-md rounded-2xl p-6 flex flex-col">
        {/* Profile */}
        <div className="flex items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-gray-300 mr-4"></div>
          <div>
            <h2 className="text-lg font-semibold">John Doe</h2>
            <p className="text-sm text-gray-500">Customer</p>
          </div>
        </div>

        {/* Links */}
        <nav className="flex flex-col gap-3">
          {sidebarLinks.map((link, i) => (
            <button
              key={i}
              className="text-left px-3 py-2 rounded-lg hover:bg-gray-100 transition"
            >
              {link}
            </button>
          ))}
        </nav>

        <button className="mt-auto bg-red-500 text-white rounded-lg py-2 hover:bg-red-600 transition">
          Logout
        </button>
      </aside>

      {/* Main */}
      <main className="w-3/4 ml-6 bg-white shadow-md rounded-2xl p-6 flex flex-col">
        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg border transition font-medium ${
                activeTab === tab
                  ? "bg-red-500 text-white border-red-600 shadow-md"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-red-100 hover:border-red-400"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search orders..."
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>

        {/* Orders */}
        <div className="flex flex-col gap-4">
          {orders.length === 0 ? (
            <div className="text-center text-gray-500 py-20">
              <p className="text-3xl">📦</p>
              <p className="mt-2">No Orders yet</p>
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="p-4 border rounded-lg shadow-sm hover:shadow-md transition"
              >
                <h3 className="font-semibold">{order.name}</h3>
                <p className="text-sm text-gray-500">{order.status}</p>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
