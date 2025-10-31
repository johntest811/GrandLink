import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';

type OrderItem = {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  total_amount: number;
  status: string;
  order_status: string;
  order_progress: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
  delivery_address: string;
  special_instructions: string;
  product?: {
    name: string;
    image1: string;
    category: string;
  };
};

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        Alert.alert('Error', 'Please sign in to view orders.');
        router.replace('/login');
        return;
      }

      // Fetch orders from user_items that are not completed or cancelled
      const { data, error } = await supabase
        .from('user_items')
        .select(`
          id,
          product_id,
          quantity,
          price,
          total_amount,
          status,
          order_status,
          order_progress,
          payment_status,
          created_at,
          updated_at,
          delivery_address,
          special_instructions,
          products (
            name,
            image1,
            category
          )
        `)
        .eq('user_id', authData.user.id)
        .eq('item_type', 'order')
        .not('status', 'in', '(cancelled,completed)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(data || []);
    } catch (error: any) {
      console.error('Failed to load orders:', error);
      Alert.alert('Error', 'Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const getOrderStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('approved') || statusLower.includes('accepted')) return '#10b981';
    if (statusLower.includes('production')) return '#f59e0b';
    if (statusLower.includes('packaging')) return '#8b5cf6';
    if (statusLower.includes('delivery')) return '#3b82f6';
    if (statusLower.includes('pending')) return '#6b7280';
    return '#a81d1d';
  };

  const getOrderStatusText = (order: OrderItem) => {
    if (order.order_progress) return order.order_progress.replace(/_/g, ' ').toUpperCase();
    if (order.order_status) return order.order_status.replace(/_/g, ' ').toUpperCase();
    if (order.status) return order.status.replace(/_/g, ' ').toUpperCase();
    return 'PENDING';
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0 });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Orders</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a81d1d" />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#a81d1d']} />}
      >
        {orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={80} color="#ccc" />
            <Text style={styles.emptyTitle}>No Active Orders</Text>
            <Text style={styles.emptyText}>You don't have any orders in progress.</Text>
            <TouchableOpacity style={styles.shopButton} onPress={() => router.push('../shop')}>
              <Text style={styles.shopButtonText}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.ordersContainer}>
            {orders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderIdContainer}>
                    <Text style={styles.orderIdLabel}>Order ID:</Text>
                    <Text style={styles.orderIdText}>{order.id.substring(0, 8).toUpperCase()}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getOrderStatusColor(order.status) }]}>
                    <Text style={styles.statusBadgeText}>{getOrderStatusText(order)}</Text>
                  </View>
                </View>

                <View style={styles.orderContent}>
                  {order.product?.image1 ? (
                    <Image source={{ uri: order.product.image1 }} style={styles.productImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.productImagePlaceholder}>
                      <Ionicons name="image-outline" size={32} color="#ccc" />
                    </View>
                  )}

                  <View style={styles.orderDetails}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {order.product?.name || 'Product'}
                    </Text>
                    <Text style={styles.orderInfo}>Quantity: {order.quantity}</Text>
                    <Text style={styles.orderPrice}>{formatCurrency(order.total_amount || order.price * order.quantity)}</Text>
                    <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
                  </View>
                </View>

                {order.delivery_address && (
                  <View style={styles.addressContainer}>
                    <Ionicons name="location" size={16} color="#666" />
                    <Text style={styles.addressText} numberOfLines={2}>
                      {order.delivery_address}
                    </Text>
                  </View>
                )}

                {order.special_instructions && (
                  <View style={styles.notesContainer}>
                    <Ionicons name="document-text" size={16} color="#666" />
                    <Text style={styles.notesText} numberOfLines={2}>
                      {order.special_instructions}
                    </Text>
                  </View>
                )}

                <View style={styles.orderFooter}>
                  <TouchableOpacity 
                    style={styles.viewDetailsButton}
                    onPress={() => {
                      Alert.alert(
                        'Order Details',
                        `Order ID: ${order.id}\nStatus: ${getOrderStatusText(order)}\nPayment: ${order.payment_status || 'Pending'}\n\nTracking features coming soon!`
                      );
                    }}
                  >
                    <Text style={styles.viewDetailsText}>View Details</Text>
                    <Ionicons name="chevron-forward" size={18} color="#a81d1d" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#a81d1d',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  shopButton: {
    backgroundColor: '#a81d1d',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  ordersContainer: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderIdLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 6,
  },
  orderIdText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  orderContent: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  productImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  orderInfo: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  orderPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#a81d1d',
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 11,
    color: '#999',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff7ed',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  notesText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  orderFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a81d1d',
    marginRight: 4,
  },
});
