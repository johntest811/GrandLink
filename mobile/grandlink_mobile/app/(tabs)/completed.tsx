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
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';

type CompletedOrder = {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  total_amount: number;
  status: string;
  order_status: string;
  payment_status: string;
  created_at: string;
  updated_at: string;
  delivery_address: string;
  product?: {
    name: string;
    image1: string;
    category: string;
  };
};

export default function CompletedOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCompletedOrders();
  }, []);

  const loadCompletedOrders = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        Alert.alert('Error', 'Please sign in to view orders.');
        router.replace('/login');
        return;
      }

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
          payment_status,
          created_at,
          updated_at,
          delivery_address,
          products (
            name,
            image1,
            category
          )
        `)
        .eq('user_id', authData.user.id)
        .eq('item_type', 'order')
        .eq('status', 'completed')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('Failed to load completed orders:', error);
      Alert.alert('Error', 'Failed to load completed orders. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCompletedOrders();
  };

  const formatCurrency = (amount?: number | null) => {
    const value = typeof amount === 'number' && isFinite(amount) ? amount : Number(amount ?? 0) || 0;
    try {
      return value.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0 });
    } catch {
      return '₱0';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Completed Orders</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a81d1d" />
          <Text style={styles.loadingText}>Loading completed orders...</Text>
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
        <Text style={styles.headerTitle}>Completed Orders</Text>
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
            <View style={styles.emptyIconWrap}>
              <Feather name="check-circle" size={54} color="#a81d1d" />
            </View>
            <Text style={styles.emptyTitle}>No Completed Orders</Text>
            <Text style={styles.emptyText}>You haven&apos;t completed any orders yet.</Text>
            <TouchableOpacity style={styles.shopButton} onPress={() => router.push('../shop')}>
              <Text style={styles.shopButtonText}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.ordersContainer}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionBadge}>
                <Feather name="check-circle" size={16} color="#fff" />
              </View>
              <Text style={styles.sectionTitle}>{orders.length} Completed Order{orders.length !== 1 ? 's' : ''}</Text>
            </View>

            {orders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                {/* Top badge */}
                <View style={styles.completedBadgeContainer}>
                  <View style={styles.deliveredPill}>
                    <Feather name="check-circle" size={13} color="#fff" />
                    <Text style={styles.deliveredPillText}>DELIVERED</Text>
                  </View>
                  <Text style={styles.orderIdText}>#{order.id.substring(0, 8).toUpperCase()}</Text>
                </View>

                <View style={styles.orderContent}>
                  {order.product?.image1 ? (
                    <Image source={{ uri: order.product.image1 }} style={styles.productImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.productImagePlaceholder}>
                      <Ionicons name="image-outline" size={32} color="#bbb" />
                    </View>
                  )}
                  <View style={styles.orderDetails}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {order.product?.name || 'Product'}
                    </Text>
                    <Text style={styles.orderInfo}>Qty: {order.quantity}</Text>
                    <Text style={styles.orderPrice}>{formatCurrency(order.total_amount || order.price * order.quantity)}</Text>
                    <Text style={styles.completedDate}>
                      Completed: {formatDate(order.updated_at || order.created_at)}
                    </Text>
                  </View>
                </View>

                {order.delivery_address && (
                  <View style={styles.addressContainer}>
                    <Ionicons name="location" size={14} color="#a81d1d" />
                    <Text style={styles.addressText} numberOfLines={2}>
                      {order.delivery_address}
                    </Text>
                  </View>
                )}

                <View style={styles.orderFooter}>
                  <TouchableOpacity
                    style={styles.reorderButton}
                    onPress={() => {
                      Alert.alert(
                        'Reorder',
                        'Would you like to order this product again?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Yes, Reorder',
                            onPress: () => Alert.alert('Coming Soon', 'Reorder feature will be available soon!')
                          }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="repeat" size={16} color="#a81d1d" />
                    <Text style={styles.reorderText}>Reorder</Text>
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#a81d1d', paddingHorizontal: 16, paddingVertical: 12,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  refreshButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  scrollView: { flex: 1 },
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingVertical: 80, paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#fce8e8', justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 28 },
  shopButton: {
    backgroundColor: '#a81d1d', paddingHorizontal: 32, paddingVertical: 12,
    borderRadius: 8,
  },
  shopButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  ordersContainer: { padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#a81d1d', justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  orderCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3,
    borderLeftWidth: 4, borderLeftColor: '#a81d1d',
  },
  completedBadgeContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  deliveredPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#a81d1d', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  deliveredPillText: { fontSize: 11, fontWeight: '800', color: '#fff', marginLeft: 4 },
  orderIdText: { fontSize: 11, fontWeight: '600', color: '#888' },
  orderContent: { flexDirection: 'row', marginBottom: 12 },
  productImage: { width: 78, height: 78, borderRadius: 8, backgroundColor: '#f5f5f5' },
  productImagePlaceholder: {
    width: 78, height: 78, borderRadius: 8,
    backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center',
  },
  orderDetails: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },
  productName: { fontSize: 15, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 3 },
  orderInfo: { fontSize: 12, color: '#777', marginBottom: 2 },
  orderPrice: { fontSize: 16, fontWeight: 'bold', color: '#a81d1d', marginBottom: 2 },
  completedDate: { fontSize: 11, color: '#555', fontWeight: '600' },
  addressContainer: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fdf2f2', padding: 8, borderRadius: 6, marginBottom: 12,
  },
  addressText: { flex: 1, fontSize: 12, color: '#555', marginLeft: 6 },
  orderFooter: {
    borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12,
    alignItems: 'flex-end',
  },
  reorderButton: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#a81d1d',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  reorderText: { fontSize: 13, fontWeight: '700', color: '#a81d1d', marginLeft: 6 },
});
