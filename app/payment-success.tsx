import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';
import { useModal } from '@/hooks/useModal';
import { useAppContext } from '@/context/AppContext';
import { mobileNotificationService } from '@/services/MobileNotificationService';

const PENDING_PAYMONGO_SYNC_KEY = 'pending_paymongo_order_sync_v1';

const toTrimmedParam = (value: any): string => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = String(item || '').trim();
      if (candidate) return candidate;
    }
    return '';
  }
  return String(value || '').trim();
};

const resolveSessionIdFromParams = (routeParams: Record<string, any>) => {
  const candidates = [
    routeParams?.session_id,
    routeParams?.checkout_session_id,
    routeParams?.checkoutSessionId,
    routeParams?.id,
    routeParams?.payment_intent_id,
    routeParams?.payment_intent,
  ];

  for (const raw of candidates) {
    const value = toTrimmedParam(raw);
    if (value) return value;
  }

  return '';
};

type OrderItem = {
  id: string;
  product_id?: string;
  name: string;
  qty: number;
  price: number;
  lineTotal: number;
  category?: string;
  material?: string;
};

export default function PaymentSuccessScreen() {
  const { darkMode } = useAppContext();
  const router = useRouter();
  const params = useLocalSearchParams();
  const modal = useModal();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    loadSuccessfulOrder();
  }, []);

  const syncProductStockForPaidOrders = async (
    userId: string,
    sessionId: string,
    knownOrderIds: string[]
  ) => {
    try {
      let orderRows: any[] = [];

      if (knownOrderIds.length > 0) {
        const { data, error: ordersErr } = await supabase
          .from('user_items')
          .select('id, product_id, quantity, payment_intent_id, payment_status, meta')
          .eq('user_id', userId)
          .eq('item_type', 'order')
          .in('id', knownOrderIds);

        if (ordersErr) {
          console.error('[STOCK-SYNC] Failed to load paid order rows by IDs:', ordersErr);
          return;
        }

        orderRows = data || [];
      } else {
        const { data: byIntent, error: byIntentErr } = await supabase
          .from('user_items')
          .select('id, product_id, quantity, payment_intent_id, payment_status, meta')
          .eq('user_id', userId)
          .eq('item_type', 'order')
          .eq('payment_intent_id', sessionId);

        if (byIntentErr) {
          console.error('[STOCK-SYNC] Failed to load paid order rows by payment_intent_id:', byIntentErr);
        }

        const { data: byMeta, error: byMetaErr } = await supabase
          .from('user_items')
          .select('id, product_id, quantity, payment_intent_id, payment_status, meta')
          .eq('user_id', userId)
          .eq('item_type', 'order')
          .contains('meta', { payment_session_id: sessionId });

        if (byMetaErr) {
          console.error('[STOCK-SYNC] Failed to load paid order rows by meta.payment_session_id:', byMetaErr);
        }

        const merged = [...(byIntent || []), ...(byMeta || [])];
        const seen = new Set<string>();
        orderRows = merged.filter((row: any) => {
          const id = String(row?.id || '');
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      }

      const rowsToDeduct = (orderRows || []).filter((row: any) => {
        const qty = Number(row?.quantity || 0);
        const alreadyDeducted = Boolean(row?.meta?.stock_deducted);
        const paymentStatus = String(row?.payment_status || '').toLowerCase();
        const isPaidOrder = paymentStatus.includes('paid') || paymentStatus.includes('complete');
        return row?.product_id && qty > 0 && !alreadyDeducted && isPaidOrder;
      });

      if (rowsToDeduct.length === 0) {
        console.log('[STOCK-SYNC] No order rows need stock deduction.');
        return;
      }

      const qtyByProduct = new Map<string, number>();
      const updatedProductIds = new Set<string>();
      rowsToDeduct.forEach((row: any) => {
        const productId = String(row.product_id);
        const qty = Number(row.quantity || 0);
        qtyByProduct.set(productId, (qtyByProduct.get(productId) || 0) + qty);
      });

      for (const [productId, totalQty] of qtyByProduct.entries()) {
        const { data: productRow, error: productErr } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single();

        if (productErr || !productRow) {
          console.error('[STOCK-SYNC] Failed to load product for stock update:', productId, productErr);
          continue;
        }

        const hasStockColumn = Object.prototype.hasOwnProperty.call(productRow, 'stock');
        const hasInventoryColumn = Object.prototype.hasOwnProperty.call(productRow, 'inventory');
        const currentInventory = Number(productRow?.inventory);
        const currentStock = Number(productRow?.stock);
        const rawStock = Number.isFinite(currentInventory)
          ? currentInventory
          : (Number.isFinite(currentStock) ? currentStock : 0);
        const nextStock = Math.max(0, rawStock - totalQty);

        if (!hasStockColumn && !hasInventoryColumn) {
          console.warn('[STOCK-SYNC] Product has no stock/inventory columns to update:', productId);
          continue;
        }

        const inventoryResult = await mobileNotificationService.updateProductInventory(productId, nextStock);
        if (!inventoryResult.success) {
          console.error('[STOCK-SYNC] Failed to decrement stock for product via server route:', productId, inventoryResult.error);
          continue;
        }

        updatedProductIds.add(productId);

        console.log('[STOCK-SYNC] Updated product', productId, 'stock from', rawStock, 'to', nextStock, '(deducted', totalQty + ')');
      }

      for (const row of rowsToDeduct) {
        const productId = String(row?.product_id || '');
        if (!updatedProductIds.has(productId)) {
          console.warn('[STOCK-SYNC] Skipping stock_deducted marker because inventory update failed for product:', productId, 'order row:', row.id);
          continue;
        }

        const mergedMeta = {
          ...(row?.meta || {}),
          stock_deducted: true,
          stock_deducted_at: new Date().toISOString(),
          stock_deducted_reason: (row?.meta as any)?.stock_deducted_reason || 'payment_success_sync',
        };

        const { error: markErr } = await supabase
          .from('user_items')
          .update({
            meta: mergedMeta,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);

        if (markErr) {
          console.error('[STOCK-SYNC] Failed to mark order row as stock deducted:', row.id, markErr);
        }
      }
    } catch (err) {
      console.error('[STOCK-SYNC] Unexpected stock sync error:', err);
    }
  };

  const verifyAndSyncPaidFromSuccess = async (userId: string, sessionId: string, orderIds: string[]) => {
    if (!userId || !sessionId) return false;

    try {
      const extra = (Constants.expoConfig?.extra as Record<string, any> | undefined) || {};
      const paymongoSecretKey = String(extra.paymongoSecretKey || '').trim();
      if (!paymongoSecretKey) return false;

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
      const payments = Array.isArray(attrs?.payments) ? attrs.payments : [];
      const hasPaidPayment = payments.some((p: any) => {
        const ps = String(p?.attributes?.status || p?.status || '').toLowerCase();
        return ps.includes('paid') || ps.includes('succeed') || ps.includes('success');
      });

      const isPaid =
        attrs?.paid === true ||
        hasPaidPayment ||
        statusText.includes('paid') ||
        statusText.includes('succeed') ||
        statusText.includes('success') ||
        paymentIntentStatus.includes('paid') ||
        paymentIntentStatus.includes('succeed') ||
        paymentIntentStatus.includes('success');

      if (!isPaid) return false;

      const paymentReferenceId = String(
        payments?.[0]?.id ||
        attrs?.payment_intent?.data?.id ||
        attrs?.payment_intent?.id ||
        sessionId
      ).trim();

      const paidPayload: Record<string, any> = {
        payment_status: 'completed',
        payment_method: 'paymongo',
        payment_intent_id: paymentReferenceId,
        payment_id: paymentReferenceId,
        order_status: 'pending_payment',
        updated_at: new Date().toISOString(),
      };

      const updatedIds = new Set<string>();

      if (orderIds.length > 0) {
        const byIds = await supabase
          .from('user_items')
          .update(paidPayload)
          .in('id', orderIds)
          .select('id');
        (byIds.data || []).forEach((row: any) => row?.id && updatedIds.add(String(row.id)));
      }

      const byMeta = await supabase
        .from('user_items')
        .update(paidPayload)
        .eq('user_id', userId)
        .eq('item_type', 'order')
        .contains('meta', { payment_session_id: sessionId })
        .select('id');
      (byMeta.data || []).forEach((row: any) => row?.id && updatedIds.add(String(row.id)));

      if (!byMeta.data || byMeta.data.length === 0) {
        const byIntent = await supabase
          .from('user_items')
          .update(paidPayload)
          .eq('user_id', userId)
          .eq('item_type', 'order')
          .eq('payment_intent_id', sessionId)
          .select('id');
        (byIntent.data || []).forEach((row: any) => row?.id && updatedIds.add(String(row.id)));
      }

      await syncProductStockForPaidOrders(userId, sessionId, Array.from(updatedIds));

      return updatedIds.size > 0;
    } catch (e) {
      console.error('Failed to sync paid status from success page:', e);
      return false;
    }
  };

  const loadSuccessfulOrder = async () => {
    try {
      setLoading(true);

      // Get authenticated user
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        modal.showError('Error', 'User not authenticated');
        router.replace('/(tabs)/shop');
        return;
      }

      const targetSessionId = resolveSessionIdFromParams(params as Record<string, any>);

      // Get recent orders for this user and optionally narrow to checkout session.
      const { data: orders, error } = await supabase
        .from('user_items')
        .select('*')
        .eq('user_id', authData.user.id)
        .eq('item_type', 'order')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        throw error;
      }

      if (!orders || orders.length === 0) {
        modal.showInfo('Info', 'No pending orders found');
        router.replace('/(tabs)/shop');
        return;
      }

      const getSessionId = (item: any) =>
        String(item?.payment_intent_id || item?.payment_session_id || item?.meta?.payment_session_id || '').trim();

      // Never default to all orders. If session_id is missing (e.g. deep-link return),
      // scope to the latest checkout batch by deriving the session from the newest row.
      const fallbackSessionId = getSessionId(orders[0]);
      const effectiveSessionId = targetSessionId || fallbackSessionId;

      let matchingOrders = effectiveSessionId
        ? orders.filter((item: any) => getSessionId(item) === effectiveSessionId)
        : [orders[0]];

      if (!matchingOrders.length && effectiveSessionId) {
        try {
          const rawPending = await AsyncStorage.getItem(PENDING_PAYMONGO_SYNC_KEY);
          const pendingRecords = rawPending ? JSON.parse(rawPending) : [];
          const pendingOrderIds = Array.isArray(pendingRecords)
            ? pendingRecords
              .filter((entry: any) =>
                String(entry?.userId || '') === String(authData.user.id) &&
                String(entry?.sessionId || '') === String(effectiveSessionId)
              )
              .map((entry: any) => String(entry?.orderId || '').trim())
              .filter(Boolean)
            : [];

          if (pendingOrderIds.length > 0) {
            matchingOrders = orders.filter((item: any) => pendingOrderIds.includes(String(item?.id || '')));
          }
        } catch (pendingErr) {
          console.warn('Failed to read pending PayMongo sync context on success page:', pendingErr);
        }
      }

      if (!matchingOrders.length && effectiveSessionId) {
        const { data: byPaymentId } = await supabase
          .from('user_items')
          .select('*')
          .eq('user_id', authData.user.id)
          .eq('item_type', 'order')
          .eq('payment_id', effectiveSessionId)
          .order('created_at', { ascending: false })
          .limit(30);

        if ((byPaymentId || []).length > 0) {
          matchingOrders = byPaymentId as any[];
        }
      }

      if (!matchingOrders.length) {
        console.warn('[PAYMENT-SUCCESS] No exact order match found for session. Falling back to latest order for display.');
        matchingOrders = [orders[0]];
      }

      // Silent sync for deep-link returns where payment screen AppState handler may be skipped.
      if (effectiveSessionId) {
        await verifyAndSyncPaidFromSuccess(
          authData.user.id,
          effectiveSessionId,
          matchingOrders.map((o: any) => o.id).filter(Boolean)
        );
      }

      // Display-only screen: no DB mutation here.
      const finalOrders = matchingOrders.length ? matchingOrders : [orders[0]];

      const firstOrder = finalOrders[0] || matchingOrders[0];
      setOrder(firstOrder);

      // Format and aggregate order items by product so quantity is accurate
      // even if an order is split across multiple rows.
      const sourceOrders = finalOrders.length ? finalOrders : matchingOrders;
      const productIds = Array.from(
        new Set(
          sourceOrders
            .map((item: any) => String(item?.product_id || '').trim())
            .filter(Boolean)
        )
      );

      const productMeta = new Map<string, { name?: string; category?: string }>();
      if (productIds.length > 0) {
        const { data: productRows } = await supabase
          .from('products')
          .select('id, name, category')
          .in('id', productIds);

        (productRows || []).forEach((p: any) => {
          const key = String(p?.id || '').trim();
          if (!key) return;
          productMeta.set(key, {
            name: String(p?.name || '').trim(),
            category: String(p?.category || '').trim(),
          });
        });
      }

      const aggregated = new Map<string, OrderItem>();

      sourceOrders.forEach((item: any) => {
        const productId = String(item?.product_id || '').trim();
        const key = productId || String(item?.id || '').trim() || Math.random().toString(36);
        const qty = Math.max(1, Number(item?.quantity) || 1);
        const unitPrice = Number(item?.price) || 0;
        const storedTotal = Number(item?.total_amount);
        const lineTotal = Number.isFinite(storedTotal) && storedTotal > 0 ? storedTotal : unitPrice * qty;
        const meta = productMeta.get(productId);
        const fallbackName = productId ? `Product ${productId}` : 'Order Item';

        if (aggregated.has(key)) {
          const current = aggregated.get(key)!;
          current.qty += qty;
          current.lineTotal += lineTotal;
          return;
        }

        aggregated.set(key, {
          id: String(item?.id || key),
          product_id: productId || undefined,
          name: meta?.name || fallbackName,
          qty,
          price: unitPrice,
          lineTotal,
          category: meta?.category || item?.meta?.category || '',
        });
      });

      setOrderItems(Array.from(aggregated.values()));
    } catch (e: any) {
      console.error('Failed to load success order:', e);
      modal.showError('Error', `Failed to load order details: ${e.message}`);
      router.replace('/(tabs)/shop');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let addOnsTotal = 0;
    let discountAmount = 0;

    orderItems.forEach(item => {
      subtotal += Number(item.lineTotal || 0);
    });

    // Check for add-ons in order meta
    if (order?.meta?.add_ons?.color_customization?.enabled) {
      addOnsTotal += order.meta.add_ons.color_customization.price || 0;
    }

    // Check for discount in order meta
    if (order?.meta?.discount) {
      discountAmount = order.meta.discount.amount || 0;
    }

    const total = subtotal + addOnsTotal - discountAmount;

    return {
      subtotal,
      addOnsTotal,
      discountAmount,
      total,
    };
  };

  const formatCurrency = (value: number) => {
    return `₱${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a81d1d" />
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#101010' : '#fff' }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { subtotal, addOnsTotal, discountAmount, total } = calculateTotals();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: darkMode ? '#101010' : '#fff' }]}>
      <ScrollView style={[styles.scrollContent, { backgroundColor: darkMode ? '#101010' : '#fff' }]} showsVerticalScrollIndicator={false}>
        {/* Success Header */}
        <View style={styles.successHeader}>
          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={80} color="#0b9f34" />
          </View>
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={[styles.successSubtitle, { color: darkMode ? '#b8b8b8' : '#666' }]}>Your order has been confirmed and we're processing it</Text>
        </View>

        {/* Order Number and Date */}
        <View style={[styles.orderInfoCard, { backgroundColor: darkMode ? '#1a1a1a' : '#f8f9fa', borderColor: darkMode ? '#333' : '#e0e0e0' }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: darkMode ? '#b8b8b8' : '#666' }]}>Order ID</Text>
            <Text style={[styles.infoValue, { color: darkMode ? '#f2f2f2' : '#222' }]}>{order.id.substring(0, 8).toUpperCase()}</Text>
          </View>
          <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: darkMode ? '#333' : '#eee', paddingTop: 12 }]}>
            <Text style={[styles.infoLabel, { color: darkMode ? '#b8b8b8' : '#666' }]}>Date & Time</Text>
            <Text style={[styles.infoValue, { color: darkMode ? '#f2f2f2' : '#222' }]}>{formatDate(order.created_at)}</Text>
          </View>
          {order.customer_name && (
            <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: darkMode ? '#333' : '#eee', paddingTop: 12 }]}>
              <Text style={[styles.infoLabel, { color: darkMode ? '#b8b8b8' : '#666' }]}>Recipient</Text>
              <Text style={[styles.infoValue, { color: darkMode ? '#f2f2f2' : '#222' }]}>{order.customer_name}</Text>
            </View>
          )}
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: darkMode ? '#f2f2f2' : '#222' }]}>Order Items ({orderItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)} items)</Text>
          <View style={[styles.itemsCard, { backgroundColor: darkMode ? '#1a1a1a' : '#fff', borderColor: darkMode ? '#333' : '#eee' }]}>
            {orderItems.map((item, index) => (
              <View key={item.id}>
                <View style={styles.itemRow}>
                  <View style={styles.itemDetails}>
                    <Text style={[styles.itemName, { color: darkMode ? '#f2f2f2' : '#222' }]}>{item.name}</Text>
                    {item.category && <Text style={[styles.itemCategory, { color: darkMode ? '#b8b8b8' : '#888' }]}>{item.category}</Text>}
                  </View>
                  <View style={styles.itemPricing}>
                    <Text style={[styles.itemQty, { color: darkMode ? '#b8b8b8' : '#666' }]}>Qty: {item.qty}</Text>
                    <Text style={styles.itemPrice}>{formatCurrency(item.lineTotal)}</Text>
                  </View>
                </View>
                {index < orderItems.length - 1 && <View style={[styles.divider, { backgroundColor: darkMode ? '#303030' : '#f0f0f0' }]} />}
              </View>
            ))}
          </View>
        </View>

        {/* Add-ons */}
        {order.meta?.add_ons?.color_customization?.enabled && (
          <View style={styles.section}>
            <View style={styles.addonRow}>
              <Text style={styles.addonLabel}>
                Color Customization: {order.meta.add_ons.color_customization.color}
              </Text>
              <Text style={styles.addonPrice}>
                {formatCurrency(order.meta.add_ons.color_customization.price || 0)}
              </Text>
            </View>
          </View>
        )}

        {/* Price Summary */}
        <View style={[styles.summaryCard, { backgroundColor: darkMode ? '#1a1a1a' : '#fff', borderColor: darkMode ? '#333' : '#eee' }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: darkMode ? '#b8b8b8' : '#666' }]}>Subtotal</Text>
            <Text style={[styles.summaryValue, { color: darkMode ? '#f2f2f2' : '#222' }]}>{formatCurrency(subtotal)}</Text>
          </View>

          {addOnsTotal > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: darkMode ? '#b8b8b8' : '#666' }]}>Add-ons</Text>
              <Text style={[styles.summaryValue, { color: darkMode ? '#f2f2f2' : '#222' }]}>{formatCurrency(addOnsTotal)}</Text>
            </View>
          )}

          {discountAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.discountLabel}>Discount ({order.meta?.discount?.code})</Text>
              <Text style={styles.discountValue}>-{formatCurrency(discountAmount)}</Text>
            </View>
          )}

          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          </View>
        </View>

        {/* Delivery & Contact Details */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: darkMode ? '#f2f2f2' : '#222' }]}>Delivery & Contact Details</Text>
          <View style={[styles.detailsCard, { backgroundColor: darkMode ? '#1a1a1a' : '#fff', borderColor: darkMode ? '#333' : '#eee' }]}>
            {/* Full Name */}
            {order.customer_name && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Full Name:</Text>
                <Text style={styles.detailValue}>{order.customer_name}</Text>
              </View>
            )}

            {/* Email */}
            {order.customer_email && (
              <View style={[styles.detailRow, styles.detailRowWithBorder]}>
                <Text style={styles.detailLabel}>Email:</Text>
                <Text style={styles.detailValue}>{order.customer_email}</Text>
              </View>
            )}

            {/* Phone */}
            {order.customer_phone && (
              <View style={[styles.detailRow, styles.detailRowWithBorder]}>
                <Text style={styles.detailLabel}>Phone:</Text>
                <Text style={styles.detailValue}>{order.customer_phone}</Text>
              </View>
            )}

            {/* Address Breakdown */}
            {(order.meta?.detailed_address || order.delivery_address) && (
              <View style={[styles.detailRow, styles.detailRowWithBorder]}>
                <Text style={styles.detailLabel}>Address:</Text>
                <View style={styles.addressDetails}>
                  {order.meta?.detailed_address ? (
                    <>
                      {order.meta.detailed_address.street && (
                        <Text style={[styles.detailValue, { marginBottom: 4 }]}>{order.meta.detailed_address.street}</Text>
                      )}
                      {order.meta.detailed_address.addressLine2 && (
                        <Text style={[styles.detailValue, { marginBottom: 4 }]}>{order.meta.detailed_address.addressLine2}</Text>
                      )}
                      {(order.meta.detailed_address.city || order.meta.detailed_address.stateRegion || order.meta.detailed_address.zipCode) && (
                        <Text style={styles.detailValue}>
                          {[order.meta.detailed_address.city, order.meta.detailed_address.stateRegion, order.meta.detailed_address.zipCode]
                            .filter(Boolean)
                            .join(', ')}
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text style={styles.detailValue}>{order.delivery_address}</Text>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Order Status Note */}
        <View style={[styles.noteCard, { backgroundColor: darkMode ? '#153022' : '#f0fff4', borderColor: darkMode ? '#1f5237' : '#bce8cc' }]}>
          <Ionicons name="information-circle" size={20} color="#0b9f34" />
          <Text style={[styles.noteText, { color: darkMode ? '#bfe8ce' : '#14532d' }]}>
            You will receive an email confirmation shortly with your receipt and tracking information.
          </Text>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryBtn]}
          onPress={() => router.replace('/(tabs)/shop')}
        >
          <Text style={styles.secondaryBtnText}>Continue Shopping</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryBtn]}
          onPress={() => router.replace('/(tabs)/orders')}
        >
          <Ionicons name="arrow-forward" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Proceed to Orders</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#d00',
    fontSize: 16,
    fontWeight: '600',
  },

  // Success Header
  successHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0b9f34',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },

  orderInfoCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#222',
    fontWeight: '700',
  },

  // Section
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 12,
  },

  // Items Card
  itemsCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 12,
    color: '#888',
  },
  itemPricing: {
    alignItems: 'flex-end',
  },
  itemQty: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#a81d1d',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },

  // Add-ons
  addonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  addonLabel: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
    flex: 1,
  },
  addonPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#a81d1d',
  },

  // Summary Card
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  discountLabel: {
    fontSize: 14,
    color: '#0b9f34',
    fontWeight: '600',
  },
  discountValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0b9f34',
  },
  totalRow: {
    borderBottomWidth: 0,
    borderTopWidth: 2,
    borderTopColor: '#eee',
    paddingVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#a81d1d',
  },

  // Address Card
  addressCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  addressText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
  },

  // Details Card (new organized layout)
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'flex-start',
  },
  detailRowWithBorder: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginRight: 12,
    minWidth: 90,
  },
  detailValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },
  addressDetails: {
    flex: 1,
  },

  // Contact Card
  contactCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  contactInfo: {
    marginLeft: 12,
    fontSize: 13,
    color: '#333',
    flex: 1,
  },

  // Note Card
  noteCard: {
    flexDirection: 'row',
    backgroundColor: '#f0f9f4',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#c6f6d5',
  },
  noteText: {
    marginLeft: 12,
    flex: 1,
    fontSize: 13,
    color: '#2d7a4a',
    lineHeight: 18,
  },

  // Button Container
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: '#a81d1d',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryBtn: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  secondaryBtnText: {
    color: '#333',
    fontWeight: '700',
    fontSize: 16,
  },
});
