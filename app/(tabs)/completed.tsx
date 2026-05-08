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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';
import { useModal } from '@/hooks/useModal';
import { useAppContext } from '@/context/AppContext';

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
    name?: string;
    image1?: string;
    category?: string;
  };
  products?: {
    name?: string;
    image1?: string;
    category?: string;
  } | null;
};

export default function CompletedOrdersScreen() {
  const { darkMode } = useAppContext();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const modal = useModal();
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCompletedOrders();
  }, []);

  const getJoinedProduct = (orderLike: any) => {
    const joined = orderLike?.product ?? orderLike?.products;
    if (Array.isArray(joined)) return joined[0] ?? null;
    return joined ?? null;
  };

  const getDisplayProductName = (order: CompletedOrder) => {
    const joined = getJoinedProduct(order);
    const name = String(joined?.name || '').trim();
    if (name) return name;

    const rawCode = String(order.product_id || '').trim();
    if (rawCode) return `GE-${rawCode.substring(0, 8).toUpperCase()}`;

    return 'Product';
  };

  const loadCompletedOrders = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        modal.showError('Error', 'Please sign in to view orders.');
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

      const rows = (data || []) as any[];
      const missingProductIds = Array.from(
        new Set(
          rows
            .filter((row) => !getJoinedProduct(row)?.name && row?.product_id)
            .map((row) => String(row.product_id))
        )
      );

      let fallbackMap = new Map<string, { name?: string; image1?: string; category?: string }>();
      if (missingProductIds.length > 0) {
        const { data: fallbackProducts } = await supabase
          .from('products')
          .select('id, name, image1, category')
          .in('id', missingProductIds);

        fallbackMap = new Map(
          (fallbackProducts || []).map((p: any) => [String(p.id), { name: p.name, image1: p.image1, category: p.category }])
        );
      }

      setOrders(
        rows.map((item: any) => ({
          ...item,
          product: getJoinedProduct(item) || fallbackMap.get(String(item.product_id)) || null,
        }))
      );
    } catch (error: any) {
      console.error('Failed to load completed orders:', error);
      modal.showError('Error', 'Failed to load completed orders. Please try again.');
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

  const handleOrderAgain = async (order: CompletedOrder) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        modal.showInfo('Login Required', 'Please sign in to add this item back to your cart.');
        return;
      }

      if (!order.product_id) {
        modal.showError('Error', 'This completed order is missing product information.');
        return;
      }

      const { data: productRow, error: productErr } = await supabase
        .from('products')
        .select('inventory')
        .eq('id', order.product_id)
        .maybeSingle();

      if (productErr) throw productErr;

      const currentStock = Number(productRow?.inventory ?? 0);
      if (!Number.isFinite(currentStock) || currentStock <= 0) {
        modal.showInfo('Out of Stock', 'This product is currently out of stock and cannot be reordered.');
        return;
      }

      const qtyToAdd = Math.max(1, Number(order.quantity) || 1);

      const { data: existing, error: selErr } = await supabase
        .from('cart')
        .select('id, quantity')
        .eq('user_id', authData.user.id)
        .eq('product_id', order.product_id)
        .maybeSingle();

      if (selErr) throw selErr;

      if (existing?.id) {
        const nextQty = (existing.quantity ?? 1) + qtyToAdd;
        const { error: updErr } = await supabase
          .from('cart')
          .update({
            quantity: nextQty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from('cart').insert([{
          user_id: authData.user.id,
          product_id: order.product_id,
          quantity: qtyToAdd,
          meta: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

        if (insErr) throw insErr;
      }

      // Keep reorder UX successful even if order-row status fields are constrained in DB.
      // Some deployments reject custom status values (e.g., "reordered") with 235xx errors.
      const { error: archiveErr } = await supabase
        .from('user_items')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('user_id', authData.user.id)
        .eq('item_type', 'order');

      if (archiveErr) {
        console.warn('Non-blocking reorder order-row update failed:', archiveErr);
      }

      modal.showSuccess(
        'Added to Cart',
        `${getDisplayProductName(order)} has been added back to your cart.`,
        () => router.push('../cart')
      );
    } catch (error: any) {
      console.error('Failed to reorder completed order:', error);
      modal.showError('Error', 'Failed to add this item back to your cart. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#101010' : '#f5f5f5' }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Completed Orders</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a81d1d" />
          <Text style={[styles.loadingText, { color: darkMode ? '#b0b0b0' : '#666' }]}>Loading completed orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#101010' : '#f5f5f5' }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Completed Orders</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={[styles.scrollView, { backgroundColor: darkMode ? '#101010' : '#f5f5f5' }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#a81d1d']} />}
      >
        {orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconWrap, { backgroundColor: darkMode ? '#231616' : '#fce8e8' }]}>
              <Feather name="check-circle" size={54} color="#a81d1d" />
            </View>
            <Text style={[styles.emptyTitle, { color: darkMode ? '#f1f1f1' : '#1a1a1a' }]}>No Completed Orders</Text>
            <Text style={[styles.emptyText, { color: darkMode ? '#b0b0b0' : '#666' }]}>You haven&apos;t completed any orders yet.</Text>
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
              <Text style={[styles.sectionTitle, { color: darkMode ? '#f1f1f1' : '#1a1a1a' }]}>{orders.length} Completed Order{orders.length !== 1 ? 's' : ''}</Text>
            </View>

            {orders.map((order) => (
              <View key={order.id} style={[styles.orderCard, { backgroundColor: darkMode ? '#1a1a1a' : '#fff', borderBottomColor: darkMode ? '#2d2d2d' : '#fff' }]}>
                {/* Top badge */}
                <View style={styles.completedBadgeContainer}>
                  <View style={styles.deliveredPill}>
                    <Feather name="check-circle" size={13} color="#fff" />
                    <Text style={styles.deliveredPillText}>DELIVERED</Text>
                  </View>
                  <Text style={[styles.orderIdText, { color: darkMode ? '#a0a0a0' : '#888' }]}>#{order.id.substring(0, 8).toUpperCase()}</Text>
                </View>

                <View style={styles.orderContent}>
                  {getJoinedProduct(order)?.image1 ? (
                    <Image source={{ uri: String(getJoinedProduct(order)?.image1) }} style={styles.productImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.productImagePlaceholder, { backgroundColor: darkMode ? '#252525' : '#f5f5f5' }]}>
                      <Ionicons name="image-outline" size={32} color={darkMode ? '#787878' : '#bbb'} />
                    </View>
                  )}
                  <View style={styles.orderDetails}>
                    <Text style={[styles.productName, { color: darkMode ? '#f1f1f1' : '#1a1a1a' }]} numberOfLines={2}>
                      {getDisplayProductName(order)}
                    </Text>
                    {!!getJoinedProduct(order)?.category && (
                      <Text style={[styles.orderInfo, { color: darkMode ? '#9c9c9c' : '#888' }]} numberOfLines={1}>
                        {String(getJoinedProduct(order)?.category)}
                      </Text>
                    )}
                    <Text style={[styles.orderInfo, { color: darkMode ? '#b0b0b0' : '#777' }]}>Qty: {order.quantity}</Text>
                    <Text style={styles.orderPrice}>{formatCurrency(order.total_amount || order.price * order.quantity)}</Text>
                    <Text style={[styles.completedDate, { color: darkMode ? '#c8c8c8' : '#555' }]}>
                      Completed: {formatDate(order.updated_at || order.created_at)}
                    </Text>
                  </View>
                </View>

                {order.delivery_address && (
                  <View style={[styles.addressContainer, { backgroundColor: darkMode ? '#221919' : '#fdf2f2' }]}>
                    <Ionicons name="location" size={14} color="#a81d1d" />
                    <Text style={[styles.addressText, { color: darkMode ? '#d2d2d2' : '#555' }]} numberOfLines={2}>
                      {order.delivery_address}
                    </Text>
                  </View>
                )}

                <View style={[styles.orderFooter, { borderTopColor: darkMode ? '#303030' : '#f0f0f0' }]}>
                  <TouchableOpacity
                    style={styles.reorderButton}
                    onPress={() => handleOrderAgain(order)}
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
