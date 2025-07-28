'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '../components/Logo';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Navigation items
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: '📊' },
    { name: 'Users', path: '/dashboard/users', icon: '👥' },
    { name: 'Products', path: '/dashboard/products', icon: '📦' },
    { name: 'Orders', path: '/dashboard/orders', icon: '🛒' },
    { name: 'Settings', path: '/dashboard/settings', icon: '⚙️' },
  ];

  // Check if a nav item is active
  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-gray-800 text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
          <div className="flex-shrink-0">
            <Logo color="light" />
          </div>
          <button
            className="lg:hidden text-gray-300 hover:text-white"
            onClick={() => setIsMobileSidebarOpen(false)}
          >
            <span className="text-2xl">×</span>
          </button>
        </div>
        <div className="p-4">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`
                  flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors
                  ${isActive(item.path) 
                    ? 'bg-gray-900 text-white' 
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'}
                `}
              >
                <span className="mr-3">{item.icon}</span>
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
        <div className="absolute bottom-0 w-full p-4 border-t border-gray-700">
          <Link
            href="/login"
            className="flex items-center px-4 py-3 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-700 hover:text-white"
          >
            <span className="mr-3">🚪</span>
            Logout
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {/* Top navigation */}
        <div className="bg-white shadow-sm z-10">
          <div className="flex items-center justify-between h-16 px-4 lg:px-8">
            <button
              className="text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 lg:hidden"
              onClick={() => setIsMobileSidebarOpen(true)}
            >
              <span className="sr-only">Open sidebar</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center">
              <div className="ml-3 relative">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                    A
                  </div>
                  <span className="ml-2 text-sm font-medium text-gray-700">Admin User</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}