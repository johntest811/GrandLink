"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/app/Clients/Supabase/SupabaseClients';
import { logActivity } from '@/app/lib/activity';
import { safeCreateNotification } from '@/app/lib/notifications';

type Order = {
  id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  product_name: string;
  quantity: number;
  total_amount: number;
  status: 'pending' | 'accepted' | 'reserved' | 'completed' | 'cancelled';
  order_type: 'order' | 'reservation';
  notes?: string;
  created_at: string;
  updated_at: string;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Load current admin and log page access
  useEffect(() => {
    const loadAdmin = async () => {
      try {
        const sessionData = localStorage.getItem('adminSession');
        if (sessionData) {
          const admin = JSON.parse(sessionData);
          setCurrentAdmin(admin);
          
          // Log page access
          await logActivity({
            admin_id: admin.id,
            admin_name: admin.username,
            action: 'view',
            entity_type: 'page',
            details: `Accessed Orders Management page`,
            page: 'orders',
            metadata: {
              pageAccess: true,
              adminAccount: admin.username,
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (error) {
        console.error("Error loading admin:", error);
      }
    };

    loadAdmin();
  }, []);

  // Fetch orders
  useEffect(() => {
    if (currentAdmin) {
      fetchOrders();
    }
  }, [currentAdmin]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        return;
      }

      setOrders(data || []);
      
      // Log orders loaded
      if (currentAdmin) {
        await logActivity({
          admin_id: currentAdmin.id,
          admin_name: currentAdmin.username,
          action: 'view',
          entity_type: 'orders_list',
          details: `Loaded ${data?.length || 0} orders for management`,
          page: 'orders',
          metadata: {
            ordersCount: data?.length || 0,
            pendingOrders: data?.filter(o => o.status === 'pending').length || 0,
            completedOrders: data?.filter(o => o.status === 'completed').length || 0,
            adminAccount: currentAdmin.username
          }
        });
      }
    } catch (error) {
      console.error('Error in fetchOrders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status'], orderData: Order) => {
    if (!currentAdmin) return;
    
    setUpdatingStatus(orderId);

    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) {
        throw error;
      }

      // Update local state
      setOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, status: newStatus, updated_at: new Date().toISOString() }
          : order
      ));

      // Enhanced activity logging
      await logActivity({
        admin_id: currentAdmin.id,
        admin_name: currentAdmin.username,
        action: 'update',
        entity_type: 'order',
        entity_id: orderId,
        details: `Updated order status for "${orderData.product_name}" (Customer: ${orderData.customer_name}) from "${orderData.status}" to "${newStatus}"`,
        page: 'orders',
        metadata: {
          orderId,
          customerName: orderData.customer_name,
          productName: orderData.product_name,
          quantity: orderData.quantity,
          totalAmount: orderData.total_amount,
          oldStatus: orderData.status,
          newStatus,
          orderType: orderData.order_type,
          adminAccount: currentAdmin.username
        }
      });

      // Create notification for status change
      await safeCreateNotification({
        title: "Order Status Updated",
        message: `Order for "${orderData.product_name}" by ${orderData.customer_name} changed to ${newStatus} by ${currentAdmin.username}`,
        recipient_role: "admin",
        type: "order",
        priority: newStatus === 'completed' ? "low" : newStatus === 'cancelled' ? "medium" : "high",
      });

      alert(`✅ Order status updated to "${newStatus}"`);

    } catch (error: any) {
      console.error('Error updating order status:', error);
      alert(`❌ Error updating order: ${error.message}`);
      
      // Log error
      await logActivity({
        admin_id: currentAdmin.id,
        admin_name: currentAdmin.username,
        action: 'update',
        entity_type: 'order_error',
        entity_id: orderId,
        details: `Failed to update order status for "${orderData.product_name}": ${error.message}`,
        page: 'orders',
        metadata: {
          orderId,
          error: error.message,
          attemptedStatus: newStatus,
          adminAccount: currentAdmin.username
        }
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Log filter usage
  const handleSearchChange = async (newSearch: string) => {
    const oldSearch = searchTerm;
    setSearchTerm(newSearch);
    
    if (currentAdmin && oldSearch !== newSearch && newSearch.length > 0) {
      await logActivity({
        admin_id: currentAdmin.id,
        admin_name: currentAdmin.username,
        action: 'update',
        entity_type: 'search_filter',
        details: `Applied order search filter: "${newSearch}"`,
        page: 'orders',
        metadata: {
          searchTerm: newSearch,
          previousTerm: oldSearch,
          adminAccount: currentAdmin.username
        }
      });
    }
  };

  const handleStatusFilterChange = async (newStatus: string) => {
    const oldStatus = statusFilter;
    setStatusFilter(newStatus);
    
    if (currentAdmin && oldStatus !== newStatus) {
      await logActivity({
        admin_id: currentAdmin.id,
        admin_name: currentAdmin.username,
        action: 'update',
        entity_type: 'status_filter',
        details: `Changed order status filter from "${oldStatus || 'All Status'}" to "${newStatus || 'All Status'}"`,
        page: 'orders',
        metadata: {
          oldStatus: oldStatus || 'All Status',
          newStatus: newStatus || 'All Status',
          adminAccount: currentAdmin.username
        }
      });
    }
  };

  // Function to get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'accepted':
        return 'bg-blue-100 text-blue-800';
      case 'reserved':
        return 'bg-purple-100 text-purple-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchTerm || 
      order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || order.status === statusFilter;
    
    const matchesDate = !dateFilter || 
      new Date(order.created_at).toDateString() === new Date(dateFilter).toDateString();
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Orders Management</h1>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <span>Total: {orders.length}</span>
          <span>•</span>
          <span>Pending: {orders.filter(o => o.status === 'pending').length}</span>
          <span>•</span>
          <span>Completed: {orders.filter(o => o.status === 'completed').length}</span>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search orders (customer, product, order ID)..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="reserved">Reserved</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading orders...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-blue-600">
                          {order.id.slice(0, 8)}...
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-400">
                          {order.order_type}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm text-gray-900">{order.customer_name}</div>
                        {order.customer_email && (
                          <div className="text-sm text-gray-500">{order.customer_email}</div>
                        )}
                        {order.customer_phone && (
                          <div className="text-sm text-gray-500">{order.customer_phone}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm text-gray-900">{order.product_name}</div>
                        <div className="text-sm text-gray-500">Qty: {order.quantity}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        ₱{order.total_amount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {order.status === 'pending' && (
                        <div className="flex space-x-2 justify-end">
                          <button
                            onClick={() => updateOrderStatus(order.id, 'accepted', order)}
                            disabled={updatingStatus === order.id}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => updateOrderStatus(order.id, 'reserved', order)}
                            disabled={updatingStatus === order.id}
                            className="text-purple-600 hover:text-purple-900 disabled:opacity-50"
                          >
                            Reserve
                          </button>
                          <button
                            onClick={() => updateOrderStatus(order.id, 'cancelled', order)}
                            disabled={updatingStatus === order.id}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {(order.status === 'accepted' || order.status === 'reserved') && (
                        <button
                          onClick={() => updateOrderStatus(order.id, 'completed', order)}
                          disabled={updatingStatus === order.id}
                          className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                        >
                          Complete
                        </button>
                      )}
                      {updatingStatus === order.id && (
                        <span className="text-gray-500">Updating...</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filteredOrders.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-500">
            {searchTerm || statusFilter || dateFilter
              ? "No orders match your current filters."
              : "No orders available yet."
            }
          </p>
        </div>
      )}

      {/* Orders Summary */}
      {orders.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Orders Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900">
                {orders.length}
              </div>
              <div className="text-gray-500">Total Orders</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900">
                {orders.filter(o => o.status === 'pending').length}
              </div>
              <div className="text-gray-500">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900">
                {orders.filter(o => o.status === 'accepted').length}
              </div>
              <div className="text-gray-500">Accepted</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900">
                {orders.filter(o => o.status === 'reserved').length}
              </div>
              <div className="text-gray-500">Reserved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900">
                {orders.filter(o => o.status === 'completed').length}
              </div>
              <div className="text-gray-500">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-semibold text-gray-900">
                {orders.filter(o => o.status === 'cancelled').length}
              </div>
              <div className="text-gray-500">Cancelled</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}