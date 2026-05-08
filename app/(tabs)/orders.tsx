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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import { useModal } from '@/hooks/useModal';
import { useAppContext } from '@/context/AppContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_COMPACT_INVOICE = SCREEN_WIDTH <= 420;

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

const PAYMONGO_PAYMENT_METHOD = 'paymongo';
const PAYMONGO_STATUS_PAID = 'completed';
const PENDING_PAYMONGO_SYNC_KEY = 'pending_paymongo_order_sync_v1';

type ProgressLog = {
  [key: string]: string; // stage_key -> ISO timestamp
};

type ProductJoin = {
  name?: string | null;
  image1?: string | null;
  category?: string | null;
};

type TaskUpdate = {
  id: string;
  task_id?: string | null;
  description?: string | null;
  image_urls?: string[] | null;
  status?: string | null;
  created_at?: string | null;
};

type OrderItem = {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  total_amount: number;
  reservation_fee?: number | null;
  total_paid?: number | null;
  status: string;
  order_status: string;
  order_progress: string;
  payment_status: string;
  payment_method?: string | null;
  payment_intent_id?: string | null;
  payment_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  created_at: string;
  updated_at: string;
  delivery_address: string;
  special_instructions: string;
  meta?: any;
  product?: ProductJoin | null;
  products?: ProductJoin | ProductJoin[] | null;
};

