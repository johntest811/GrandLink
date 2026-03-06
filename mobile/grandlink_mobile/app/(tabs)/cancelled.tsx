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

type CancelledOrder = {
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
  admin_notes: string;
  product?: {
    name: string;
    image1: string;
    category: string;
  };
};

export default function CancelledOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<CancelledOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCancelledOrders();
  }, []);

  const loadCancelledOrders = async () => {
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
          admin_notes,
          products (
            name,
            image1,
            category
          )
        `)
        .eq('user_id', authData.user.id)
        .eq('item_type', 'order')
        .or('status.eq.cancelled,order_status.eq.cancelled,order_status.eq.pending_cancellation')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('Failed to load cancelled orders:', error);
      Alert.alert('Error', 'Failed to load cancelled orders. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadCancelledOrders();
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

  const isPendingCancellation = (order: CancelledOrder) =>
    order.order_status === 'pending_cancellation';

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cancelled Orders</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a81d1d" />
          <Text style={styles.loadingText}>Loading cancelled orders...</Text>
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
        <Text style={styles.headerTitle}>Cancelled Orders</Text>
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
              <Ionicons name="close-circle-outline" size={54} color="#a81d1d" />
            </View>
            <Text style={styles.emptyTitle}>No Cancelled Orders</Text>
            <Text style={styles.emptyText}>You don&apos;t have any cancelled orders.</Text>
            <TouchableOpacity style={styles.shopButton} onPress={() => router.push('../shop')}>
              <Text style={styles.shopButtonText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.ordersContainer}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionBadge}>
                <Ionicons name="close" size={16} color="#fff" />
              </View>
              <Text style={styles.sectionTitle}>
                {orders.length} Cancelled Order{orders.length !== 1 ? 's' : ''}
              </Text>
            </View>

            {orders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                {/* Top badge */}
                <View style={styles.cancelledBadgeRow}>
                  <View style={[
                    styles.statusPill,
                    isPendingCancellation(order) ? styles.pendingPill : styles.cancelledPill
                  ]}>
                    <Ionicons
                      name={isPendingCancellation(order) ? 'hourglass-outline' : 'close-circle'}
                      size={13}
                      color="#fff"
                    />
                    <Text style={styles.statusPillText}>
                      {isPendingCancellation(order) ? 'CANCELLATION PENDING' : 'CANCELLED'}
                    </Text>
                  </View>
                  <Text style={styles.orderIdText}>#{order.id.substring(0, 8).toUpperCase()}</Text>
                </View>

                <View style={styles.orderContent}>
                  {order.product?.image1 ? (
                    <Image
                      source={{ uri: order.product.image1 }}
                      style={[styles.productImage, { opacity: 0.65 }]}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.productImagePlaceholder, { opacity: 0.65 }]}>
                      <Ionicons name="image-outline" size={32} color="#bbb" />
                    </View>
                  )}
                  <View style={styles.orderDetails}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {order.product?.name || 'Product'}
                    </Text>
                    <Text style={styles.orderInfo}>Qty: {order.quantity}</Text>
                    <Text style={styles.orderPrice}>
                      {formatCurrency(order.total_amount || order.price * order.quantity)}
                    </Text>
                    <Text style={styles.cancelledDate}>
                      {isPendingCancellation(order) ? 'Requested' : 'Cancelled'}: {formatDate(order.updated_at || order.created_at)}
                    </Text>
                  </View>
                </View>

                {/* Admin cancellation reason */}
                {order.admin_notes && (
                  <View style={styles.reasonBox}>
                    <View style={styles.reasonHeader}>
                      <Ionicons name="information-circle" size={15} color="#a81d1d" />
                      <Text style={styles.reasonLabel}>Cancellation Reason</Text>
                    </View>
                    <Text style={styles.reasonText}>{order.admin_notes}</Text>
                  </View>
                )}

                {order.delivery_address && (
                  <View style={styles.addressContainer}>
                    <Ionicons name="location-outline" size={14} color="#888" />
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
                        'Order Again',
                        'Would you like to place a new order for this product?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Yes, Order Again',
                            onPress: () => Alert.alert('Coming Soon', 'Order again feature will be available soon!')
                          }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="cart-outline" size={16} color="#a81d1d" />
                    <Text style={styles.reorderText}>Order Again</Text>
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
    backgroundColor: '#1a1a1a', paddingHorizontal: 16, paddingVertical: 12,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center',
  },
  refreshButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center',
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
    backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 28 },
  shopButton: {
    backgroundColor: '#1a1a1a', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8,
  },
  shopButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  ordersContainer: { padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  orderCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3,
    borderLeftWidth: 4, borderLeftColor: '#1a1a1a',
  },
  cancelledBadgeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  cancelledPill: { backgroundColor: '#1a1a1a' },
  pendingPill: { backgroundColor: '#a81d1d' },
  statusPillText: { fontSize: 10, fontWeight: '800', color: '#fff', marginLeft: 4 },
  orderIdText: { fontSize: 11, fontWeight: '600', color: '#888' },
  orderContent: { flexDirection: 'row', marginBottom: 12 },
  productImage: { width: 78, height: 78, borderRadius: 8, backgroundColor: '#f5f5f5' },
  productImagePlaceholder: {
    width: 78, height: 78, borderRadius: 8,
    backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center',
  },
  orderDetails: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },
  productName: {
    fontSize: 15, fontWeight: 'bold', color: '#555',
    textDecorationLine: 'line-through', marginBottom: 3,
  },
  orderInfo: { fontSize: 12, color: '#888', marginBottom: 2 },
  orderPrice: {
    fontSize: 15, fontWeight: 'bold', color: '#aaa',
    textDecorationLine: 'line-through', marginBottom: 2,
  },
  cancelledDate: { fontSize: 11, color: '#a81d1d', fontWeight: '600' },
  reasonBox: {
    backgroundColor: '#fdf2f2', borderRadius: 8, padding: 12,
    marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#a81d1d',
  },
  reasonHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  reasonLabel: { fontSize: 12, fontWeight: '700', color: '#a81d1d', marginLeft: 6 },
  reasonText: { fontSize: 13, color: '#555', lineHeight: 18 },
  addressContainer: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#f8f9fa', padding: 8, borderRadius: 6, marginBottom: 10, opacity: 0.7,
  },
  addressText: { flex: 1, fontSize: 12, color: '#666', marginLeft: 6 },
  orderFooter: {
    borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12, alignItems: 'flex-end',
  },
  reorderButton: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#a81d1d',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  reorderText: { fontSize: 13, fontWeight: '700', color: '#a81d1d', marginLeft: 6 },
});
