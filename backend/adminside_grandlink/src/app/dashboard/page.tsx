import React from 'react';

export default function Dashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Users" value="1,234" icon="👥" color="bg-blue-500" />
        <StatCard title="Total Products" value="567" icon="📦" color="bg-green-500" />
        <StatCard title="Total Orders" value="890" icon="🛒" color="bg-purple-500" />
        <StatCard title="Revenue" value="$12,345" icon="💰" color="bg-yellow-500" />
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <ActivityItem 
            title="New Order #1234" 
            description="John Doe placed a new order for $123.45" 
            time="2 hours ago" 
          />
          <ActivityItem 
            title="New User Registration" 
            description="Jane Smith created a new account" 
            time="3 hours ago" 
          />
          <ActivityItem 
            title="Product Update" 
            description="Inventory updated for 5 products" 
            time="5 hours ago" 
          />
          <ActivityItem 
            title="Payment Received" 
            description="Payment of $543.21 received for Order #1233" 
            time="1 day ago" 
          />
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, icon, color }: { title: string; value: string; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`${color} text-white p-3 rounded-full mr-4`}>
          <span className="text-xl">{icon}</span>
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

// Activity Item Component
function ActivityItem({ title, description, time }: { title: string; description: string; time: string }) {
  return (
    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
      <div className="flex justify-between">
        <p className="font-medium">{title}</p>
        <span className="text-sm text-gray-500">{time}</span>
      </div>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
}