import React, { useState, useEffect, useCallback } from 'react';
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
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// The canonical list of order stages
const ORDER_STAGES = [
  { key: 'approved', label: 'Approved' },
  { key: 'in_production', label: 'In Production' },
  { key: 'quality_check', label: 'Quality Check' },
  { key: 'packaging', label: 'Packaging' },
  { key: 'ready_for_delivery', label: 'Ready for Delivery' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

type ProgressLog = {
  [key: string]: string; // stage_key -> ISO timestamp
};

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
  meta?: any;
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
  const [trackingOrder, setTrackingOrder] = useState<OrderItem | null>(null);
  const [progressLog, setProgressLog] = useState<ProgressLog>({});
  const [trackingLoading, setTrackingLoading] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  // Real-time subscription to order updates
  useEffect(() => {
    const channel = supabase
      .channel('order-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_items' },
        (payload) => {
          setOrders((prev) =>
            prev.map((o) =>
              o.id === payload.new.id ? { ...o, ...payload.new } : o
            )
          );
          // If this is the currently tracked order, refresh log
          if (trackingOrder && payload.new.id === trackingOrder.id) {
            const updated = { ...trackingOrder, ...payload.new };
            setTrackingOrder(updated);
            setProgressLog(buildProgressLog(updated));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [trackingOrder]);

  const loadOrders = async () => {
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
          order_progress,
          payment_status,
          created_at,
          updated_at,
          delivery_address,
          special_instructions,
          meta,
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

  /** Build a progress log: merge meta.progress_log + backfill stages up to current */
  const buildProgressLog = (order: any): ProgressLog => {
    let log: ProgressLog = {};

    // 1. Pull any explicitly stored per-stage timestamps from meta
    if (order.meta?.progress_log && typeof order.meta.progress_log === 'object') {
      log = { ...order.meta.progress_log };
    }

    // 2. Figure out which stage is current
    const raw = (
      order.order_progress ||
      order.order_status ||
      order.status ||
      ''
    ).toLowerCase().replace(/[_\s-]+/g, '_');

    let currentIdx = ORDER_STAGES.findIndex((s) => s.key === raw);
    if (currentIdx < 0) {
      currentIdx = ORDER_STAGES.findIndex((s) =>
        raw.includes(s.key.replace(/_/g, '')) ||
        s.key.replace(/_/g, '').includes(raw.replace(/_/g, '')) ||
        s.label.toLowerCase().replace(/[\s-]+/g, '_') === raw
      );
    }

    // 3. Backfill all stages up to and including currentIdx with order timestamps
    if (currentIdx >= 0) {
      for (let i = 0; i <= currentIdx; i++) {
        const key = ORDER_STAGES[i].key;
        if (!log[key]) {
          // Use updated_at for the current stage, created_at for prior ones
          log[key] = i === currentIdx
            ? (order.updated_at || order.created_at)
            : (order.created_at || order.updated_at);
        }
      }
    }

    return log;
  };

  /** @deprecated Use buildProgressLog instead */
  const parseProgressLog = buildProgressLog;


  const openTracking = async (order: OrderItem) => {
    setTrackingLoading(true);
    setTrackingOrder(order);
    try {
      // Fetch fresh data for this order
      const { data, error } = await supabase
        .from('user_items')
        .select('*')
        .eq('id', order.id)
        .single();
      if (!error && data) {
        const merged = { ...order, ...data, product: order.product }; // preserve product join
        setTrackingOrder(merged);
        setProgressLog(buildProgressLog(merged));
      } else {
        setProgressLog(buildProgressLog(order));
      }
    } catch {
      setProgressLog(buildProgressLog(order));
    } finally {
      setTrackingLoading(false);
    }
  };

  /** Map any status string to a stage index — handles null, 'pending', alternate casing etc. */
  const getCurrentStageIndex = (order: OrderItem): number => {
    const raw = (
      order.order_progress ||
      order.order_status ||
      order.status ||
      ''
    ).toLowerCase().replace(/[_\s-]+/g, '_');

    // Exact key match first
    const exact = ORDER_STAGES.findIndex((s) => s.key === raw);
    if (exact >= 0) return exact;

    // Fuzzy substring match (handles 'Ready for Delivery' → 'ready_for_delivery' variants)
    const fuzzy = ORDER_STAGES.findIndex((s) =>
      raw.includes(s.key.replace(/_/g, '')) ||
      s.key.replace(/_/g, '').includes(raw.replace(/_/g, '')) ||
      s.label.toLowerCase().replace(/[\s-]+/g, '_') === raw
    );
    return fuzzy;
  };

  const getStageTimestamp = (stageKey: string, log: ProgressLog): string | null => {
    return log[stageKey] || null;
  };

  const isStageCompleted = (stageIdx: number, currentIdx: number): boolean => {
    return currentIdx >= stageIdx;
  };

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString('en-US', {
        month: 'numeric', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
      });
    } catch {
      return ts;
    }
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
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('approved') || s.includes('accepted')) return '#2d7a2d';
    if (s.includes('production')) return '#b5651d';
    if (s.includes('quality')) return '#7b5ea7';
    if (s.includes('packaging')) return '#1a6ea8';
    if (s.includes('delivery') || s.includes('delivered')) return '#0e7490';
    if (s.includes('pending')) return '#6b7280';
    return '#a81d1d';
  };

  const getOrderStatusText = (order: OrderItem) => {
    if (order.order_progress) return order.order_progress.replace(/_/g, ' ');
    if (order.order_status) return order.order_status.replace(/_/g, ' ');
    return 'Pending';
  };

  // ─── ORDER TRACKING MODAL ───────────────────────────────────────────────
  const renderTrackingModal = () => {
    if (!trackingOrder) return null;
    const currentIdx = getCurrentStageIndex(trackingOrder);

    return (
      <Modal
        visible={!!trackingOrder}
        animationType="slide"
        transparent
        onRequestClose={() => setTrackingOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1 }}
            onPress={() => setTrackingOrder(null)}
          />
          <View style={styles.trackingModal}>
            {/* Header */}
            <View style={styles.trackingHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.trackingTitle}>
                  Order Progress <Text style={{ fontWeight: '400', fontSize: 13, color: '#888' }}>• {trackingOrder.id.substring(0, 8).toUpperCase()}...</Text>
                </Text>
              </View>
              <TouchableOpacity onPress={() => setTrackingOrder(null)} style={styles.headerXIcon}>
                <Ionicons name="close" size={20} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                {/* Product card */}
                <View style={styles.trackingProductCard}>
                  {trackingOrder.product?.image1 ? (
                    <Image source={{ uri: trackingOrder.product.image1 }} style={styles.trackingProductImg} resizeMode="cover" />
                  ) : (
                    <View style={[styles.trackingProductImg, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="image-outline" size={28} color="#bbb" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trackingProductName} numberOfLines={2}>
                      {trackingOrder.product?.name || 'Product'}
                    </Text>
                    <Text style={styles.trackingProductStatus}>
                      Status: {getOrderStatusText(trackingOrder)}
                    </Text>
                  </View>
                </View>

                {/* Progress bar info */}
                <View style={styles.progressHeaderRow}>
                  <Text style={styles.progressLabel}>Production Progress</Text>
                  <Text style={styles.progressPctText}>
                    {currentIdx < 0 ? '0' : Math.round(((currentIdx + 1) / ORDER_STAGES.length) * 100)}%
                  </Text>
                </View>

                <View style={styles.progressBarTrack}>
                  <View style={[
                    styles.progressBarFill,
                    {
                      width: `${currentIdx < 0 ? 0 : Math.min(100, ((currentIdx + 1) / ORDER_STAGES.length) * 100)}%`
                    }
                  ]} />
                </View>

                <Text style={styles.progressNote}>Only team-leader approved updates appear here.</Text>

                {trackingLoading ? (
                  <ActivityIndicator size="small" color="#a81d1d" style={{ marginVertical: 24 }} />
                ) : (
                  /* Timeline */
                  <View style={styles.timeline}>
                    {ORDER_STAGES.map((stage, idx) => {
                      const done = isStageCompleted(idx, currentIdx);
                      const ts = getStageTimestamp(stage.key, progressLog);

                      return (
                        <View key={stage.key} style={styles.timelineRow}>
                          <View style={styles.timelineLeft}>
                            <View style={[
                              styles.timelineCircle,
                              done ? styles.timelineCircleDone : styles.timelineCirclePending
                            ]}>
                              {done ? (
                                <Ionicons name="checkmark" size={14} color="#fff" />
                              ) : (
                                <Text style={styles.timelineStepNum}>{idx + 1}</Text>
                              )}
                            </View>
                            {idx < ORDER_STAGES.length - 1 && (
                              <View style={[styles.timelineLine, done && isStageCompleted(idx + 1, currentIdx) ? styles.timelineLineDone : {}]} />
                            )}
                          </View>

                          <View style={styles.timelineContent}>
                            <Text style={[
                              styles.timelineLabel,
                              done ? styles.timelineLabelDone : styles.timelineLabelPending
                            ]}>
                              {stage.label}
                            </Text>

                            {done ? (
                              <Text style={styles.timelineTimestamp}>
                                {ts ? formatTimestamp(ts) : formatDate(trackingOrder.updated_at || trackingOrder.created_at)}
                              </Text>
                            ) : (
                              <Text style={styles.timelinePending}>Pending</Text>
                            )}

                            {stage.key === 'in_production' && done && (
                              <View style={styles.productionNote}>
                                <Text style={styles.productionNoteTitle}>Production Updates</Text>
                                <Text style={styles.productionNoteText}>
                                  {trackingOrder.meta?.production_update || 'No approved updates yet.'}
                                </Text>
                              </View>
                            )}
                            <View style={{ height: 16 }} />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            </View>

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setTrackingOrder(null)}>
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
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
            <Text style={styles.emptyText}>You don&apos;t have any orders in progress.</Text>
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
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.order_progress || order.status) }]}>
                    <Text style={styles.statusBadgeText}>{getOrderStatusText(order).toUpperCase()}</Text>
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

                <View style={styles.orderFooter}>
                  <TouchableOpacity
                    style={styles.trackButton}
                    onPress={() => openTracking(order)}
                  >
                    <Ionicons name="navigate" size={16} color="#fff" />
                    <Text style={styles.trackButtonText}>Track Order</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {renderTrackingModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#a81d1d', paddingHorizontal: 16, paddingVertical: 12,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4,
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
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  shopButton: { backgroundColor: '#a81d1d', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 8 },
  shopButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  ordersContainer: { padding: 16 },
  orderCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3,
  },
  orderHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  orderIdContainer: { flexDirection: 'row', alignItems: 'center' },
  orderIdLabel: { fontSize: 12, color: '#666', marginRight: 6 },
  orderIdText: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
  orderContent: { flexDirection: 'row', marginBottom: 12 },
  productImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#f5f5f5' },
  productImagePlaceholder: {
    width: 80, height: 80, borderRadius: 8,
    backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center',
  },
  orderDetails: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },
  productName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  orderInfo: { fontSize: 13, color: '#666', marginBottom: 2 },
  orderPrice: { fontSize: 16, fontWeight: 'bold', color: '#a81d1d', marginBottom: 2 },
  orderDate: { fontSize: 11, color: '#999' },
  addressContainer: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#f8f9fa', padding: 8, borderRadius: 6, marginBottom: 8,
  },
  addressText: { flex: 1, fontSize: 12, color: '#666', marginLeft: 6 },
  orderFooter: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 12 },
  trackButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#a81d1d', paddingVertical: 10, borderRadius: 8, gap: 6,
  },
  trackButtonText: { color: '#fff', fontWeight: '700', fontSize: 14, marginLeft: 6 },

  // ─── Tracking Modal Styles ────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  trackingModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    width: '100%',
  },
  trackingHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  trackingTitle: { fontSize: 17, fontWeight: '700', color: '#111' },
  headerXIcon: { padding: 4 },

  trackingProductCard: {
    flexDirection: 'row', alignItems: 'center',
    margin: 16, padding: 16, borderRadius: 8,
    borderWidth: 1, borderColor: '#eee', backgroundColor: '#fff',
    // Shadow for the card
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2,
  },
  trackingProductImg: { width: 64, height: 64, borderRadius: 4, marginRight: 16 },
  trackingProductName: { fontSize: 15, fontWeight: '700', color: '#222', flex: 1 },
  trackingProductStatus: { fontSize: 13, color: '#666', marginTop: 4 },

  progressHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 8
  },
  progressLabel: { fontSize: 14, fontWeight: '700', color: '#111' },
  progressPctText: { fontSize: 14, fontWeight: '700', color: '#111' },

  progressBarTrack: {
    height: 8, backgroundColor: '#e5e7eb', borderRadius: 4,
    marginHorizontal: 16, overflow: 'hidden', marginBottom: 10
  },
  progressBarFill: { height: '100%', backgroundColor: '#8B1C1C', borderRadius: 4 },
  progressNote: { fontSize: 12, color: '#999', paddingHorizontal: 16, marginBottom: 24 },

  timeline: { paddingHorizontal: 24 },
  timelineRow: { flexDirection: 'row' },
  timelineLeft: { alignItems: 'center', width: 32 },
  timelineCircle: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    zIndex: 2,
  },
  timelineCircleDone: { backgroundColor: '#8B1C1C' },
  timelineCirclePending: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc',
  },
  timelineStepNum: { fontSize: 12, color: '#999', fontWeight: 'bold' },
  timelineLine: {
    width: 1.5, position: 'absolute', top: 28, bottom: 0,
    backgroundColor: '#eee', left: 13.5, zIndex: 1
  },
  timelineLineDone: { backgroundColor: '#8B1C1C' },

  timelineContent: { flex: 1, paddingLeft: 16 },
  timelineLabel: { fontSize: 15, fontWeight: '700' },
  timelineLabelDone: { color: '#000' },
  timelineLabelPending: { color: '#999' },
  timelineTimestamp: { fontSize: 12, color: '#666', marginTop: 4 },
  timelinePending: { fontSize: 12, color: '#999', marginTop: 4 },

  productionNote: {
    backgroundColor: '#fff', borderRadius: 4,
    paddingVertical: 8, marginTop: 8,
  },
  productionNoteTitle: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 2 },
  productionNoteText: { fontSize: 12, color: '#666' },

  closeModalBtn: {
    margin: 16, backgroundColor: '#000',
    paddingVertical: 14, borderRadius: 8, alignItems: 'center',
  },
  closeModalBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
