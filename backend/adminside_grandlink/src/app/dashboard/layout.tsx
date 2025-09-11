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

  // Helper for active nav item
  const isActive = (path: string) => pathname === path;

  // Dropdown state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Top nav "Site" dropdown
  const [openTopMenu, setOpenTopMenu] = useState(false);

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
    { name: 'Employee Task', path: '/dashboard/employee-task', icon: '📝' },
    { name: 'Orders', path: '/dashboard/orders', icon: '🛒' },
    { name: 'Order Management', path: '/dashboard/order-management', icon: '📋' },
    { name: 'Calendar', path: '/dashboard/calendar', icon: '📅' },
    {
      name: 'Content Management',
      icon: '🗂️',
      dropdown: [
        { name: 'Home', path: '/' },
        { name: 'About Us', path: '/about' },
        { name: 'Showrooms', path: '/showrooms' },
        { name: 'Services We Offer', path: '/services' },
        { name: 'Featured Projects', path: '/featured-projects' },
        { name: 'Delivery & Ordering Process', path: '/delivery-ordering' },
        { name: 'Products', path: '/Product' },
        { name: 'FAQs', path: '/faqs' },
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

  // Top nav site links
  const siteLinks = [
    { name: 'Home', href: '/' },
    { name: 'About Us', href: '/about' },
    { name: 'Showrooms', href: '/showrooms' },
    { name: 'Services We Offer', href: '/services' },
    { name: 'Featured Projects', href: '/featured-projects' },
    { name: 'Delivery & Ordering Process', href: '/delivery-ordering' },
    { name: 'Products', href: '/Product' },
    { name: 'FAQs', href: '/faqs' },
  ];

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
            {navStructure.map((item) =>
              item.dropdown ? (
                <div key={item.name} className="mb-2">
                  <button
                    type="button"
                    className={`
                      flex items-center w-full px-4 py-3 text-sm font-medium rounded-md transition-colors
                      ${openDropdown === item.name ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}
                    `}
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
                          className={`
                            px-3 py-2 text-xs rounded-md transition-colors
                            ${isActive(sub.path)
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-300 hover:bg-gray-700 hover:text-white'}
                          `}
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
                  className={
    `flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors
    ${isActive(item.path)
      ? 'bg-gray-900 text-white'
      : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`
  }
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.name}
                </Link>
              )
            )}
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

            <div className="flex items-center space-x-4">
              {/* Site dropdown */}
              <div className="relative">
                <button
                  aria-haspopup="true"
                  aria-expanded={openTopMenu}
                  onClick={() => setOpenTopMenu((s) => !s)}
                  className="px-3 py-2 rounded text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Site <span className="ml-1 text-xs">▾</span>
                </button>

                {openTopMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border rounded shadow-md z-40">
                    <div className="py-2">
                      {siteLinks.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          onClick={() => setOpenTopMenu(false)}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {l.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

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