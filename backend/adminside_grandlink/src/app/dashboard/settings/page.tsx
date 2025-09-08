'use client';

import React, { useState } from 'react';

export default function SettingsPage() {
  // Superadmin registration form state
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("admin");
  const [regMessage, setRegMessage] = useState("");
  const { supabase } = require("@/app/Clients/Supabase/SupabaseClients");

  const handleSuperadminRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegMessage("");
    if (!newUsername || !newPassword) {
      setRegMessage("Username and password are required.");
      return;
    }
    // Store password as plain text
    const { error } = await supabase.from("admins").insert({
      username: newUsername,
      password_hash: newPassword,
      role: newRole,
    });
    if (error) {
      setRegMessage("Error: " + error.message);
    } else {
      setRegMessage("Admin account created successfully!");
      setNewUsername("");
      setNewPassword("");
      setNewRole("admin");
    }
  };
  // State for form values
  const [generalSettings, setGeneralSettings] = useState({
    siteName: 'GrandLink Glass and Aluminium',
    siteDescription: 'Quality glass and aluminium products for your home and business',
    contactEmail: 'info@grandlink.com',
    contactPhone: '+1 (555) 123-4567',
    address: '123 Main Street, City, Country',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    orderUpdates: true,
    newUserRegistrations: true,
    productUpdates: false,
    marketingEmails: false,
  });

  // Handle general settings form change
  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setGeneralSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle notification settings form change
  const handleNotificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setNotificationSettings(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  // Handle general settings form submission
  const handleGeneralSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real application, you would save these settings to your backend
    alert('General settings saved!');
  };

  // Handle notification settings form submission
  const handleNotificationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real application, you would save these settings to your backend
    alert('Notification settings saved!');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* General Settings */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">General Settings</h2>
          <form onSubmit={handleGeneralSubmit}>
            <div className="mb-4">
              <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 mb-1">
                Site Name
              </label>
              <input
                type="text"
                id="siteName"
                name="siteName"
                value={generalSettings.siteName}
                onChange={handleGeneralChange}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="siteDescription" className="block text-sm font-medium text-gray-700 mb-1">
                Site Description
              </label>
              <textarea
                id="siteDescription"
                name="siteDescription"
                value={generalSettings.siteDescription}
                onChange={handleGeneralChange}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                id="contactEmail"
                name="contactEmail"
                value={generalSettings.contactEmail}
                onChange={handleGeneralChange}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                id="contactPhone"
                name="contactPhone"
                value={generalSettings.contactPhone}
                onChange={handleGeneralChange}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Business Address
              </label>
              <textarea
                id="address"
                name="address"
                value={generalSettings.address}
                onChange={handleGeneralChange}
                rows={2}
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>

            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Save General Settings
            </button>
          </form>
        </div>

        {/* Notification Settings */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Notification Settings</h2>
          <form onSubmit={handleNotificationSubmit}>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="emailNotifications"
                  name="emailNotifications"
                  checked={notificationSettings.emailNotifications}
                  onChange={handleNotificationChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="emailNotifications" className="ml-2 block text-sm text-gray-700">
                  Enable Email Notifications
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="orderUpdates"
                  name="orderUpdates"
                  checked={notificationSettings.orderUpdates}
                  onChange={handleNotificationChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="orderUpdates" className="ml-2 block text-sm text-gray-700">
                  Order Updates
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="newUserRegistrations"
                  name="newUserRegistrations"
                  checked={notificationSettings.newUserRegistrations}
                  onChange={handleNotificationChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="newUserRegistrations" className="ml-2 block text-sm text-gray-700">
                  New User Registrations
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="productUpdates"
                  name="productUpdates"
                  checked={notificationSettings.productUpdates}
                  onChange={handleNotificationChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="productUpdates" className="ml-2 block text-sm text-gray-700">
                  Product Updates
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="marketingEmails"
                  name="marketingEmails"
                  checked={notificationSettings.marketingEmails}
                  onChange={handleNotificationChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="marketingEmails" className="ml-2 block text-sm text-gray-700">
                  Marketing Emails
                </label>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Save Notification Settings
              </button>
            </div>
          </form>
        </div>

        {/* Security Settings */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Security Settings</h2>
          <form>
            <div className="mb-4">
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                id="currentPassword"
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                id="newPassword"
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                className="w-full p-2 border border-gray-300 rounded"
              />
            </div>

            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Change Password
            </button>
          </form>
        </div>

        {/* Backup & Export */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Backup & Export</h2>
          
          <div className="mb-6">
            <h3 className="text-md font-medium mb-2">Database Backup</h3>
            <p className="text-sm text-gray-600 mb-3">
              Create a backup of your entire database. This includes all products, orders, and user data.
            </p>
            <button
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Create Backup
            </button>
          </div>

          <div>
            <h3 className="text-md font-medium mb-2">Export Data</h3>
            <p className="text-sm text-gray-600 mb-3">
              Export specific data to CSV format for use in other applications.
            </p>
            <div className="space-x-2">
              <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded">
                Export Users
              </button>
              <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded">
                Export Products
              </button>
              <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded">
                Export Orders
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Superadmin Registration Form */}
      <div className="bg-white shadow rounded-lg p-6 mt-8">
        <h2 className="text-xl font-semibold mb-4">Create Admin/Manager Account</h2>
        <form className="flex flex-col gap-4 w-80" onSubmit={handleSuperadminRegister}>
          <input
            type="text"
            placeholder="Username"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            className="border px-3 py-2 rounded"
          />
          <input
            type="password"
            placeholder="Password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="border px-3 py-2 rounded"
          />
          <select value={newRole} onChange={e => setNewRole(e.target.value)} className="border px-3 py-2 rounded">
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
          </select>
          <button type="submit" className="bg-[#232d3b] text-white py-2 rounded font-semibold">Create Account</button>
          {regMessage && <div className="text-center text-red-600 mt-2">{regMessage}</div>}
        </form>
      </div>
    </div>
  );
}