export default function OrdersScreen() {
  const { darkMode } = useAppContext();
  const router = useRouter();
  const modal = useModal();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trackingOrder, setTrackingOrder] = useState<OrderItem | null>(null);
  const [progressLog, setProgressLog] = useState<ProgressLog>({});
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [taskUpdates, setTaskUpdates] = useState<TaskUpdate[]>([]);
  const [taskUpdatesLoading, setTaskUpdatesLoading] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedUpdateImages, setSelectedUpdateImages] = useState<string[]>([]);
  const [documentModalVisible, setDocumentModalVisible] = useState(false);
  const [documentType, setDocumentType] = useState<'receipt' | 'invoice'>('receipt');
  const [documentOrder, setDocumentOrder] = useState<OrderItem | null>(null);
  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);

  const handleBack = () => {
    router.replace('/(tabs)/profile');
  };

  const getJoinedProduct = (orderLike: any): ProductJoin | null => {
    const joined = orderLike?.product ?? orderLike?.products;
    if (Array.isArray(joined)) return joined[0] ?? null;
    return joined ?? null;
  };

  const getDisplayProductName = (order: OrderItem): string => {
    const joined = getJoinedProduct(order);
    const name = joined?.name?.trim();
    if (name) return name;

    const rawCode = (order.product_id || '').toString().trim();
    if (rawCode) return `GE-${rawCode.substring(0, 8).toUpperCase()}`;

    return 'Product';
  };

  const deductStockForPaidOrderRow = async (orderId: string) => {
    try {
      const { data: row, error: rowErr } = await supabase
        .from('user_items')
        .select('id, product_id, quantity, payment_status, meta')
        .eq('id', orderId)
        .maybeSingle();

      if (rowErr || !row) return;

      const qty = Number(row?.quantity || 0);
      const alreadyDeducted = Boolean(row?.meta?.stock_deducted);
      const paymentStatus = String(row?.payment_status || '').toLowerCase();
      const isPaidOrder = paymentStatus.includes('paid') || paymentStatus.includes('complete');

      if (!row?.product_id || qty <= 0 || alreadyDeducted || !isPaidOrder) {
        return;
      }

      const { data: productRow, error: productErr } = await supabase
        .from('products')
        .select('*')
        .eq('id', row.product_id)
        .single();

      if (productErr || !productRow) {
        return;
      }

      const hasStockColumn = Object.prototype.hasOwnProperty.call(productRow, 'stock');
      const hasInventoryColumn = Object.prototype.hasOwnProperty.call(productRow, 'inventory');
      if (!hasStockColumn && !hasInventoryColumn) {
        return;
      }

      const currentInventory = Number(productRow?.inventory);
      const currentStock = Number(productRow?.stock);
      const rawStock = Number.isFinite(currentInventory)
        ? currentInventory
        : (Number.isFinite(currentStock) ? currentStock : 0);
      const nextStock = Math.max(0, rawStock - qty);

      const nowIso = new Date().toISOString();
      const updatePayload: Record<string, any> = { updated_at: nowIso };
      if (hasStockColumn) updatePayload.stock = nextStock;
      if (hasInventoryColumn) updatePayload.inventory = nextStock;
      if (Object.prototype.hasOwnProperty.call(productRow, 'last_stock_update')) {
        updatePayload.last_stock_update = nowIso;
      }

      const { error: updateErr } = await supabase
        .from('products')
        .update(updatePayload)
        .eq('id', row.product_id);

      if (updateErr) {
        return;
      }

      const mergedMeta = {
        ...(row?.meta || {}),
        stock_deducted: true,
        stock_deducted_at: nowIso,
      };

      await supabase
        .from('user_items')
        .update({
          meta: mergedMeta,
          updated_at: nowIso,
        })
        .eq('id', row.id);
    } catch (e) {
      console.warn('Failed to deduct stock in Orders fallback sync:', e);
    }
  };

  const closeTrackingModal = () => {
    setTrackingOrder(null);
    setTaskUpdates([]);
    setTaskUpdatesLoading(false);
    setImageViewerVisible(false);
    setSelectedUpdateImages([]);
  };

  const openDocument = (order: OrderItem, type: 'receipt' | 'invoice') => {
    setDocumentOrder(order);
    setDocumentType(type);
    setDocumentModalVisible(true);
  };

  const closeDocumentModal = () => {
    setDocumentModalVisible(false);
    setDocumentOrder(null);
  };

  const canRequestCancellation = (order: OrderItem): boolean => {
    const orderStatus = (order.order_status || '').toLowerCase();
    const progress = (order.order_progress || '').toLowerCase();

    if (orderStatus.includes('cancelled')) return false;
    if (orderStatus.includes('pending_cancellation')) return false;
    if (orderStatus.includes('completed')) return false;
    if (progress.includes('delivered')) return false;

    return true;
  };

  const requestCancellation = async (order: OrderItem) => {
    if (!canRequestCancellation(order)) {
      modal.showInfo('Not Allowed', 'This order cannot be cancelled at its current stage.');
      return;
    }

    modal.show({
      type: 'confirmation',
      title: 'Request Order Cancellation',
      message: 'Are you sure you want to request cancellation for this order?',
      buttons: [
        {
          text: 'No',
          style: 'cancel',
          onPress: () => {},
        },
        {
          text: 'Yes, Request',
          style: 'destructive',
          onPress: async () => {
            try {
              const nowIso = new Date().toISOString();
              const existingHistory = Array.isArray(order.meta?.progress_history) ? order.meta.progress_history : [];
              const updatedHistory = [
                ...existingHistory,
                {
                  status: 'pending_cancellation',
                  actor: 'customer',
                  timestamp: nowIso,
                  note: 'Cancellation requested by customer from mobile app',
                },
              ];

              const { error } = await supabase
                .from('user_items')
                .update({
                  order_status: 'pending_cancellation',
                  cancellation_requested_at: nowIso,
                  cancellation_notes: 'Customer requested cancellation from mobile app',
                  meta: {
                    ...(order.meta || {}),
                    progress_history: updatedHistory,
                  },
                  updated_at: nowIso,
                })
                .eq('id', order.id);

              if (error) throw error;

              modal.showSuccess('Request Sent', 'Your cancellation request has been sent for admin review.');
              loadOrders();
            } catch (err: any) {
              console.error('Failed to request cancellation:', err);
              modal.showError('Error', err?.message || 'Failed to request cancellation. Please try again.');
            }
          },
        },
      ],
    });
  };

  const openImageViewer = (images?: string[] | null) => {
    const validImages = (images || []).filter((url) => typeof url === 'string' && url.trim().length > 0);
    if (validImages.length === 0) return;
    setSelectedUpdateImages(validImages);
    setImageViewerVisible(true);
  };

  const fetchApprovedTaskUpdates = async (order: OrderItem): Promise<TaskUpdate[]> => {
    const approvedRows: TaskUpdate[] = [];
    const taskIds = new Set<string>();

    const taskLookupPairs = [
      { col: 'order_id', val: order.id },
      { col: 'user_item_id', val: order.id },
      { col: 'item_id', val: order.id },
      { col: 'product_id', val: order.product_id },
    ];

    // Try different task foreign-key names because schema may vary between deployments.
    for (const pair of taskLookupPairs) {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('id')
          .eq(pair.col, pair.val)
          .limit(20);

        if (!error && data?.length) {
          data.forEach((row: any) => {
            if (row?.id) taskIds.add(String(row.id));
          });
        }
      } catch {
        // Ignore missing columns/tables for compatibility.
      }
    }

    if (taskIds.size > 0) {
      try {
        const { data, error } = await supabase
          .from('task_updates')
          .select('id, task_id, description, image_urls, status, created_at')
          .in('task_id', Array.from(taskIds))
          .eq('status', 'approved')
          .not('image_urls', 'is', null)
          .order('created_at', { ascending: false });

        if (!error && data?.length) {
          approvedRows.push(...(data as TaskUpdate[]));
        }
      } catch {
        // Ignore and attempt direct lookup fallbacks below.
      }
    }

    const directLookupPairs = [
      { col: 'order_id', val: order.id },
      { col: 'user_item_id', val: order.id },
      { col: 'item_id', val: order.id },
      { col: 'product_id', val: order.product_id },
    ];

    for (const pair of directLookupPairs) {
      try {
        const { data, error } = await supabase
          .from('task_updates')
          .select('id, task_id, description, image_urls, status, created_at')
          .eq(pair.col, pair.val)
          .eq('status', 'approved')
          .not('image_urls', 'is', null)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error && data?.length) {
          approvedRows.push(...(data as TaskUpdate[]));
        }
      } catch {
        // Ignore missing columns/tables for compatibility.
      }
    }

    const uniqueMap = new Map<string, TaskUpdate>();
    approvedRows.forEach((row) => {
      if (!row?.id) return;
      const urls = Array.isArray(row.image_urls)
        ? row.image_urls.filter((url) => typeof url === 'string' && url.trim().length > 0)
        : [];
      if (urls.length === 0) return;
      uniqueMap.set(row.id, { ...row, image_urls: urls });
    });

    return Array.from(uniqueMap.values()).sort((a, b) => {
      const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tB - tA;
    });
  };

  const loadApprovedTaskUpdates = async (order: OrderItem) => {
    setTaskUpdatesLoading(true);
    try {
      const updates = await fetchApprovedTaskUpdates(order);
      setTaskUpdates(updates);
    } catch (err) {
      console.error('Failed to load approved task updates:', err);
      setTaskUpdates([]);
    } finally {
      setTaskUpdatesLoading(false);
    }
  };

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
        (payload: { new: { id?: string } & Record<string, any> }) => {
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

  useEffect(() => {
    if (!trackingOrder) return;

    const intervalId = setInterval(() => {
      loadApprovedTaskUpdates(trackingOrder);
    }, 15000);

    return () => clearInterval(intervalId);
  }, [trackingOrder?.id]);

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
          reservation_fee,
          status,
          order_status,
          order_progress,
          payment_status,
          payment_method,
          payment_intent_id,
          payment_id,
          total_paid,
          customer_name,
          customer_email,
          customer_phone,
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
      const normalizedOrders = (data || []).map((item: any) => ({
        ...item,
        quantity: Math.max(1, Number(item?.quantity) || 1),
        price: Number(item?.price) || 0,
        total_amount: Number.isFinite(Number(item?.total_amount))
          ? Number(item?.total_amount)
          : (Number(item?.price) || 0) * Math.max(1, Number(item?.quantity) || 1),
        product: getJoinedProduct(item),
      }));

      const syncedOrders = await syncPendingPaymongoOrders(normalizedOrders, authData.user.id);
      setOrders(syncedOrders);
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

  const isPaymongoUnpaidOrder = (order: OrderItem) => {
    const paymentStatus = String(order.payment_status || '').toLowerCase();
    const paymentMethod = String(order.payment_method || '').toLowerCase();
    const orderStatus = String(order.order_status || '').toLowerCase();

    const isCancelled = orderStatus.includes('cancelled');
    const isCompleted = orderStatus.includes('completed');
    const isPaid = paymentStatus.includes('paid') && !paymentStatus.includes('not paid');
    const isUnpaid =
      paymentStatus.includes('not paid') ||
      paymentStatus.includes('pending') ||
      paymentStatus.includes('awaiting');
    const isPaymongo = paymentMethod.includes('paymongo') || String(order.payment_intent_id || '').startsWith('cs_');

    return !isCancelled && !isCompleted && !isPaid && isUnpaid && isPaymongo;
  };

  const savePendingPaymongoSyncRecord = async (userId: string, orderId: string, sessionId: string) => {
    try {
      const raw = await AsyncStorage.getItem(PENDING_PAYMONGO_SYNC_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const keep = Array.isArray(existing)
        ? existing.filter((r: any) => !(String(r?.userId || '') === userId && String(r?.orderId || '') === orderId))
        : [];

      const next = [
        ...keep,
        {
          userId,
          orderId,
          sessionId,
          createdAt: new Date().toISOString(),
        },
      ];

      await AsyncStorage.setItem(PENDING_PAYMONGO_SYNC_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to save pending PayMongo sync record:', e);
    }
  };

  const retryPaymongoPayment = async (order: OrderItem) => {
    try {
      setRetryingOrderId(order.id);

      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        modal.showWarning('Login Required', 'Please sign in to continue.');
        return;
      }

      const extra = (Constants.expoConfig?.extra as Record<string, any> | undefined) || {};
      const paymongoSecretKey = String(extra.paymongoSecretKey || '').trim();
      const paymongoReturnUrl = String(extra.paymongoReturnUrl || 'grandlinkmobile://payment-success').trim();
      const paymongoCancelUrl = String(extra.paymongoCancelUrl || 'grandlinkmobile://shop').trim();
      const paymongoApi = 'https://api.paymongo.com/v1/checkout_sessions';

      if (!paymongoSecretKey) {
        modal.showError('Payment Error', 'PayMongo key is not configured in app settings.');
        return;
      }

      const totalAmount = Number(order.total_amount || (order.price * order.quantity) || 0);
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        modal.showError('Payment Error', 'Order amount is invalid. Please contact support.');
        return;
      }

      const checkoutData = {
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            line_items: [
              {
                currency: 'PHP',
                amount: Math.round(totalAmount * 100),
                name: getDisplayProductName(order),
                quantity: 1,
                description: `Retry payment for Order ${order.id.substring(0, 8).toUpperCase()}`,
              },
            ],
            payment_method_types: ['qrph'],
            description: `Retry payment for order ${order.id}`,
            reference_number: `GE-RETRY-${order.id.substring(0, 8).toUpperCase()}-${Date.now()}`,
            success_url: paymongoReturnUrl,
            cancel_url: paymongoCancelUrl,
            metadata: {
              source: 'mobile_retry',
              order_id: order.id,
              user_id: authData.user.id,
            },
          },
        },
      };

      const response = await fetch(paymongoApi, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${btoa(paymongoSecretKey + ':')}`,
        },
        body: JSON.stringify(checkoutData),
      });

      const result = await response.json();
      const checkoutUrl = result?.data?.attributes?.checkout_url;
      const sessionId = result?.data?.id;

      if (!checkoutUrl || !sessionId) {
        const errorMsg = result?.errors?.[0]?.detail || 'Failed to create PayMongo checkout session.';
        modal.showError('Payment Error', errorMsg);
        return;
      }

      const previousSessions = Array.isArray(order?.meta?.previous_payment_sessions)
        ? order.meta.previous_payment_sessions
        : [];

      const nextMeta = {
        ...(order.meta || {}),
        payment_session_id: sessionId,
        previous_payment_sessions: [
          ...previousSessions,
          {
            session_id: order?.meta?.payment_session_id || order.payment_intent_id || null,
            replaced_at: new Date().toISOString(),
          },
        ],
      };

      const { error: updateError } = await supabase
        .from('user_items')
        .update({
          payment_method: PAYMONGO_PAYMENT_METHOD,
          payment_status: 'not paid - paymongo',
          payment_intent_id: sessionId,
          meta: nextMeta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (updateError) {
        modal.showError('Payment Error', `Failed to update order session: ${updateError.message}`);
        return;
      }

      await savePendingPaymongoSyncRecord(authData.user.id, order.id, sessionId);

      const canOpen = await Linking.canOpenURL(checkoutUrl);
      if (!canOpen) {
        modal.showError('Payment Error', 'Unable to open PayMongo checkout URL.');
        return;
      }

      await Linking.openURL(checkoutUrl);
    } catch (error: any) {
      console.error('Failed to retry PayMongo payment:', error);
      modal.showError('Payment Error', error?.message || 'Failed to retry payment.');
    } finally {
      setRetryingOrderId(null);
    }
  };

  const syncPendingPaymongoOrders = async (items: OrderItem[], userId: string): Promise<OrderItem[]> => {
    const extra = (Constants.expoConfig?.extra as Record<string, any> | undefined) || {};
    const paymongoSecretKey = String(extra.paymongoSecretKey || '').trim();
    if (!paymongoSecretKey) return items;

    console.log('🔍 [ORDERS-FALLBACK-SYNC] Starting fallback sync for', items.length, 'orders');

    const rawPending = await AsyncStorage.getItem(PENDING_PAYMONGO_SYNC_KEY);
    const pendingRecords = rawPending ? JSON.parse(rawPending) : [];
    const pendingSessionByOrderId = new Map<string, string>();

    if (Array.isArray(pendingRecords)) {
      pendingRecords
        .filter((r: any) => r?.userId === userId)
        .forEach((r: any) => {
          const oid = String(r?.orderId || '').trim();
          const sid = String(r?.sessionId || '').trim();
          if (oid && sid) pendingSessionByOrderId.set(oid, sid);
        });
    }

    const candidates = items.filter((item) => {
      const paymentStatus = String(item.payment_status || '').toLowerCase();
      const paymentMethod = String(item.payment_method || '').toLowerCase();
      const metaSession = String(item?.meta?.payment_session_id || '').toLowerCase();
      const pendingSession = String(pendingSessionByOrderId.get(String(item.id)) || '').toLowerCase();
      const hasCheckoutSession =
        String(item.payment_intent_id || '').toLowerCase().startsWith('cs_') ||
        metaSession.startsWith('cs_') ||
        pendingSession.startsWith('cs_');
      const isCandidate =
        (paymentStatus.includes('not paid') || paymentStatus.includes('pending')) &&
        (paymentMethod.includes('paymongo') || hasCheckoutSession) &&
        !!(item.payment_intent_id || item?.meta?.payment_session_id || pendingSessionByOrderId.get(String(item.id)));
      
      if (isCandidate) {
        console.log('📝 [ORDERS-FALLBACK-SYNC] Found unpaid PayMongo order:', item.id, 'status:', item.payment_status);
      }
      return isCandidate;
    });

    if (candidates.length === 0) {
      console.log('👋 [ORDERS-FALLBACK-SYNC] No unpaid PayMongo orders to sync');
      return items;
    }

    console.log('🔄 [ORDERS-FALLBACK-SYNC] Attempting to sync', candidates.length, 'unpaid PayMongo orders');

    const updatedById: Record<string, Partial<OrderItem>> = {};

    for (const order of candidates) {
      try {
        const sessionId = String(
          order?.meta?.payment_session_id ||
          pendingSessionByOrderId.get(String(order.id)) ||
          order.payment_intent_id ||
          ''
        ).trim();
        if (!sessionId) continue;

        const verifyResp = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${btoa(paymongoSecretKey + ':')}`,
          },
        });

        const verifyJson = await verifyResp.json();
        const attrs = verifyJson?.data?.attributes || {};
        const statusText = String(attrs?.payment_status || attrs?.status || '').toLowerCase();
        const paymentIntentStatus = String(
          attrs?.payment_intent?.data?.attributes?.status ||
          attrs?.payment_intent?.attributes?.status ||
          ''
        ).toLowerCase();
        const hasPaidFlag = attrs?.paid === true;
        const payments = Array.isArray(attrs?.payments) ? attrs.payments : [];
        const hasPaidPayment = payments.some((p: any) =>
          (() => {
            const paymentStatus = String(p?.attributes?.status || p?.status || '').toLowerCase();
            return (
              paymentStatus.includes('paid') ||
              paymentStatus.includes('succeed') ||
              paymentStatus.includes('success')
            );
          })()
        );

        const isPaid =
          hasPaidFlag ||
          hasPaidPayment ||
          statusText.includes('paid') ||
          statusText.includes('succeeded') ||
          statusText.includes('success') ||
          paymentIntentStatus.includes('paid') ||
          paymentIntentStatus.includes('succeed') ||
          paymentIntentStatus.includes('success');

        if (!isPaid) continue;

        console.log('✅ [ORDERS-FALLBACK-SYNC] PayMongo session', sessionId, 'is PAID. Updating order row', order.id);

        const amountFromPayment = Number(payments?.[0]?.attributes?.amount ?? 0);
        const amountFromSession = Number(attrs?.amount ?? 0);
        const paidAmount = amountFromPayment > 0
          ? amountFromPayment / 100
          : (amountFromSession > 0 ? amountFromSession / 100 : null);
        const paymentReferenceId = String(
          payments?.[0]?.id ||
          attrs?.payment_intent?.data?.id ||
          attrs?.payment_intent?.id ||
          sessionId
        ).trim();

        const existingOrderStatus = String(order.order_status || '').toLowerCase();
        const keepExistingStatus =
          existingOrderStatus.includes('approved') ||
          existingOrderStatus.includes('production') ||
          existingOrderStatus.includes('quality') ||
          existingOrderStatus.includes('packaging') ||
          existingOrderStatus.includes('delivery') ||
          existingOrderStatus.includes('completed') ||
          existingOrderStatus.includes('cancelled');

        const nextOrderStatus = keepExistingStatus ? order.order_status : 'pending_payment';

        const paidPayload: Record<string, any> = {
          payment_status: PAYMONGO_STATUS_PAID,
          order_status: nextOrderStatus,
          payment_method: PAYMONGO_PAYMENT_METHOD,
          payment_intent_id: paymentReferenceId,
          payment_id: paymentReferenceId,
          updated_at: new Date().toISOString(),
        };

        if (paidAmount && !Number.isNaN(paidAmount)) {
          paidPayload.total_paid = paidAmount;
        }

        console.log('📝 [ORDERS-FALLBACK-SYNC] Writing payload to row', order.id, ':', JSON.stringify(paidPayload));
        const { data: updatedRow, error: updateError } = await supabase
          .from('user_items')
          .update(paidPayload)
          .eq('id', order.id)
          .select('id, payment_status, payment_intent_id, payment_id, order_status')
          .maybeSingle();

        if (!updateError && updatedRow?.id) {
          console.log('✅ [ORDERS-FALLBACK-SYNC] Row', order.id, 'updated successfully -> payment_status:', updatedRow.payment_status, '| payment_intent_id:', updatedRow.payment_intent_id, '| payment_id:', updatedRow.payment_id);
          updatedById[order.id] = {
            payment_status: updatedRow.payment_status || PAYMONGO_STATUS_PAID,
            order_status: updatedRow.order_status || nextOrderStatus,
            payment_method: PAYMONGO_PAYMENT_METHOD,
            payment_intent_id: updatedRow.payment_intent_id || paymentReferenceId,
          };

          await deductStockForPaidOrderRow(order.id);

          // Clear successful pending context for this order.
          if (pendingSessionByOrderId.has(String(order.id))) {
            const nextPending = Array.isArray(pendingRecords)
              ? pendingRecords.filter((r: any) => String(r?.orderId || '') !== String(order.id))
              : [];
            await AsyncStorage.setItem(PENDING_PAYMONGO_SYNC_KEY, JSON.stringify(nextPending));
          }
        } else if (!updateError) {
          console.warn('❌ [ORDERS-FALLBACK-SYNC] No DB row returned for order:', order.id, 'but update succeeded. May need manual refresh.');
        } else if (updateError) {
          console.error('❌ [ORDERS-FALLBACK-SYNC] Update failed for order', order.id, ':', updateError.message);
        }
      } catch (syncErr) {
        console.error('Failed to sync pending PayMongo order in Orders screen:', syncErr);
      }
    }

    if (Object.keys(updatedById).length === 0) return items;

    return items.map((item) => ({
      ...item,
      ...(updatedById[item.id] || {}),
    }));
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
    setTaskUpdates([]);
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
        await loadApprovedTaskUpdates(merged);
      } else {
        setProgressLog(buildProgressLog(order));
        await loadApprovedTaskUpdates(order);
      }
    } catch {
      setProgressLog(buildProgressLog(order));
      await loadApprovedTaskUpdates(order);
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
        hour: 'numeric', minute: '2-digit', hour12: true,
        timeZone: 'Asia/Manila',
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
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Manila',
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

  const getOrderStatusBadgeText = (order: OrderItem) => {
    return getOrderStatusText(order).toUpperCase();
  };

  const getOrderStatusBadgeColor = (order: OrderItem) => {
    const status = order.order_progress || order.order_status || order.status || 'pending';
    return getStatusColor(status);
  };

  const getPaymentStatusText = (payment_status: string) => {
    if (!payment_status) return 'Awaiting Payment';
    const status = payment_status.toLowerCase().trim();
    if (status.includes('not paid')) {
      if (status.includes('paymongo')) {
        return 'NOT PAID - PAYMONGO';
      }
      return 'NOT PAID';
    }
    if (status.includes('paid')) {
      if (status.includes('paymongo')) {
        return 'PAID - PAYMONGO';
      }
      return 'PAID';
    }
    if (status.includes('pending')) {
      return 'Awaiting Payment';
    }
    return payment_status.replace(/_/g, ' ').toUpperCase();
  };

  const getPaymentStatusColor = (payment_status: string) => {
    if (!payment_status) return '#FFA500';
    const status = payment_status.toLowerCase().trim();
    if (status.includes('not paid')) return '#cb2431'; // Red for not paid
    if (status.includes('paid')) return '#22863a'; // Green for paid
    return '#6f42c1'; // Purple for pending
  };

  const getOrderPaymentReference = (order: OrderItem) => {
    const ref = String(order.payment_id || order.payment_intent_id || '').trim();
    return ref || 'N/A';
  };

  const getOrderPaidAmount = (order: OrderItem) => {
    const explicitPaid = Number(order.total_paid ?? NaN);
    if (Number.isFinite(explicitPaid) && explicitPaid > 0) return explicitPaid;
    return Number(order.total_amount || (order.price * order.quantity) || 0);
  };

  const getInvoiceNumber = (order: OrderItem) => {
    const d = new Date(order.created_at || Date.now());
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `GL-${yyyy}${mm}${dd}-${order.id.substring(0, 8).toUpperCase()}`;
  };

  const getFormattedDeliveryAddress = (order: OrderItem) => {
    const detailed = order?.meta?.detailed_address;
    if (detailed && typeof detailed === 'object') {
      const parts = [
        detailed.street,
        detailed.addressLine2,
        detailed.city,
        detailed.stateRegion,
        detailed.zipCode,
      ]
        .map((v: any) => String(v || '').trim())
        .filter(Boolean);
      if (parts.length) return parts.join(', ');
    }
    return String(order.delivery_address || 'N/A');
  };

  const getInvoiceTotals = (order: OrderItem) => {
    const subtotal = Number(order.total_amount || (order.price * order.quantity) || 0);
    const addOns = Number(order?.meta?.add_ons?.color_customization?.price || 0);
    const discount = Number(order?.meta?.discount?.amount || 0);
    const deliveryFee = Number(order.reservation_fee || 0);
    const paidTotal = Number(getOrderPaidAmount(order) || 0);
    const computed = subtotal + addOns - discount + deliveryFee;

    return {
      subtotal,
      addOns,
      discount,
      deliveryFee,
      total: paidTotal > 0 ? paidTotal : computed,
    };
  };

  // ─── ORDER TRACKING MODAL ───────────────────────────────────────────────
  const renderTrackingModal = () => {
    if (!trackingOrder) return null;
    const currentIdx = getCurrentStageIndex(trackingOrder);
    const modalBg = darkMode ? '#171717' : '#fff';
    const sectionBg = darkMode ? '#1f1f1f' : '#fff';
    const mutedBg = darkMode ? '#232a33' : '#f9fafb';
    const borderColor = darkMode ? '#333a44' : '#eceff3';
    const textPrimary = darkMode ? '#f2f2f2' : '#111';
    const textSecondary = darkMode ? '#b8b8b8' : '#666';
    const textMuted = darkMode ? '#8f97a3' : '#6b7280';

    return (
      <Modal
        visible={!!trackingOrder}
        animationType="slide"
        transparent
        onRequestClose={closeTrackingModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            activeOpacity={1}
            style={{ flex: 1 }}
            onPress={closeTrackingModal}
          />
          <View style={[styles.trackingModal, { backgroundColor: modalBg }]}>
            {/* Header */}
            <View style={[styles.trackingHeader, { borderBottomColor: darkMode ? '#2d2d2d' : '#f0f0f0' }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.trackingTitle, { color: textPrimary }]}>
                  Order Progress <Text style={{ fontWeight: '400', fontSize: 13, color: textMuted }}>• {trackingOrder.id.substring(0, 8).toUpperCase()}...</Text>
                </Text>
              </View>
              <TouchableOpacity onPress={closeTrackingModal} style={styles.headerXIcon}>
                <Ionicons name="close" size={20} color={textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                {/* Product card */}
                <View style={[styles.trackingProductCard, { backgroundColor: sectionBg, borderColor: darkMode ? '#2f2f2f' : '#eee' }]}>
                  {trackingOrder.product?.image1 ? (
                    <Image source={{ uri: trackingOrder.product.image1 }} style={styles.trackingProductImg} resizeMode="cover" />
                  ) : (
                    <View style={[styles.trackingProductImg, { backgroundColor: darkMode ? '#2a2a2a' : '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="image-outline" size={28} color={darkMode ? '#737373' : '#bbb'} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.trackingProductName, { color: textPrimary }]} numberOfLines={2}>
                      {getDisplayProductName(trackingOrder)}
                    </Text>
                    <Text style={[styles.trackingProductStatus, { color: textSecondary }]}>
                      Status: {getOrderStatusText(trackingOrder)}
                    </Text>
                  </View>
                </View>

                {/* Progress bar info */}
                <View style={styles.progressHeaderRow}>
                  <Text style={[styles.progressLabel, { color: textPrimary }]}>Production Progress</Text>
                  <Text style={[styles.progressPctText, { color: textPrimary }]}>
                    {currentIdx < 0 ? '0' : Math.round(((currentIdx + 1) / ORDER_STAGES.length) * 100)}%
                  </Text>
                </View>

                <View style={[styles.progressBarTrack, { backgroundColor: darkMode ? '#2f3640' : '#e5e7eb' }]}>
                  <View style={[
                    styles.progressBarFill,
                    {
                      width: `${currentIdx < 0 ? 0 : Math.min(100, ((currentIdx + 1) / ORDER_STAGES.length) * 100)}%`
                    }
                  ]} />
                </View>

                <Text style={[styles.progressNote, { color: textMuted }]}>Only team-leader image updates appear here.</Text>

                <View style={[styles.updateSectionCard, { backgroundColor: mutedBg, borderColor: borderColor }]}>
                  <Text style={[styles.updateSectionTitle, { color: textPrimary }]}>Image Updates</Text>

                  {taskUpdatesLoading ? (
                    <ActivityIndicator size="small" color="#a81d1d" style={{ marginVertical: 12 }} />
                  ) : taskUpdates.length === 0 ? (
                    <Text style={[styles.noUpdateText, { color: textMuted }]}>No image updates yet.</Text>
                  ) : (
                    taskUpdates.map((update, idx) => (
                      <View key={update.id || `${idx}`} style={[styles.updateItemRow, { borderTopColor: borderColor }]}>
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text style={[styles.updateItemTitle, { color: darkMode ? '#e8eef8' : '#1f2937' }]} numberOfLines={2}>
                            {update.description?.trim() || `Update #${idx + 1}`}
                          </Text>
                          {update.created_at && (
                            <Text style={[styles.updateItemDate, { color: textMuted }]}>{formatDate(update.created_at)}</Text>
                          )}
                        </View>
                        <TouchableOpacity
                          style={styles.viewUpdateBtn}
                          onPress={() => openImageViewer(update.image_urls)}
                        >
                          <Ionicons name="images" size={14} color="#fff" />
                          <Text style={styles.viewUpdateBtnText}>Open</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>

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
                              done
                                ? styles.timelineCircleDone
                                : [styles.timelineCirclePending, { backgroundColor: darkMode ? '#1d1d1d' : '#fff', borderColor: darkMode ? '#4b4b4b' : '#ccc' }]
                            ]}>
                              {done ? (
                                <Ionicons name="checkmark" size={14} color="#fff" />
                              ) : (
                                <Text style={[styles.timelineStepNum, { color: darkMode ? '#9a9a9a' : '#999' }]}>{idx + 1}</Text>
                              )}
                            </View>
                            {idx < ORDER_STAGES.length - 1 && (
                              <View
                                style={[
                                  styles.timelineLine,
                                  { backgroundColor: darkMode ? '#3b3b3b' : '#eee' },
                                  done && isStageCompleted(idx + 1, currentIdx) ? styles.timelineLineDone : {},
                                ]}
                              />
                            )}
                          </View>

                          <View style={styles.timelineContent}>
                            <Text style={[
                              styles.timelineLabel,
                              done
                                ? [styles.timelineLabelDone, { color: darkMode ? '#f2f2f2' : '#000' }]
                                : [styles.timelineLabelPending, { color: darkMode ? '#8e8e8e' : '#999' }]
                            ]}>
                              {stage.label}
                            </Text>

                            {done ? (
                              <Text style={[styles.timelineTimestamp, { color: textSecondary }]}>
                                {ts ? formatTimestamp(ts) : formatDate(trackingOrder.updated_at || trackingOrder.created_at)}
                              </Text>
                            ) : (
                              <Text style={[styles.timelinePending, { color: darkMode ? '#8e8e8e' : '#999' }]}>Pending</Text>
                            )}

                            {stage.key === 'in_production' && done && (
                              <View style={[styles.productionNote, { backgroundColor: darkMode ? '#222' : '#fff' }]}>
                                <Text style={[styles.productionNoteTitle, { color: darkMode ? '#f0f0f0' : '#333' }]}>Production Updates</Text>
                                <Text style={[styles.productionNoteText, { color: textSecondary }]}>
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

            <TouchableOpacity style={styles.closeModalBtn} onPress={closeTrackingModal}>
              <Text style={styles.closeModalBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#101010' : '#f5f5f5' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Orders</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a81d1d" />
          <Text style={[styles.loadingText, { color: darkMode ? '#b5b5b5' : '#666' }]}>Loading orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#101010' : '#f5f5f5' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
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
            <Ionicons name="receipt-outline" size={80} color={darkMode ? '#888' : '#ccc'} />
            <Text style={[styles.emptyTitle, { color: darkMode ? '#f2f2f2' : '#333' }]}>No Active Orders</Text>
            <Text style={[styles.emptyText, { color: darkMode ? '#b5b5b5' : '#666' }]}>You don&apos;t have any orders in progress.</Text>
            <TouchableOpacity style={styles.shopButton} onPress={() => router.push('../shop')}>
              <Text style={styles.shopButtonText}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.ordersContainer}>
            {orders.map((order) => (
              <View key={order.id} style={[styles.orderCard, { backgroundColor: darkMode ? '#1a1a1a' : '#fff' }]}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderIdContainer}>
                    <Text style={[styles.orderIdLabel, { color: darkMode ? '#b5b5b5' : '#666' }]}>Order ID:</Text>
                    <Text style={[styles.orderIdText, { color: darkMode ? '#f2f2f2' : '#333' }]}>{order.id.substring(0, 8).toUpperCase()}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getOrderStatusBadgeColor(order) }]}>
                    <Text style={styles.statusBadgeText}>{getOrderStatusBadgeText(order)}</Text>
                  </View>
                </View>

                <View style={styles.orderContent}>
                  {order.product?.image1 ? (
                    <Image source={{ uri: order.product.image1 }} style={styles.productImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.productImagePlaceholder, { backgroundColor: darkMode ? '#252525' : '#f5f5f5' }]}>
                      <Ionicons name="image-outline" size={32} color={darkMode ? '#888' : '#ccc'} />
                    </View>
                  )}
                  <View style={styles.orderDetails}>
                    <Text style={[styles.productName, { color: darkMode ? '#f2f2f2' : '#333' }]} numberOfLines={2}>
                      {getDisplayProductName(order)}
                    </Text>
                    <Text style={[styles.orderInfo, { color: darkMode ? '#b5b5b5' : '#666' }]}>Quantity: {order.quantity}</Text>
                    <Text style={styles.orderPrice}>{formatCurrency(order.total_amount || order.price * order.quantity)}</Text>
                    <Text style={[styles.orderDate, { color: darkMode ? '#9a9a9a' : '#999' }]}>{formatDate(order.created_at)}</Text>
                  </View>
                </View>

                {order.delivery_address && (
                  <View style={[styles.addressContainer, { backgroundColor: darkMode ? '#232323' : '#f8f9fa' }]}>
                    <Ionicons name="location" size={16} color={darkMode ? '#b5b5b5' : '#666'} />
                    <Text style={[styles.addressText, { color: darkMode ? '#b5b5b5' : '#666' }]} numberOfLines={2}>
                      {order.delivery_address}
                    </Text>
                  </View>
                )}

                <View style={[styles.orderFooter, { borderTopColor: darkMode ? '#313131' : '#f0f0f0' }]}>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.receiptButton]}
                      onPress={() => openDocument(order, 'receipt')}
                    >
                      <Text style={styles.actionButtonText}>View Receipt</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.invoiceButton]}
                      onPress={() => openDocument(order, 'invoice')}
                    >
                      <Text style={styles.actionButtonText}>Display Invoice</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.progressButton]}
                      onPress={() => openTracking(order)}
                    >
                      <Text style={styles.actionButtonText}>View Progress</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        styles.cancelButton,
                        !canRequestCancellation(order) && styles.disabledActionButton,
                      ]}
                      onPress={() => requestCancellation(order)}
                      disabled={!canRequestCancellation(order)}
                    >
                      <Text style={styles.actionButtonText}>
                        {canRequestCancellation(order) ? 'Request Cancel' : 'Cancel Requested'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {isPaymongoUnpaidOrder(order) && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.retryPayButton,
                          retryingOrderId === order.id && styles.disabledActionButton,
                        ]}
                        onPress={() => retryPaymongoPayment(order)}
                        disabled={retryingOrderId === order.id}
                      >
                        <Text style={styles.actionButtonText}>
                          {retryingOrderId === order.id ? 'Preparing PayMongo...' : 'Pay Again'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {order.order_status === 'pending_cancellation' && (
                    <Text style={styles.cancellationHint}>Cancellation request is pending admin approval.</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {renderTrackingModal()}

      <Modal
        visible={documentModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeDocumentModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={closeDocumentModal} />
          <View style={styles.documentModal}>
            <View style={styles.trackingHeader}>
              <Text style={styles.trackingTitle}>{documentType === 'receipt' ? 'Payment Receipt' : 'Invoice'}</Text>
              <TouchableOpacity onPress={closeDocumentModal} style={styles.headerXIcon}>
                <Ionicons name="close" size={20} color="#333" />
              </TouchableOpacity>
            </View>

            {documentOrder && (
              <ScrollView contentContainerStyle={styles.documentBody}>
                {documentType === 'receipt' ? (
                  <View style={[styles.receiptPreviewContainer, IS_COMPACT_INVOICE && styles.receiptPreviewContainerCompact]}>
                    <View style={[styles.receiptSuccessBanner, IS_COMPACT_INVOICE && styles.receiptSuccessBannerCompact]}>
                      <Text style={[styles.receiptSuccessTitle, IS_COMPACT_INVOICE && styles.receiptSuccessTitleCompact]}>Payment Successful</Text>
                      <Text style={[styles.receiptSuccessSubtext, IS_COMPACT_INVOICE && styles.receiptSuccessSubtextCompact]}>Reservation payment has been received and is waiting for admin approval.</Text>
                    </View>

                    <View style={[styles.receiptSectionCard, IS_COMPACT_INVOICE && styles.receiptSectionCardCompact]}>
                      <Text style={[styles.receiptSectionTitle, IS_COMPACT_INVOICE && styles.receiptSectionTitleCompact]}>Reservation Receipt</Text>
                      <Text style={[styles.receiptLine, IS_COMPACT_INVOICE && styles.receiptLineCompact]}><Text style={styles.receiptLineLabel}>Order ID: </Text>{documentOrder.id}</Text>
                      <Text style={[styles.receiptLine, IS_COMPACT_INVOICE && styles.receiptLineCompact]}><Text style={styles.receiptLineLabel}>Payment Reference: </Text>{getOrderPaymentReference(documentOrder)}</Text>
                      <Text style={[styles.receiptLine, IS_COMPACT_INVOICE && styles.receiptLineCompact]}><Text style={styles.receiptLineLabel}>Payment Method: </Text>{documentOrder.payment_method || 'paymongo'}</Text>
                      <Text style={[styles.receiptLine, IS_COMPACT_INVOICE && styles.receiptLineCompact]}><Text style={styles.receiptLineLabel}>Total Paid: </Text>{formatCurrency(getOrderPaidAmount(documentOrder))}</Text>
                      <Text style={[styles.receiptLine, IS_COMPACT_INVOICE && styles.receiptLineCompact]}><Text style={styles.receiptLineLabel}>Receipt Email: </Text>{documentOrder.customer_email || 'N/A'}</Text>
                    </View>

                    <View style={[styles.receiptSectionCard, IS_COMPACT_INVOICE && styles.receiptSectionCardCompact]}>
                      <Text style={[styles.receiptItemName, IS_COMPACT_INVOICE && styles.receiptItemNameCompact]}>{getDisplayProductName(documentOrder)}</Text>
                      <Text style={[styles.receiptLine, IS_COMPACT_INVOICE && styles.receiptLineCompact]}>Quantity: {documentOrder.quantity}</Text>
                      <Text style={[styles.receiptLine, IS_COMPACT_INVOICE && styles.receiptLineCompact]}><Text style={styles.receiptLineLabel}>Paid Amount: </Text>{formatCurrency(getOrderPaidAmount(documentOrder))}</Text>
                    </View>

                    <View style={[styles.receiptSectionCard, IS_COMPACT_INVOICE && styles.receiptSectionCardCompact]}>
                      <Text style={[styles.receiptSectionTitle, IS_COMPACT_INVOICE && styles.receiptSectionTitleCompact]}>What’s Next?</Text>
                      <Text style={[styles.receiptLine, IS_COMPACT_INVOICE && styles.receiptLineCompact]}>1. Payment is confirmed and waiting for admin approval.</Text>
                      <Text style={[styles.receiptLine, IS_COMPACT_INVOICE && styles.receiptLineCompact]}>2. After approval, production and delivery workflow continues.</Text>
                      <Text style={[styles.receiptLine, IS_COMPACT_INVOICE && styles.receiptLineCompact]}>3. Final invoice PDF is sent after admin approval.</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.invoicePreviewContainer}>
                    <View style={[styles.invoiceHeaderRow, IS_COMPACT_INVOICE && styles.invoiceHeaderRowCompact]}>
                      <View style={styles.invoiceLogoBlock}>
                        <Image
                          source={require('@/assets/images/GRANDEASTLOGO.png')}
                          style={[styles.invoiceLogo, IS_COMPACT_INVOICE && styles.invoiceLogoCompact]}
                          resizeMode="contain"
                        />
                        <Text style={styles.invoiceCompanySub}>Philippines</Text>
                        <Text style={styles.invoiceCompanySub}>support@grandlink.com</Text>
                      </View>

                      <View style={[styles.invoiceMetaBlock, IS_COMPACT_INVOICE && styles.invoiceMetaBlockCompact]}>
                        <Text style={styles.invoiceMetaLabel}>INVOICE</Text>
                        <Text style={[styles.invoiceNumber, IS_COMPACT_INVOICE && styles.invoiceNumberCompact]}>{getInvoiceNumber(documentOrder)}</Text>
                        <Text style={[styles.invoiceMetaText, IS_COMPACT_INVOICE && styles.invoiceMetaTextCompact]}>Issued: {formatDate(documentOrder.created_at)}</Text>
                        <Text style={[styles.invoiceMetaText, IS_COMPACT_INVOICE && styles.invoiceMetaTextCompact]}>Order ID: {documentOrder.id}</Text>
                        <Text style={[styles.invoiceMetaText, IS_COMPACT_INVOICE && styles.invoiceMetaTextCompact]}>Payment: {String(documentOrder.payment_method || 'paymongo').toUpperCase()}</Text>
                      </View>
                    </View>

                    <View style={[styles.invoiceInfoGrid, IS_COMPACT_INVOICE && styles.invoiceInfoGridCompact]}>
                      <View style={styles.invoiceInfoCard}>
                        <Text style={styles.invoiceInfoTitle}>Billed To</Text>
                        <Text style={styles.invoiceInfoLine}>{documentOrder.customer_name || 'Customer'}</Text>
                        <Text style={styles.invoiceInfoLine}>{documentOrder.customer_email || 'N/A'}</Text>
                        <Text style={styles.invoiceInfoLine}>{documentOrder.customer_phone || 'N/A'}</Text>
                        <Text style={styles.invoiceInfoAddress}>{getFormattedDeliveryAddress(documentOrder)}</Text>
                      </View>

                      <View style={styles.invoiceInfoCard}>
                        <Text style={styles.invoiceInfoTitle}>Fulfillment</Text>
                        <Text style={styles.invoiceInfoLine}>Method: DELIVERY</Text>
                        <Text style={styles.invoiceInfoAddress}>Delivery: {getFormattedDeliveryAddress(documentOrder)}</Text>
                        <Text style={styles.invoiceInfoLine}>Payment Ref: {getOrderPaymentReference(documentOrder)}</Text>
                      </View>
                    </View>

                    <View style={styles.invoiceTableHeader}>
                      <Text style={[styles.invoiceTableHeadCell, styles.invoiceItemCol]}>Item</Text>
                      <Text style={[styles.invoiceTableHeadCell, styles.invoiceQtyCol]}>Qty</Text>
                      <Text style={[styles.invoiceTableHeadCell, styles.invoiceUnitCol]}>Unit</Text>
                      <Text style={[styles.invoiceTableHeadCell, styles.invoiceAmountCol]}>Amount</Text>
                    </View>

                    <View style={styles.invoiceTableRow}>
                      <Text style={[styles.invoiceTableCell, styles.invoiceItemCol]}>{getDisplayProductName(documentOrder)}</Text>
                      <Text style={[styles.invoiceTableCell, styles.invoiceQtyCol]}>{documentOrder.quantity}</Text>
                      <Text style={[styles.invoiceTableCell, styles.invoiceUnitCol]}>{formatCurrency(Number(documentOrder.price || 0))}</Text>
                      <Text style={[styles.invoiceTableCell, styles.invoiceAmountCol]}>{formatCurrency(Number(documentOrder.total_amount || 0))}</Text>
                    </View>

                    <View style={styles.invoiceTotalsCard}>
                      <View style={styles.invoiceTotalsRow}>
                        <Text style={styles.invoiceTotalsLabel}>Subtotal</Text>
                        <Text style={styles.invoiceTotalsValue}>{formatCurrency(getInvoiceTotals(documentOrder).subtotal)}</Text>
                      </View>
                      <View style={styles.invoiceTotalsRow}>
                        <Text style={styles.invoiceTotalsLabel}>Add-ons</Text>
                        <Text style={styles.invoiceTotalsValue}>{formatCurrency(getInvoiceTotals(documentOrder).addOns)}</Text>
                      </View>
                      <View style={styles.invoiceTotalsRow}>
                        <Text style={styles.invoiceTotalsLabel}>Discount</Text>
                        <Text style={styles.invoiceTotalsValue}>-{formatCurrency(getInvoiceTotals(documentOrder).discount)}</Text>
                      </View>
                      <View style={styles.invoiceTotalsRow}>
                        <Text style={styles.invoiceTotalsLabel}>Delivery Fee</Text>
                        <Text style={styles.invoiceTotalsValue}>{formatCurrency(getInvoiceTotals(documentOrder).deliveryFee)}</Text>
                      </View>
                      <View style={[styles.invoiceTotalsRow, styles.invoiceTotalsTotalRow]}>
                        <Text style={styles.invoiceTotalLabel}>Total</Text>
                        <Text style={styles.invoiceTotalValue}>{formatCurrency(getInvoiceTotals(documentOrder).total)}</Text>
                      </View>
                    </View>

                    <View style={styles.invoiceNotesWrap}>
                      <Text style={styles.invoiceNotesTitle}>Notes</Text>
                      <Text style={styles.invoiceNotesText}>This invoice is finalized and sent after admin approval.</Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={imageViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <View style={styles.imageViewerOverlay}>
          <View style={styles.imageViewerHeader}>
            <Text style={styles.imageViewerTitle}>Update Images</Text>
            <TouchableOpacity onPress={() => setImageViewerVisible(false)} style={styles.imageViewerCloseBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imageViewerScroll}
          >
            {selectedUpdateImages.map((uri, idx) => (
              <View key={`${uri}-${idx}`} style={styles.imageViewerSlide}>
                <Image source={{ uri }} style={styles.imageViewerImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
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
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 3,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  receiptButton: { backgroundColor: '#1d4ed8' },
  invoiceButton: { backgroundColor: '#7f1d1d' },
  progressButton: { backgroundColor: '#111' },
  retryPayButton: { backgroundColor: '#0f8f3f' },
  cancelButton: { backgroundColor: '#dc2626' },
  disabledActionButton: { opacity: 0.5 },
  cancellationHint: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },

  documentModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '65%',
    width: '100%',
  },
  documentBody: {
    padding: 16,
  },
  invoicePreviewContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  invoiceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  invoiceHeaderRowCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },
  invoiceLogoBlock: {
    flex: 1,
  },
  invoiceLogo: {
    width: 220,
    height: 60,
    marginBottom: 6,
  },
  invoiceLogoCompact: {
    width: 190,
    height: 52,
  },
  invoiceCompanySub: {
    fontSize: 12,
    color: '#334155',
  },
  invoiceMetaBlock: {
    width: 220,
    alignItems: 'flex-end',
  },
  invoiceMetaBlockCompact: {
    width: '100%',
    alignItems: 'flex-start',
  },
  invoiceMetaLabel: {
    fontSize: 20,
    color: '#334155',
  },
  invoiceNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  invoiceNumberCompact: {
    fontSize: 20,
    lineHeight: 24,
  },
  invoiceMetaText: {
    fontSize: 12,
    color: '#0f172a',
    textAlign: 'right',
  },
  invoiceMetaTextCompact: {
    textAlign: 'left',
  },
  invoiceInfoGrid: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  invoiceInfoGridCompact: {
    flexDirection: 'column',
  },
  invoiceInfoCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#fff',
  },
  invoiceInfoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  invoiceInfoLine: {
    fontSize: 12,
    color: '#111827',
  },
  invoiceInfoAddress: {
    fontSize: 12,
    color: '#1f2937',
    marginTop: 6,
    lineHeight: 18,
  },
  invoiceTableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  invoiceTableHeadCell: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },
  invoiceTableRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  invoiceTableCell: {
    fontSize: 12,
    color: '#111827',
  },
  invoiceItemCol: { flex: 3 },
  invoiceQtyCol: { flex: 1, textAlign: 'center' },
  invoiceUnitCol: { flex: 2, textAlign: 'right' },
  invoiceAmountCol: { flex: 2, textAlign: 'right' },
  invoiceTotalsCard: {
    margin: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
  },
  invoiceTotalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  invoiceTotalsLabel: {
    fontSize: 13,
    color: '#111827',
  },
  invoiceTotalsValue: {
    fontSize: 13,
    color: '#111827',
  },
  invoiceTotalsTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 0,
  },
  invoiceTotalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  invoiceTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  invoiceNotesWrap: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  invoiceNotesTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  invoiceNotesText: {
    fontSize: 12,
    color: '#1f2937',
  },
  receiptPreviewContainer: {
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    padding: 12,
  },
  receiptPreviewContainerCompact: {
    padding: 10,
    borderRadius: 12,
  },
  receiptSuccessBanner: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  receiptSuccessBannerCompact: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  receiptSuccessTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  receiptSuccessTitleCompact: {
    fontSize: 16,
    marginBottom: 2,
  },
  receiptSuccessSubtext: {
    color: '#eafff1',
    fontSize: 13,
    textAlign: 'center',
  },
  receiptSuccessSubtextCompact: {
    fontSize: 11,
    lineHeight: 15,
  },
  receiptSectionCard: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  receiptSectionCardCompact: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  receiptSectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  receiptSectionTitleCompact: {
    fontSize: 18,
    marginBottom: 6,
  },
  receiptItemName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  receiptItemNameCompact: {
    fontSize: 17,
  },
  receiptLine: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 22,
  },
  receiptLineCompact: {
    fontSize: 12,
    lineHeight: 18,
  },
  receiptLineLabel: {
    fontWeight: '800',
    color: '#0f172a',
  },
  documentCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#fff',
  },
  documentTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  documentSubTitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },
  documentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  documentLabel: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '600',
  },
  documentValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  documentTotal: {
    fontSize: 14,
    color: '#8B1C1C',
    fontWeight: '800',
  },

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

  updateSectionCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#eceff3',
  },
  updateSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  noUpdateText: {
    fontSize: 12,
    color: '#6b7280',
  },
  updateItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eceff3',
  },
  updateItemTitle: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '600',
  },
  updateItemDate: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 3,
  },
  viewUpdateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B1C1C',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 4,
  },
  viewUpdateBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

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

  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
  },
  imageViewerHeader: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    zIndex: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageViewerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  imageViewerCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerScroll: {
    alignItems: 'center',
  },
  imageViewerSlide: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  imageViewerImage: {
    width: SCREEN_WIDTH - 24,
    height: '78%',
  },
});
