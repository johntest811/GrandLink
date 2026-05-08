import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  SafeAreaView,
  KeyboardAvoidingView,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';
import { useModal } from '@/hooks/useModal';
import { useAppContext } from '@/context/AppContext';
import { mobileNotificationService } from '@/services/MobileNotificationService';

const { width } = Dimensions.get('window');
const PENDING_PAYMONGO_SYNC_KEY = 'pending_paymongo_order_sync_v1';

type CartItem = {
  id: string;
  product_id?: string;
  name: string;
  qty?: number;
  price?: number;
  stock?: number;
  image?: string;
  category?: string;
  material?: string;
  width?: number | string | null;
  height?: number | string | null;
  thickness?: number | string | null;
};

type MeasurementConfig = {
  useCustom: boolean;
  width: string;
  height: string;
  thickness: string;
};

export default function PaymentScreen() {
  const { darkMode } = useAppContext();
  const router = useRouter();
  const modal = useModal();
  const params = useLocalSearchParams();
  const appState = useRef(AppState.currentState);
  const [awaitingReturn, setAwaitingReturn] = useState(false);
  const [lastPaymentSessionId, setLastPaymentSessionId] = useState<string | null>(null);
  const [lastCreatedOrderIds, setLastCreatedOrderIds] = useState<string[]>([]);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [street, setStreet] = useState<string>('');
  const [addressLine2, setAddressLine2] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [stateRegion, setStateRegion] = useState<string>('');
  const [zipCode, setZipCode] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [discountCode, setDiscountCode] = useState<string>('');
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [itemMeasurements, setItemMeasurements] = useState<Record<string, MeasurementConfig>>({});
  const [colorCustomization, setColorCustomization] = useState(false);
  const [customColor, setCustomColor] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('manual');

  const RESERVATION_FEE = 500;
  const COLOR_CUSTOMIZATION_PRICE = 2500;
  const PAYMONGO_PAYMENT_METHOD = 'paymongo';
  const PAYMONGO_STATUS_PAID = 'completed';
  const PAYMONGO_STATUS_UNPAID = 'pending';

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const pageBg = darkMode ? '#101010' : '#fff';
  const cardBg = darkMode ? '#1a1a1a' : '#fff';
  const border = darkMode ? '#333' : '#eee';
  const textPrimary = darkMode ? '#f2f2f2' : '#222';
  const textSecondary = darkMode ? '#b5b5b5' : '#666';
  const inputBg = darkMode ? '#242424' : '#fff';
  const disabledInputBg = darkMode ? '#353535' : '#f2f2f2';
  const disabledInputText = darkMode ? '#9a9a9a' : '#777';

  const normalizeDimension = (value: any): string => {
    if (value === null || value === undefined) return '';
    const raw = String(value).trim();
    if (!raw) return '';
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) return '';
    return Number.isInteger(num) ? String(num) : String(num);
  };

  const getCurrentUser = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      return sessionData.session.user;
    }

    const { data: authData } = await supabase.auth.getUser();
    return authData?.user ?? null;
  };

  const getDisplayNameFromUser = (currentUser: any) => {
    const metadata = currentUser?.user_metadata || {};
    const direct = String(metadata?.name || '').trim();
    if (direct) return direct;

    const fullName = String(metadata?.full_name || '').trim();
    if (fullName) return fullName;

    const first = String(metadata?.first_name || '').trim();
    const middle = String(metadata?.middle_name || '').trim();
    const last = String(metadata?.last_name || '').trim();
    const combined = [first, middle, last].filter(Boolean).join(' ').trim();
    if (combined) return combined;

    const emailValue = String(currentUser?.email || '').trim();
    if (emailValue.includes('@')) {
      return emailValue.split('@')[0];
    }

    return '';
  };

  const savePendingPaymongoSync = async (userId: string, sessionId: string, orderIds: string[]) => {
    if (!sessionId || !userId || orderIds.length === 0) return;
    try {
      const raw = await AsyncStorage.getItem(PENDING_PAYMONGO_SYNC_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const keep = Array.isArray(existing)
        ? existing.filter((r: any) => !(r?.userId === userId && orderIds.includes(String(r?.orderId || ''))))
        : [];

      const next = [
        ...keep,
        ...orderIds.map((orderId) => ({
          userId,
          orderId,
          sessionId,
          createdAt: new Date().toISOString(),
        })),
      ];

      await AsyncStorage.setItem(PENDING_PAYMONGO_SYNC_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to save pending PayMongo sync context:', e);
    }
  };

  const clearPendingPaymongoSyncBySession = async (userId: string, sessionId: string) => {
    if (!sessionId || !userId) return;
    try {
      const raw = await AsyncStorage.getItem(PENDING_PAYMONGO_SYNC_KEY);
      const existing = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(existing)
        ? existing.filter((r: any) => !(r?.userId === userId && r?.sessionId === sessionId))
        : [];
      await AsyncStorage.setItem(PENDING_PAYMONGO_SYNC_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to clear pending PayMongo sync context:', e);
    }
  };

  const hasPaidRowInDatabase = async (
    userId: string,
    sessionId: string,
    paymentReferenceId: string,
    knownIds: string[]
  ): Promise<boolean> => {
    const paidStatuses = new Set(['paid - paymongo', 'paid', 'success', 'succeeded']);

    console.log('[CONFIRM-PAID] Checking if rows are marked PAID in DB. knownIds:', knownIds);

    if (knownIds.length > 0) {
      const byIds = await supabase
        .from('user_items')
        .select('id, payment_status')
        .in('id', knownIds)
        .limit(50);

      console.log('[CONFIRM-PAID] Rows by ID:', (byIds.data || []).map((r: any) => ({ id: r.id, status: r.payment_status })));

      const paidByIds = (byIds.data || []).some((row: any) => {
        const status = String(row?.payment_status || '').toLowerCase().trim();
        const isPaid = paidStatuses.has(status) || status.includes('paid');
        console.log('[CONFIRM-PAID] Row', row.id, '-> status=\"' + row.payment_status + '\" (lowercase=\"' + status + '\") -> isPaid=' + isPaid);
        return isPaid;
      });

      if (paidByIds) {
        console.log('[CONFIRM-PAID] SUCCESS - Found PAID rows by ID!');
        return true;
      }
    }

    const byReference = await supabase
      .from('user_items')
      .select('id, payment_status, payment_intent_id, meta')
      .eq('user_id', userId)
      .eq('item_type', 'order')
      .or(`payment_intent_id.eq.${sessionId},payment_intent_id.eq.${paymentReferenceId}`)
      .order('created_at', { ascending: false })
      .limit(50);

    console.log('🔍 [CONFIRM-PAID] Rows by reference:', (byReference.data || []).map((r: any) => ({ id: r.id, status: r.payment_status })));

    const paidByReference = (byReference.data || []).some((row: any) =>
      String(row?.payment_status || '').toLowerCase().includes('paid')
    );

    if (paidByReference) {
      console.log('✅ [CONFIRM-PAID] SUCCESS - Found PAID rows by reference!');
      return true;
    }

    const byMetaSession = await supabase
      .from('user_items')
      .select('id, payment_status')
      .eq('user_id', userId)
      .eq('item_type', 'order')
      .contains('meta', { payment_session_id: sessionId })
      .limit(50);

    console.log('🔍 [CONFIRM-PAID] Rows by meta.payment_session_id:', (byMetaSession.data || []).map((r: any) => ({ id: r.id, status: r.payment_status })));

    const isPaidByMeta = (byMetaSession.data || []).some((row: any) =>
      String(row?.payment_status || '').toLowerCase().includes('paid')
    );

    if (isPaidByMeta) {
      console.log('✅ [CONFIRM-PAID] SUCCESS - Found PAID rows by meta session!');
    } else {
      console.log('❌ [CONFIRM-PAID] FAILED - No PAID rows found in any matching set');
    }

    return isPaidByMeta;
  };

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

  const deductInventoryForFreshOrders = async (orderRows: any[]) => {
    try {
      const rowsToDeduct = (orderRows || []).filter((row: any) => {
        const qty = Number(row?.quantity || 0);
        const alreadyDeducted = Boolean(row?.meta?.stock_deducted);
        return row?.product_id && qty > 0 && !alreadyDeducted;
      });

      if (rowsToDeduct.length === 0) {
        return;
      }

      const qtyByProduct = new Map<string, number>();
      rowsToDeduct.forEach((row: any) => {
        const productId = String(row.product_id);
        const qty = Number(row.quantity || 0);
        qtyByProduct.set(productId, (qtyByProduct.get(productId) || 0) + qty);
      });

      const updatedProductIds = new Set<string>();

      for (const [productId, totalQty] of qtyByProduct.entries()) {
        const { data: productRow, error: productErr } = await supabase
          .from('products')
          .select('id, inventory, updated_at')
          .eq('id', productId)
          .single();

        if (productErr || !productRow) {
          console.error('[ORDER-STOCK] Failed to load product inventory:', productId, productErr);
          continue;
        }

        const currentInventory = Number(productRow?.inventory || 0);
        const nextInventory = Math.max(0, currentInventory - totalQty);

        const inventoryResult = await mobileNotificationService.updateProductInventory(productId, nextInventory);
        if (!inventoryResult.success) {
          console.error('[ORDER-STOCK] Failed to decrement product inventory via server route:', productId, inventoryResult.error);
          continue;
        }

        updatedProductIds.add(productId);
        console.log('[ORDER-STOCK] Inventory updated for product', productId, 'from', currentInventory, 'to', nextInventory);
      }

      for (const row of rowsToDeduct) {
        const productId = String(row?.product_id || '');
        if (!updatedProductIds.has(productId)) {
          continue;
        }

        const mergedMeta = {
          ...(row?.meta || {}),
          stock_deducted: true,
          stock_deducted_at: new Date().toISOString(),
          stock_deducted_reason: 'order_created',
        };

        const { error: markErr } = await supabase
          .from('user_items')
          .update({
            meta: mergedMeta,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);

        if (markErr) {
          console.error('[ORDER-STOCK] Failed to mark stock_deducted for order row:', row.id, markErr);
        }
      }
    } catch (err) {
      console.error('[ORDER-STOCK] Unexpected inventory deduction error:', err);
    }
  };

  const verifyAndSyncPaidOrder = async (sessionId: string): Promise<boolean> => {
    if (!sessionId) return false;

    try {
      const user = await getCurrentUser();
      if (!user) return false;

      const extra = (Constants.expoConfig?.extra as Record<string, any> | undefined) || {};
      const paymongoSecretKey = String(extra.paymongoSecretKey || '').trim();
      if (!paymongoSecretKey) return false;

      console.log('[PAYMENT-SYNC] Starting verification for session:', sessionId, 'userId:', user.id);

      for (let attempt = 0; attempt < 8; attempt += 1) {
        console.log(`[PAYMENT-SYNC] Verification attempt ${attempt + 1}/8 for session:`, sessionId);
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

        console.log(`🔍 [PAYMENT-SYNC] Attempt ${attempt + 1}: isPaid=${isPaid}, hasPaidFlag=${hasPaidFlag}, hasPaidPayment=${hasPaidPayment}, statusText='${statusText}', intentStatus='${paymentIntentStatus}'`);

        if (!isPaid) {
          if (attempt < 7) {
            console.log(`⏳ [PAYMENT-SYNC] Not paid yet. Waiting 2.5s before retry...`);
            await wait(2500);
          }
          continue;
        }

        console.log('✅ [PAYMENT-SYNC] Payment confirmed as PAID at PayMongo!');

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

        console.log('💳 [PAYMENT-SYNC] Payment verified! Writing paymentReferenceId:', paymentReferenceId, ' (from payments[0].id or payment_intent)');
        const paidPayload: Record<string, any> = {
          payment_status: PAYMONGO_STATUS_PAID,
          payment_method: PAYMONGO_PAYMENT_METHOD,
          payment_intent_id: paymentReferenceId,
          payment_id: paymentReferenceId,
          order_status: 'pending_payment',
          updated_at: new Date().toISOString(),
        };
        console.log('💳 [PAYMENT-SYNC] Payload to write to DB:', JSON.stringify(paidPayload));

        if (fullName?.trim()) paidPayload.customer_name = fullName.trim();
        if (email?.trim()) paidPayload.customer_email = email.trim();
        if (phone?.trim()) paidPayload.customer_phone = phone.trim();
        if (paidAmount && !Number.isNaN(paidAmount)) paidPayload.total_paid = paidAmount;

        const updatedIds = new Set<string>();
        const syncErrors: string[] = [];

        // 1) Most reliable matcher: rows inserted in this exact checkout flow.
        if (lastCreatedOrderIds.length > 0) {
          console.log('📝 [PAYMENT-SYNC] Matcher 1: Updating rows by ID:', lastCreatedOrderIds);
          const byIds = await supabase
            .from('user_items')
            .update(paidPayload)
            .in('id', lastCreatedOrderIds)
            .select('id, payment_status, payment_intent_id, payment_id');

          if (byIds.error?.message) {
            console.error('❌ [PAYMENT-SYNC] Matcher 1 error:', byIds.error.message);
            syncErrors.push(byIds.error.message);
          }

          (byIds.data || []).forEach((row: any) => {
            if (row?.id) {
              console.log('✅ [PAYMENT-SYNC] Matcher 1 updated row:', row.id, '-> payment_status:', row.payment_status, '| payment_intent_id:', row.payment_intent_id, '| payment_id:', row.payment_id);
              updatedIds.add(String(row.id));
            }
          });
        }

        // 2) Primary fallback: session stored in meta.
        console.log('📝 [PAYMENT-SYNC] Matcher 2: Checking rows by meta.payment_session_id:', sessionId);
        const byMeta = await supabase
          .from('user_items')
          .update(paidPayload)
          .eq('user_id', user.id)
          .contains('meta', { payment_session_id: sessionId })
          .select('id, payment_status, payment_intent_id, payment_id');

        if (byMeta.error?.message) {
          console.error('❌ [PAYMENT-SYNC] Matcher 2 error:', byMeta.error.message);
          syncErrors.push(byMeta.error.message);
        }

        (byMeta.data || []).forEach((row: any) => {
          if (row?.id) {
            console.log('✅ [PAYMENT-SYNC] Matcher 2 updated row:', row.id, '-> payment_status:', row.payment_status, '| payment_intent_id:', row.payment_intent_id, '| payment_id:', row.payment_id);
            updatedIds.add(String(row.id));
          }
        });

        // 3) Final fallback: direct payment_intent_id column match.
        if (!byMeta.data || byMeta.data.length === 0) {
          console.log('📝 [PAYMENT-SYNC] Matcher 3: Checking rows by payment_intent_id:', sessionId);
          const byIntent = await supabase
            .from('user_items')
            .update(paidPayload)
            .eq('user_id', user.id)
            .eq('payment_intent_id', sessionId)
            .select('id, payment_status, payment_intent_id, payment_id');

          if (byIntent.error?.message) {
            console.error('❌ [PAYMENT-SYNC] Matcher 3 error:', byIntent.error.message);
            syncErrors.push(byIntent.error.message);
          }

          (byIntent.data || []).forEach((row: any) => {
            if (row?.id) {
              console.log('✅ [PAYMENT-SYNC] Matcher 3 updated row:', row.id, '-> payment_status:', row.payment_status, '| payment_intent_id:', row.payment_intent_id, '| payment_id:', row.payment_id);
              updatedIds.add(String(row.id));
            }
          });
        }

        const paidConfirmed = await hasPaidRowInDatabase(
          user.id,
          sessionId,
          paymentReferenceId,
          Array.from(updatedIds)
        );

        console.log('🔎 [PAYMENT-SYNC] DB confirmation check: updatedIds.size=' + updatedIds.size + ', paidConfirmed=' + paidConfirmed);

        if (updatedIds.size > 0 || paidConfirmed) {
          await syncProductStockForPaidOrders(user.id, sessionId, Array.from(updatedIds));
          console.log('✅ [PAYMENT-SYNC] SUCCESS - Order rows marked as PAID in database');
          await clearPendingPaymongoSyncBySession(user.id, sessionId);
          return true;
        }

        // Payment is confirmed at provider but no DB rows were updated yet.
        if (attempt < 7) {
          await wait(2500);
          continue;
        }

        if (syncErrors.length > 0) {
          console.warn('Failed to sync PayMongo paid status to database:', syncErrors.join(' | '));
        }

        return false;
      }
    } catch (err) {
      console.error('Failed to verify/sync paid order from payment screen:', err);
    }

    return false;
  };

  useEffect(() => {
    loadCartItems();
    loadSavedAddresses();
  }, []); // Run only once on mount

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadSavedAddresses();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // When the user returns from the PayMongo checkout page, verify payment and sync DB here
  // (admin site reads status directly from user_items table).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      appState.current = next;
      if (next === 'active' && awaitingReturn) {
        setAwaitingReturn(false);
        console.log('🔄 [PAYMENT-RETURN] App returned to active. lastPaymentSessionId:', lastPaymentSessionId);

        (async () => {
          try {
            if (lastPaymentSessionId) {
              console.log('🔄 [PAYMENT-RETURN] Triggering verifyAndSyncPaidOrder...');
              const dbSynced = await verifyAndSyncPaidOrder(lastPaymentSessionId);
              console.log('🔄 [PAYMENT-RETURN] Sync result:', dbSynced);
              if (dbSynced) {
                router.replace({ pathname: '/payment-success', params: { session_id: lastPaymentSessionId } });
              } else {
                modal.showWarning(
                  'Payment Sync Pending',
                  'Payment is received but database sync is still pending. Please open My Orders and refresh.'
                );
                router.replace('/(tabs)/orders');
              }
            } else {
              router.replace('/(tabs)/shop');
            }
          } catch {
            // Fallback route if needed
            router.replace('/shop' as any);
          }
        })();
      }
    });
    return () => sub.remove();
  }, [awaitingReturn, lastPaymentSessionId, fullName, email, phone, lastCreatedOrderIds]);


  const loadSavedAddresses = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('addresses')
        .select('id, user_id, full_name, email, phone, address, is_default, created_at')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setSavedAddresses(data || []);
      // Don't auto-fill; user must explicitly select from the picker
      return true;
    } catch (e) {
      console.error('Failed to load saved addresses', e);
      return false;
    }
  };

  const fillFormWithAddress = async (addr: any) => {
    setFullName(addr.full_name || '');
    setEmail(addr.email || '');
    setPhone(addr.phone || '');

    const applyPlainAddress = (value: string) => {
      const cleaned = String(value || '').replace(/^Address:\s*/i, '').trim();
      const segments = cleaned.split(',').map((s) => s.trim()).filter(Boolean);

      if (segments.length >= 4) {
        const extractedZip = segments[segments.length - 1] || '';
        const extractedState = segments[segments.length - 2] || '';
        const extractedCity = segments[segments.length - 3] || '';
        const head = segments.slice(0, Math.max(1, segments.length - 3));
        const extractedStreet = head[0] || '';
        const extractedLine2 = head.slice(1).join(', ');

        setStreet(extractedStreet);
        setAddressLine2(extractedLine2);
        setCity(extractedCity);
        setStateRegion(extractedState);
        setZipCode(extractedZip);
      } else {
        setStreet(cleaned);
        setAddressLine2('');
        setCity('');
        setStateRegion('');
        setZipCode('');
      }
    };

    // Normalize address payload (supports JSON string, plain text, or object shape).
    try {
      const rawAddress = addr?.address;
      const parsed = typeof rawAddress === 'string' ? JSON.parse(rawAddress) : rawAddress;
      if (parsed && typeof parsed === 'object') {
        const normalizedStreet = String(parsed.street || parsed.addressLine1 || parsed.line1 || '').trim();
        const normalizedAddressLine2 = String(parsed.addressLine2 || parsed.line2 || '').trim();
        const normalizedCity = String(parsed.city || parsed.town || parsed.municipality || '').trim();
        const normalizedState = String(parsed.stateRegion || parsed.state || parsed.province || '').trim();
        const normalizedZip = String(parsed.zipCode || parsed.postalCode || parsed.zip || '').trim();

        if (normalizedStreet || normalizedAddressLine2 || normalizedCity || normalizedState || normalizedZip) {
          setStreet(normalizedStreet);
          setAddressLine2(normalizedAddressLine2);
          setCity(normalizedCity);
          setStateRegion(normalizedState);
          setZipCode(normalizedZip);

          // Heal legacy JSON addresses so admin/database gets clean plain text from this point onward.
          const plainAddress = [
            normalizedStreet,
            normalizedAddressLine2,
            normalizedCity,
            normalizedState,
            normalizedZip,
          ].filter(Boolean).join(', ');

          if (typeof rawAddress === 'string' && rawAddress.includes('{')) {
            try {
              await supabase
                .from('addresses')
                .update({ address: plainAddress })
                .eq('id', addr.id);
            } catch {
              // Non-blocking cleanup; form should still continue.
            }
          }
        } else {
          // Parsed object without granular fields (for example only label/display).
          applyPlainAddress(String(parsed.display || parsed.label || rawAddress || '').trim());
        }
      } else {
        applyPlainAddress(String(rawAddress || '').trim());
      }
    } catch (e) {
      // Legacy plain text address
      applyPlainAddress(String(addr.address || '').trim());
    }

    setSelectedAddressId(addr.id);
  };

  const manualEdit = (setter: (v: string) => void, val: string) => {
    setter(val);
    setSelectedAddressId('manual');
  };

  const normalizeAddressParts = (
    rawStreet: string,
    rawAddressLine2: string,
    rawCity: string,
    rawStateRegion: string,
    rawZipCode: string
  ) => {
    let streetValue = String(rawStreet || '').trim();
    let line2Value = String(rawAddressLine2 || '').trim();
    let cityValue = String(rawCity || '').trim();
    let stateValue = String(rawStateRegion || '').trim();
    let zipValue = String(rawZipCode || '').trim();

    const extractEmbeddedJson = (value: string) => {
      const start = value.indexOf('{');
      const end = value.lastIndexOf('}');
      if (start < 0 || end <= start) return null;
      const candidate = value.slice(start, end + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        try {
          return JSON.parse(candidate.replace(/\\"/g, '"'));
        } catch {
          return null;
        }
      }
    };

    // If street accidentally contains serialized address JSON (including prefixed text like "Address: {...}"), extract readable fields.
    const parsedFromStreet = extractEmbeddedJson(streetValue);
    if (parsedFromStreet && typeof parsedFromStreet === 'object') {
      try {
        streetValue = String(parsedFromStreet.street || parsedFromStreet.addressLine1 || parsedFromStreet.line1 || parsedFromStreet.display || streetValue).trim();
        line2Value = String(parsedFromStreet.addressLine2 || parsedFromStreet.line2 || line2Value).trim();
        cityValue = String(parsedFromStreet.city || parsedFromStreet.town || parsedFromStreet.municipality || cityValue).trim();
        stateValue = String(parsedFromStreet.stateRegion || parsedFromStreet.state || parsedFromStreet.province || stateValue).trim();
        zipValue = String(parsedFromStreet.zipCode || parsedFromStreet.postalCode || parsedFromStreet.zip || zipValue).trim();
      } catch {
        // Keep original values if parsing fails.
      }
    }

    streetValue = streetValue.replace(/^Address:\s*/i, '').trim();

    return {
      street: streetValue,
      addressLine2: line2Value,
      city: cityValue,
      stateRegion: stateValue,
      zipCode: zipValue,
    };
  };

  const loadCartItems = async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();
      console.log('Auth data:', user?.id);
      if (!user) {
        modal.showError('Not signed in', 'Please sign in to continue.');
        router.replace('/login');
        return;
      }

      // Prefill contact details from authenticated user if form is still empty.
      if (!fullName.trim()) {
        const fallbackName = getDisplayNameFromUser(user);
        if (fallbackName) setFullName(fallbackName);
      }
      if (!email.trim()) {
        const userEmail = String(user?.email || '').trim();
        if (userEmail) setEmail(userEmail);
      }
      if (!phone.trim()) {
        const metadataPhone = String(user?.user_metadata?.phone || user?.user_metadata?.phone_number || '').trim();
        if (metadataPhone) setPhone(metadataPhone);
      }

      // Get selected item IDs from navigation params
      let selectedIds: string[] = [];
      if (params.selectedIds) {
        try {
          selectedIds = JSON.parse(params.selectedIds as string);
        } catch (e) {
          console.error('Failed to parse selectedIds', e);
        }
      }

      // Use the same 'cart' table as cart screen for consistency
      let query = supabase
        .from('cart')
        .select(`
          id,
          product_id,
          quantity,
          meta,
          products (
            name,
            image1,
            price,
            category,
            material,
            inventory,
            width,
            height,
            thickness
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // If specific items were selected, filter by those IDs
      if (selectedIds.length > 0) {
        query = query.in('id', selectedIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform data to match CartItem type
      const items = (data ?? []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        name: item.products?.name || 'Unknown Product',
        qty: item.quantity || 1,
        price: item.products?.price || 0, // Get price from products table  
        stock: Number.isFinite(Number(item.products?.inventory))
          ? Number(item.products?.inventory)
          : 0,
        image: item.products?.image1 || null,
        category: item.products?.category || '',
        material: item.products?.material || '',
        width: item.products?.width ?? null,
        height: item.products?.height ?? null,
        thickness: item.products?.thickness ?? null,
      }));
      setCartItems(items as CartItem[]);

      setItemMeasurements((prev) => {
        const next: Record<string, MeasurementConfig> = {};
        for (const item of items as CartItem[]) {
          const existing = prev[item.id];
          next[item.id] = existing || {
            useCustom: false,
            width: normalizeDimension(item.width),
            height: normalizeDimension(item.height),
            thickness: normalizeDimension(item.thickness),
          };
        }
        return next;
      });

      if (items.length === 0) {
        modal.showWarning('Empty Cart', 'Your cart is empty. Please add items first.');
        setTimeout(() => router.back(), 1500);
      }
    } catch (e: any) {
      console.error('Failed to load cart items', e);
      modal.showError('Error', `Failed to load cart items: ${e?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (item.price ?? 0) * (item.qty ?? 1), 0);
  }, [cartItems]);

  const hasCustomMeasurements = useMemo(() => {
    return cartItems.some((item) => itemMeasurements[item.id]?.useCustom);
  }, [cartItems, itemMeasurements]);

  const addOnsTotal = useMemo(() => {
    return colorCustomization ? COLOR_CUSTOMIZATION_PRICE : 0;
  }, [colorCustomization]);

  const subtotalWithAddOns = useMemo(() => {
    return subtotal + addOnsTotal;
  }, [subtotal, addOnsTotal]);

  const discountAmount = useMemo(() => {
    if (!appliedDiscount) {
      console.log('Discount Amount: No discount applied');
      return 0;
    }

    const value = parseFloat(appliedDiscount.value) || 0;
    console.log('Discount calculation - Type:', appliedDiscount.type, 'Value:', value, 'SubtotalWithAddOns:', subtotalWithAddOns);

    let discount = 0;
    if (appliedDiscount.type === 'percent') {
      discount = (subtotalWithAddOns * value) / 100;
      console.log('Percent discount calculated:', discount);
    } else if (appliedDiscount.type === 'fixed') {
      discount = value;
      console.log('Fixed discount applied:', discount);
    }

    console.log('Final discount amount:', discount);
    return discount;
  }, [appliedDiscount, subtotalWithAddOns]);

  const totalProductValue = subtotalWithAddOns - discountAmount;

  console.log('=== PRICE BREAKDOWN ===');
  console.log('Subtotal:', subtotal);
  console.log('Add-ons:', addOnsTotal);
  console.log('Subtotal with add-ons:', subtotalWithAddOns);
  console.log('Discount amount:', discountAmount);
  console.log('Total product value:', totalProductValue);
  console.log('=======================');

  const remainingBalance = Math.max(0, totalProductValue - RESERVATION_FEE);

  const formatCurrency = (v: number) =>
    v.toLocaleString(undefined, { style: 'currency', currency: 'PHP', minimumFractionDigits: 0 });

  const applyDiscountCode = async () => {
    if (!discountCode.trim()) {
      modal.showWarning('Invalid Code', 'Please enter a discount code.');
      return;
    }

    try {
      setApplyingDiscount(true);

      const codeToCheck = discountCode.trim();

      // Single-row lookup to minimize egress.
      const { data, error } = await supabase
        .from('discount_codes')
        .select('code, active, type, value, starts_at, expires_at, max_uses, used_count, min_subtotal')
        .ilike('code', codeToCheck)
        .maybeSingle();

      if (error) {
        console.error('Discount query error:', error);
        modal.showError('Error', `Database error: ${error.message}`);
        return;
      }

      if (!data) {
        modal.showError('Invalid Code', `Discount code "${codeToCheck}" not found.`);
        return;
      }

      // Check if code is active
      const isActive = data.active === true || data.active === 'true' || data.active === 1 || data.active === '1';

      if (!isActive) {
        modal.showWarning('Invalid Code', 'This discount code is no longer active.');
        return;
      }

      // Check if discount has started
      if (data.starts_at) {
        const startDate = new Date(data.starts_at);
        const now = new Date();
        console.log('13. Start date check:', startDate, 'vs Now:', now, 'Started?:', startDate <= now);
        if (startDate > now) {
          modal.showWarning('Invalid Code', 'This discount code is not yet active.');
          return;
        }
      }

      // Check expiry
      if (data.expires_at) {
        const expiryDate = new Date(data.expires_at);
        const now = new Date();
        console.log('14. Expiry check:', expiryDate, 'vs Now:', now, 'Expired?:', expiryDate < now);
        if (expiryDate < now) {
          modal.showWarning('Invalid Code', 'This discount code has expired.');
          return;
        }
      }

      // Check if usage limit has been reached
      if (data.max_uses && data.max_uses > 0) {
        const usedCount = parseInt(data.used_count) || 0;
        const maxUses = parseInt(data.max_uses) || 0;
        console.log('15. Usage check:', usedCount, '>=', maxUses, '?', usedCount >= maxUses);
        if (usedCount >= maxUses) {
          modal.showWarning('Invalid Code', 'This discount code has reached its usage limit.');
          return;
        }
      }

      // Check minimum purchase requirement
      const minSubtotal = parseFloat(data.min_subtotal || '0') || 0;
      console.log('16. Min subtotal check:', minSubtotal, 'vs', subtotalWithAddOns, 'Pass?:', subtotalWithAddOns >= minSubtotal);
      if (minSubtotal > 0 && subtotalWithAddOns < minSubtotal) {
        modal.showWarning(
          'Minimum Purchase Not Met',
          `This code requires a minimum purchase of ${formatCurrency(minSubtotal)}.\n\nYour current total: ${formatCurrency(subtotalWithAddOns)}`
        );
        return;
      }

      console.log('17. ✅ All checks passed! Applying discount...');
      setAppliedDiscount(data);

      const discountValue = parseFloat(data.value) || 0;
      const discountType = data.type === 'percent' ? 'percentage' : 'fixed amount';
      modal.showSuccess('Success!', `Discount code "${data.code}" applied!\n\n${discountValue}${data.type === 'percent' ? '%' : ' PHP'} ${discountType} discount`);
    } catch (e: any) {
      console.error('Failed to apply discount:', e);
      modal.showError('Error', `Failed to apply discount code: ${e.message || 'Unknown error'}`);
    } finally {
      setApplyingDiscount(false);
    }
  };

  const removeDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode('');
  };

  const [processingPayment, setProcessingPayment] = useState(false);

  const validateStockBeforeCheckout = async (): Promise<boolean> => {
    try {
      const qtyByProductId = new Map<string, number>();
      for (const item of cartItems) {
        const productId = String(item.product_id || '').trim();
        if (!productId) continue;
        const qty = Math.max(1, Number(item.qty) || 1);
        qtyByProductId.set(productId, (qtyByProductId.get(productId) || 0) + qty);
      }

      const productIds = Array.from(qtyByProductId.keys());
      if (productIds.length === 0) return true;

      const { data: productRows, error } = await supabase
        .from('products')
        .select('id, name, inventory')
        .in('id', productIds);

      if (error) {
        modal.showError('Stock Check Failed', error.message || 'Unable to verify stock right now.');
        return false;
      }

      const rowById = new Map<string, any>();
      (productRows || []).forEach((row: any) => {
        const id = String(row?.id || '').trim();
        if (id) rowById.set(id, row);
      });

      const violations: string[] = [];
      for (const [productId, requestedQty] of qtyByProductId.entries()) {
        const row = rowById.get(productId);
        const currentStock = Number(row?.inventory || 0);
        const safeStock = Math.max(0, Number(currentStock) || 0);
        if (requestedQty > safeStock) {
          const name = String(row?.name || cartItems.find((c) => String(c.product_id) === productId)?.name || 'Product');
          violations.push(`${name}: requested ${requestedQty}, available ${safeStock}`);
        }
      }

      if (violations.length > 0) {
        modal.showWarning('Insufficient Stock', `Please adjust quantities before checkout:\n\n${violations.join('\n')}`);
        await loadCartItems();
        return false;
      }

      return true;
    } catch (e: any) {
      modal.showError('Stock Check Failed', e?.message || 'Unable to verify stock right now.');
      return false;
    }
  };

  const createPayMongoCheckout = async () => {
    try {
      setProcessingPayment(true);

      // Get authenticated user
      const user = await getCurrentUser();
      if (!user) {
        modal.showError('Error', 'Please sign in to continue.');
        return;
      }

      const stockOk = await validateStockBeforeCheckout();
      if (!stockOk) {
        return;
      }

      console.log('Creating PayMongo checkout...');
      console.log('Total amount:', totalProductValue);

      // Prepare order details
      const normalizedParts = normalizeAddressParts(street, addressLine2, city, stateRegion, zipCode);
      const normalizedStreet = normalizedParts.street;
      const normalizedAddressLine2 = normalizedParts.addressLine2;
      const normalizedCity = normalizedParts.city;
      const normalizedStateRegion = normalizedParts.stateRegion;
      const normalizedZipCode = normalizedParts.zipCode;
      const normalizedDeliveryAddress = [
        normalizedStreet,
        normalizedAddressLine2,
        normalizedCity,
        normalizedStateRegion,
        normalizedZipCode,
      ].filter(Boolean).join(', ');
      const cleanDeliveryAddress = normalizedDeliveryAddress.replace(/^Address:\s*/i, '').trim();

      const orderDetails = {
        user_id: user.id,
        items: cartItems.map(item => ({
          id: item.id,
          product_id: item.product_id,
          name: item.name,
          quantity: item.qty,
          price: item.price,
          measurements: itemMeasurements[item.id]?.useCustom
            ? {
              use_custom: true,
              width_mm: Number(itemMeasurements[item.id]?.width || 0),
              height_mm: Number(itemMeasurements[item.id]?.height || 0),
              thickness_mm: Number(itemMeasurements[item.id]?.thickness || 0),
            }
            : {
              use_custom: false,
              width_mm: Number(normalizeDimension(item.width) || 0),
              height_mm: Number(normalizeDimension(item.height) || 0),
              thickness_mm: Number(normalizeDimension(item.thickness) || 0),
            },
        })),
        address: {
          fullName,
          email,
          phone,
          addressLine1: normalizedStreet,
          addressLine2: normalizedAddressLine2,
          city: normalizedCity,
          stateRegion: normalizedStateRegion,
          zipCode: normalizedZipCode,
        },
        notes,
        add_ons: colorCustomization ? {
          color_customization: {
            enabled: true,
            color: customColor,
            price: COLOR_CUSTOMIZATION_PRICE,
          }
        } : null,
        discount: appliedDiscount ? {
          code: appliedDiscount.code,
          type: appliedDiscount.type,
          value: appliedDiscount.value,
          amount: discountAmount,
        } : null,
        subtotal,
        reservation_fee: RESERVATION_FEE,
        total_amount: totalProductValue,
      };

      // Create PayMongo checkout session (uses env/app config values)
      const extra = (Constants.expoConfig?.extra as Record<string, any> | undefined) || {};
      const paymongoEnvironment = String(extra.paymongoEnvironment || 'live').toLowerCase();
      const PAYMONGO_SECRET_KEY = String(extra.paymongoSecretKey || '').trim();
      const PAYMONGO_RETURN_URL = String(extra.paymongoReturnUrl || 'grandlinkmobile://payment-success').trim();
      const PAYMONGO_CANCEL_URL = String(extra.paymongoCancelUrl || 'grandlinkmobile://shop').trim();
      const PAYMONGO_API = 'https://api.paymongo.com/v1/checkout_sessions';

      if (!PAYMONGO_SECRET_KEY) {
        modal.showError('Payment Error', 'Missing PayMongo secret key in app environment configuration.');
        return;
      }

      if (paymongoEnvironment === 'live' && PAYMONGO_SECRET_KEY.startsWith('sk_test_')) {
        modal.showError('Payment Error', 'PayMongo is set to LIVE but the configured key is a TEST key. Please set PAYMONGO_SECRET_KEY to an sk_live key.');
        return;
      }

      // Build description
      let description = `${cartItems.length} item(s)`;
      if (colorCustomization) description += ' with color customization';
      if (hasCustomMeasurements) description += ' with custom measurements';
      if (appliedDiscount) description += ` - Discount: ${appliedDiscount.code}`;

      const checkoutData = {
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            line_items: [
              {
                currency: 'PHP',
                amount: Math.round(totalProductValue * 100), // Convert to centavos (cents)
                name: 'GrandLink Order',
                quantity: 1,
                description: description,
              }
            ],
            // Use QRPH only for live online QR payments.
            payment_method_types: ['qrph'],
            description: `Order for ${user.email || 'customer'}`,
            reference_number: `GE-${Date.now()}`,
            success_url: PAYMONGO_RETURN_URL,
            cancel_url: PAYMONGO_CANCEL_URL,
            metadata: {
              user_id: user.id,
              address: cleanDeliveryAddress,
              customer_name: fullName,
              customer_phone: phone,
              has_discount: appliedDiscount ? 'yes' : 'no',
              has_addon: colorCustomization ? 'yes' : 'no',
              has_custom_measurements: hasCustomMeasurements ? 'yes' : 'no',
            }
          }
        }
      };

      console.log('Sending request to PayMongo...');

      const response = await fetch(PAYMONGO_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(PAYMONGO_SECRET_KEY + ':')}`,
        },
        body: JSON.stringify(checkoutData),
      });

      const result = await response.json();
      console.log('PayMongo response:', result);

      if (result.data && result.data.attributes && result.data.attributes.checkout_url) {
        const checkoutUrl = result.data.attributes.checkout_url;
        const sessionId = result.data.id;

        console.log('Checkout URL:', checkoutUrl);
        console.log('Payment Session ID:', sessionId);

        // --- SAVE TO DATABASE ---
        // Create records in 'user_items' for each product in the cart
        const orderRecords = cartItems.map(item => ({
          user_id: user.id,
          product_id: item.product_id,
          item_type: 'order',
          quantity: item.qty,
          price: item.price,
          total_amount: (item.price ?? 0) * (item.qty ?? 1),
          reservation_fee: RESERVATION_FEE,
          status: 'active',
          order_status: 'pending',
          payment_status: PAYMONGO_STATUS_UNPAID,
          payment_method: PAYMONGO_PAYMENT_METHOD,
          payment_intent_id: sessionId,
          customer_name: fullName,
          customer_email: email,
          customer_phone: phone,
          delivery_address_id: selectedAddressId !== 'manual' ? selectedAddressId : null,
          delivery_address: cleanDeliveryAddress,
          special_instructions: notes,
          meta: {
            payment_session_id: sessionId,
            add_ons: colorCustomization ? {
              color_customization: {
                enabled: true,
                color: customColor,
                price: COLOR_CUSTOMIZATION_PRICE,
              }
            } : null,
            discount: appliedDiscount ? {
              code: appliedDiscount.code,
              amount: discountAmount,
            } : null,
            contact_info: {
              fullName,
              email,
              phone
            },
            detailed_address: {
              street: normalizedStreet,
              addressLine2: normalizedAddressLine2,
              city: normalizedCity,
              stateRegion: normalizedStateRegion,
              zipCode: normalizedZipCode,
            },
            measurements: itemMeasurements[item.id]?.useCustom
              ? {
                use_custom: true,
                width_mm: Number(itemMeasurements[item.id]?.width || 0),
                height_mm: Number(itemMeasurements[item.id]?.height || 0),
                thickness_mm: Number(itemMeasurements[item.id]?.thickness || 0),
                default_width_mm: Number(normalizeDimension(item.width) || 0),
                default_height_mm: Number(normalizeDimension(item.height) || 0),
                default_thickness_mm: Number(normalizeDimension(item.thickness) || 0),
              }
              : {
                use_custom: false,
                width_mm: Number(normalizeDimension(item.width) || 0),
                height_mm: Number(normalizeDimension(item.height) || 0),
                thickness_mm: Number(normalizeDimension(item.thickness) || 0),
              },
          },
        }));

        console.log('📦 [ORDER-INSERT] Creating order records with payment_intent_id (session ID):', sessionId, 'for', cartItems.length, 'items');

        const { data: insertedRows, error: dbError } = await supabase
          .from('user_items')
          .insert(orderRecords)
          .select('id, product_id, quantity, meta, payment_intent_id, payment_method, customer_name, customer_email, customer_phone, delivery_address');

        if (dbError) {
          console.error('Failed to save order to database:', dbError);
          modal.showError(
            'Order Save Failed',
            'Your order could not be saved to our database, so payment will not continue. Please try again.'
          );
          return;
        } else {
          let insertedOrderIds = (insertedRows || []).map((row: any) => row?.id).filter(Boolean);
          console.log('✅ [ORDER-INSERT] Successfully inserted', insertedOrderIds.length, 'order rows with payment_intent_id:', sessionId);
          (insertedRows || []).forEach((row: any) => {
            console.log('📝 [ORDER-INSERT] Row', row.id, '-> payment_intent_id:', row.payment_intent_id);
          });

          // If insert succeeded but no rows were returned, fetch by session ID as fallback.
          if (insertedOrderIds.length === 0) {
            const { data: fetchedRows } = await supabase
              .from('user_items')
              .select('id')
              .eq('user_id', user.id)
              .eq('item_type', 'order')
              .eq('payment_intent_id', sessionId)
              .order('created_at', { ascending: false })
              .limit(cartItems.length || 10);

            insertedOrderIds = (fetchedRows || []).map((row: any) => row?.id).filter(Boolean);
          }

          if (insertedOrderIds.length === 0) {
            modal.showError(
              'Order Save Failed',
              'Order records could not be confirmed in the database, so payment will not continue. Please retry checkout.'
            );
            return;
          }

          // Deduct product inventory immediately after order rows are created.
          // This keeps products.inventory in sync even before paid-session reconciliation runs.
          const { data: freshOrderRows, error: freshRowsErr } = await supabase
            .from('user_items')
            .select('id, product_id, quantity, meta')
            .in('id', insertedOrderIds);

          if (freshRowsErr) {
            console.warn('⚠️ [ORDER-STOCK] Failed to load fresh order rows for inventory deduction:', freshRowsErr);
          } else {
            await deductInventoryForFreshOrders(freshOrderRows || []);
          }

          setLastCreatedOrderIds(insertedOrderIds);
          await savePendingPaymongoSync(user.id, sessionId, insertedOrderIds);

          const missingCriticalFields = (insertedRows || []).some((row: any) =>
            !row?.payment_intent_id ||
            !row?.payment_method ||
            !row?.customer_name ||
            !row?.customer_email ||
            !row?.customer_phone ||
            !String(row?.delivery_address || '').trim() ||
            String(row?.delivery_address || '').includes('{')
          );

          // Defensive sync to keep admin-facing columns populated even if DB defaults/triggers overwrite values.
          if (missingCriticalFields) {
            const syncPayload = {
              payment_intent_id: sessionId,
              payment_method: PAYMONGO_PAYMENT_METHOD,
              customer_name: fullName,
              customer_email: email,
              customer_phone: phone,
              delivery_address_id: selectedAddressId !== 'manual' ? selectedAddressId : null,
              delivery_address: cleanDeliveryAddress,
              updated_at: new Date().toISOString(),
            };

            if (insertedOrderIds.length > 0) {
              await supabase
                .from('user_items')
                .update(syncPayload)
                .in('id', insertedOrderIds);
            } else {
              await supabase
                .from('user_items')
                .update(syncPayload)
                .eq('user_id', user.id)
                .eq('item_type', 'order')
                .contains('meta', { payment_session_id: sessionId });
            }
          }

          // Clear cart items that were just ordered
          const cartItemIds = cartItems.map(i => i.id);
          await supabase.from('cart').delete().in('id', cartItemIds);

          // 🔔 Notify admin using the shared /api/notify flow used by the website.
          try {
            const itemsForNotification = cartItems.map(item => ({
              productName: item.name,
              quantity: item.qty || 1,
              price: item.price || 0,
            }));

            const totalOrderAmount = cartItems.reduce(
              (sum, item) => sum + ((item.price || 0) * (item.qty || 1)),
              0
            );

            let apiResult: any = null;
            if (cartItems.length === 1) {
              const item = cartItems[0];
              apiResult = await mobileNotificationService.notifyNewOrder(
                insertedOrderIds[0],
                user.id,
                fullName,
                email,
                phone,
                item.name,
                item.qty || 1,
                (item.price || 0) * (item.qty || 1)
              );
            } else {
              apiResult = await mobileNotificationService.notifyBatchOrders(
                insertedOrderIds,
                user.id,
                fullName,
                email,
                phone,
                itemsForNotification,
                totalOrderAmount
              );
            }

            if (apiResult?.success) {
              console.log('✅ [ORDER] Admin notified via /api/notify for', cartItems.length, 'item(s)');
            } else {
              console.warn('⚠️ [ORDER] /api/notify did not confirm success:', apiResult?.error);
            }
          } catch (notificationError) {
            // Log but don't fail the order if notification fails
            console.warn('⚠️ [ORDER] Failed to notify admin (non-blocking):', notificationError);
          }
        }
        // -------------------------

        // Open PayMongo checkout in browser
        const { Linking } = require('react-native');
        const canOpen = await Linking.canOpenURL(checkoutUrl);

        if (canOpen) {
          setLastPaymentSessionId(sessionId);
          setAwaitingReturn(true);
          await Linking.openURL(checkoutUrl);
          // No immediate navigation; we move the user when they return to the app
        } else {
          modal.showError('Error', 'Unable to open payment page. Please try again.');
        }
      } else if (result.errors) {
        console.error('PayMongo errors:', result.errors);
        const errorMsg = result.errors[0]?.detail || 'Failed to create payment session';
        modal.showError('Payment Error', errorMsg);
      } else {
        console.error('Unexpected PayMongo response:', result);
        modal.showError('Error', 'Failed to create payment session. Please try again.');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      modal.showError('Error', `Payment failed: ${error.message || 'Unknown error'}`);
    } finally {
      setProcessingPayment(false);
    }
  };

  const onReserve = () => {
    const requiredFields = [
      { val: fullName, label: 'Full Name' },
      { val: email, label: 'Email' },
      { val: phone, label: 'Phone' },
      { val: street, label: 'Address Line 1' },
      { val: city, label: 'City' },
      { val: stateRegion, label: 'State/Region' },
      { val: zipCode, label: 'Zip Code' }
    ];

    const missing = requiredFields.filter(f => !f.val.trim());
    if (missing.length > 0) {
      modal.showWarning('Missing info', `Please fill in: ${missing.map(m => m.label).join(', ')}`);
      return;
    }
    if (colorCustomization && !customColor.trim()) {
      modal.showWarning('Missing info', 'Please specify the color for customization.');
      return;
    }

    for (const item of cartItems) {
      const config = itemMeasurements[item.id];
      if (!config?.useCustom) continue;

      const widthMm = Number(config.width);
      const heightMm = Number(config.height);
      const thicknessMm = Number(config.thickness);

      if (!Number.isFinite(widthMm) || widthMm <= 0 || !Number.isFinite(heightMm) || heightMm <= 0 || !Number.isFinite(thicknessMm) || thicknessMm <= 0) {
        modal.showWarning(
          'Invalid measurement',
          `Please enter valid Width, Height, and Thickness in mm for ${item.name}.`
        );
        return;
      }
    }

    // Proceed directly to payment
    createPayMongoCheckout();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: pageBg }]}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <ScrollView style={{ backgroundColor: pageBg }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Back button */}
          <View style={styles.backWrap}>
            <TouchableOpacity style={styles.backBtnSmall} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={18} color={textPrimary} />
              <Text style={[styles.backTextSmall, { color: textPrimary }]}>Back to Cart</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#a81d1d" />
              <Text style={[styles.loadingText, { color: textSecondary }]}>Loading order details...</Text>
            </View>
          ) : (
            <View style={styles.infoWrap}>
              {/* Cart Items Summary */}
              <View style={[styles.itemsCard, { backgroundColor: cardBg, borderColor: border }]}>
                <Text style={[styles.sectionTitleLarge, { color: textPrimary }]}>Order Items ({cartItems.length})</Text>
                {cartItems.map((item) => (
                  <View key={item.id} style={[styles.cartItemRow, { borderBottomColor: darkMode ? '#2a2a2a' : '#f5f5f5' }]}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={styles.cartItemImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.cartItemPlaceholder, { backgroundColor: darkMode ? '#252525' : '#f5f5f5' }]}>
                        <Ionicons name="image-outline" size={24} color={darkMode ? '#888' : '#ccc'} />
                      </View>
                    )}
                    <View style={styles.cartItemDetails}>
                      <Text style={[styles.cartItemName, { color: textPrimary }]} numberOfLines={2}>{item.name}</Text>
                      <View style={styles.cartItemPriceRow}>
                        <Text style={styles.cartItemPrice}>₱{(item.price ?? 0).toFixed(2)}</Text>
                        <Text style={[styles.cartItemQty, { color: textSecondary }]}>x {item.qty ?? 1}</Text>
                      </View>
                    </View>
                    <Text style={[styles.cartItemTotal, { color: textPrimary }]}>₱{((item.price ?? 0) * (item.qty ?? 1)).toFixed(2)}</Text>
                  </View>
                ))}
              </View>

              {/* Checkout form */}
              <View style={[styles.formCard, { backgroundColor: cardBg, borderColor: border }]}>
                <Text style={[styles.reserveTitle, { color: textPrimary }]}>Delivery & Payment Details</Text>

                {savedAddresses.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={[styles.formLabel, { color: textPrimary }]}>Use Saved Address</Text>
                    <View style={[styles.pickerWrap, { borderColor: border, backgroundColor: inputBg }]}>
                      <Picker
                        selectedValue={selectedAddressId}
                        onValueChange={(itemValue) => {
                          if (itemValue === 'manual') {
                            setSelectedAddressId('manual');
                          } else {
                            const addr = savedAddresses.find(a => a.id === itemValue);
                            if (addr) fillFormWithAddress(addr);
                          }
                        }}
                        style={styles.picker}
                      >
                        <Picker.Item label="-- Select Saved Address --" value="manual" />
                        {savedAddresses.map((addr) => {
                          let addrLabel = addr.full_name;
                          try {
                            const parsed = JSON.parse(addr.address);
                            if (parsed?.display) {
                              addrLabel = `${addr.full_name} - ${parsed.display.substring(0, 30)}...`;
                            } else {
                              addrLabel = `${addr.full_name} - ${(addr.address || '').substring(0, 30)}...`;
                            }
                          } catch (e) {
                            addrLabel = `${addr.full_name} - ${(addr.address || '').substring(0, 30)}...`;
                          }
                          return (
                            <Picker.Item
                              key={addr.id}
                              label={addrLabel}
                              value={addr.id}
                            />
                          );
                        })}
                      </Picker>
                    </View>
                  </View>
                )}

                <Text style={[styles.formLabel, { color: textPrimary }]}>Contact Information *</Text>
                <TextInput
                  placeholder="Full Name"
                  style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                  placeholderTextColor={textSecondary}
                  value={fullName}
                  onChangeText={(v) => manualEdit(setFullName, v)}
                />
                <TextInput
                  placeholder="Email Address"
                  style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                  placeholderTextColor={textSecondary}
                  value={email}
                  onChangeText={(v) => manualEdit(setEmail, v)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput
                  placeholder="Phone Number"
                  style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                  placeholderTextColor={textSecondary}
                  value={phone}
                  onChangeText={(v) => manualEdit(setPhone, v)}
                  keyboardType="phone-pad"
                />

                <View style={[styles.dividerSmall, { backgroundColor: border }]} />

                <Text style={[styles.formLabel, { color: textPrimary }]}>Delivery Address *</Text>
                <TextInput
                  placeholder="Address Line 1 (Street, House No.)"
                  style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                  placeholderTextColor={textSecondary}
                  value={street}
                  onChangeText={(v) => manualEdit(setStreet, v)}
                />
                <TextInput
                  placeholder="Address Line 2 (Apartment, Suite, etc.) - Optional"
                  style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                  placeholderTextColor={textSecondary}
                  value={addressLine2}
                  onChangeText={(v) => manualEdit(setAddressLine2, v)}
                />
                <TextInput
                  placeholder="City"
                  style={[styles.input, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                  placeholderTextColor={textSecondary}
                  value={city}
                  onChangeText={(v) => manualEdit(setCity, v)}
                />
                <View style={styles.dimRow}>
                  <TextInput
                    placeholder="State / Province / Region"
                    style={[styles.input, { flex: 2, backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                    placeholderTextColor={textSecondary}
                    value={stateRegion}
                    onChangeText={(v) => manualEdit(setStateRegion, v)}
                  />
                  <TextInput
                    placeholder="ZIP / Postal Code"
                    style={[styles.input, { flex: 1, backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                    placeholderTextColor={textSecondary}
                    value={zipCode}
                    onChangeText={(v) => manualEdit(setZipCode, v)}
                    keyboardType="numeric"
                  />
                </View>

                <Text style={[styles.formLabel, { marginTop: 12, color: textPrimary }]}>Special Instructions</Text>
                <TextInput
                  placeholder="Any special requirements or notes..."
                  multiline
                  numberOfLines={3}
                  style={[styles.input, { height: 84, textAlignVertical: 'top', backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                  placeholderTextColor={textSecondary}
                  value={notes}
                  onChangeText={setNotes}
                />

                <Text style={[styles.formLabel, { marginTop: 12, color: textPrimary }]}>Measurements (mm)</Text>
                <Text style={[styles.measurementsHelperText, { color: textSecondary }]}>
                  Default measurements are always shown. Enable the checkbox to edit width, height, and thickness.
                </Text>
                {cartItems.map((item) => {
                  const config = itemMeasurements[item.id] || {
                    useCustom: false,
                    width: normalizeDimension(item.width),
                    height: normalizeDimension(item.height),
                    thickness: normalizeDimension(item.thickness),
                  };

                  const defaultWidth = normalizeDimension(item.width);
                  const defaultHeight = normalizeDimension(item.height);
                  const defaultThickness = normalizeDimension(item.thickness);
                  const defaultText = [
                    defaultWidth ? `${defaultWidth}w` : null,
                    defaultHeight ? `${defaultHeight}h` : null,
                    defaultThickness ? `${defaultThickness}t` : null,
                  ].filter(Boolean).join(' x ');

                  const displayedWidth = config.useCustom ? config.width : defaultWidth;
                  const displayedHeight = config.useCustom ? config.height : defaultHeight;
                  const displayedThickness = config.useCustom ? config.thickness : defaultThickness;

                  return (
                    <View key={`measure-${item.id}`} style={[styles.measurementCard, { backgroundColor: darkMode ? '#202020' : '#fff', borderColor: border }]}>
                      <View style={styles.measurementHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.measurementProductName, { color: textPrimary }]}>{item.name}</Text>
                          <Text style={[styles.measurementDefaultText, { color: textSecondary }]}>
                            Qty: {item.qty ?? 1} {defaultText ? `• Default: ${defaultText} mm` : '• No default dimensions yet'}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.measurementToggleRow}
                        onPress={() => {
                          setItemMeasurements((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...config,
                              useCustom: !config.useCustom,
                            },
                          }));
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.checkboxContainer}>
                          <View
                            style={[
                              styles.checkbox,
                              !config.useCustom && darkMode && { backgroundColor: '#1f1f1f', borderColor: '#555' },
                              config.useCustom && styles.checkboxChecked,
                            ]}
                          >
                            {config.useCustom && <Ionicons name="checkmark" size={16} color="#fff" />}
                          </View>
                          <Text style={[styles.addOnLabel, { color: textPrimary }]}>Change the default measurement for this item</Text>
                        </View>
                      </TouchableOpacity>

                      <View style={styles.dimRow}>
                        <TextInput
                          placeholder="Width (mm)"
                          style={[
                            styles.input,
                            styles.dimInput,
                            { backgroundColor: inputBg, borderColor: border, color: textPrimary },
                            !config.useCustom && { backgroundColor: disabledInputBg, color: disabledInputText, borderColor: darkMode ? '#484848' : border },
                          ]}
                          placeholderTextColor={textSecondary}
                          value={displayedWidth}
                          editable={config.useCustom}
                          keyboardType="numeric"
                          onChangeText={(value) => {
                            setItemMeasurements((prev) => ({
                              ...prev,
                              [item.id]: {
                                ...config,
                                width: value.replace(/[^0-9.]/g, ''),
                              },
                            }));
                          }}
                        />
                        <TextInput
                          placeholder="Height (mm)"
                          style={[
                            styles.input,
                            styles.dimInput,
                            { backgroundColor: inputBg, borderColor: border, color: textPrimary },
                            !config.useCustom && { backgroundColor: disabledInputBg, color: disabledInputText, borderColor: darkMode ? '#484848' : border },
                          ]}
                          placeholderTextColor={textSecondary}
                          value={displayedHeight}
                          editable={config.useCustom}
                          keyboardType="numeric"
                          onChangeText={(value) => {
                            setItemMeasurements((prev) => ({
                              ...prev,
                              [item.id]: {
                                ...config,
                                height: value.replace(/[^0-9.]/g, ''),
                              },
                            }));
                          }}
                        />
                      </View>
                      <TextInput
                        placeholder="Thickness (mm)"
                        style={[
                          styles.input,
                          { backgroundColor: inputBg, borderColor: border, color: textPrimary },
                          !config.useCustom && { backgroundColor: disabledInputBg, color: disabledInputText, borderColor: darkMode ? '#484848' : border },
                        ]}
                        placeholderTextColor={textSecondary}
                        value={displayedThickness}
                        editable={config.useCustom}
                        keyboardType="numeric"
                        onChangeText={(value) => {
                          setItemMeasurements((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...config,
                              thickness: value.replace(/[^0-9.]/g, ''),
                            },
                          }));
                        }}
                      />
                      {!config.useCustom && (
                        <Text style={[styles.measurementDefaultInfo, { color: textSecondary }]}>Editing is disabled while default size is selected.</Text>
                      )}
                    </View>
                  );
                })}

                <Text style={[styles.formLabel, { marginTop: 12, color: textPrimary }]}>Add-ons</Text>
                <TouchableOpacity
                  style={[
                    styles.addOnRow,
                    darkMode && { backgroundColor: '#202020', borderColor: '#333' },
                  ]}
                  onPress={() => {
                    setColorCustomization(!colorCustomization);
                    if (!colorCustomization) {
                      setCustomColor('');
                    }
                  }}
                >
                  <View style={styles.checkboxContainer}>
                    <View
                      style={[
                        styles.checkbox,
                        !colorCustomization && darkMode && { backgroundColor: '#1f1f1f', borderColor: '#555' },
                        colorCustomization && styles.checkboxChecked,
                      ]}
                    >
                      {colorCustomization && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={[styles.addOnLabel, { color: textPrimary }]}>
                      Color Customization (+{formatCurrency(COLOR_CUSTOMIZATION_PRICE)} per unit)
                    </Text>
                  </View>
                </TouchableOpacity>
                {colorCustomization && (
                  <TextInput
                    placeholder="Enter desired color (e.g., blue, red, custom RGB)"
                    style={[styles.input, { marginTop: 8, marginBottom: 6, backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                    placeholderTextColor={textSecondary}
                    value={customColor}
                    onChangeText={setCustomColor}
                  />
                )}

                <Text style={[styles.formLabel, { marginTop: 12, color: textPrimary }]}>Discount Code</Text>
                {appliedDiscount ? (
                  <View style={styles.appliedDiscountContainer}>
                    <View style={styles.appliedDiscountInfo}>
                      <Ionicons name="pricetag" size={20} color="#0b9f34" />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.appliedDiscountCode}>{appliedDiscount.code}</Text>
                        <Text style={styles.appliedDiscountDesc}>
                          {appliedDiscount.type === 'percent'
                            ? `${appliedDiscount.value}% off`
                            : `${formatCurrency(parseFloat(appliedDiscount.value))} off`}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={removeDiscount} style={styles.removeDiscountBtn}>
                        <Ionicons name="close-circle" size={24} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.discountInputRow}>
                    <TextInput
                      placeholder="Enter discount code"
                      style={[styles.input, styles.discountInput, { backgroundColor: inputBg, borderColor: border, color: textPrimary }]}
                      placeholderTextColor={textSecondary}
                      value={discountCode}
                      onChangeText={setDiscountCode}
                      autoCapitalize="characters"
                    />
                    <TouchableOpacity
                      style={[styles.applyDiscountBtn, applyingDiscount && styles.applyDiscountBtnDisabled]}
                      onPress={applyDiscountCode}
                      disabled={applyingDiscount}
                    >
                      {applyingDiscount ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.applyDiscountBtnText}>Apply</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={[styles.formLabel, { marginTop: 12, color: textPrimary }]}>Payment Method</Text>
                <View style={[styles.paymentMethods, { backgroundColor: darkMode ? '#202020' : '#fff', borderColor: border }]}>
                  <View style={styles.radioRow}>
                    <View style={[styles.radio, styles.radioActive]} />
                    <Text style={[styles.radioLabel, { color: textPrimary }]}>PayMongo - QRPH ({formatCurrency(RESERVATION_FEE)})</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.summaryCard, { backgroundColor: cardBg, borderColor: border }]}>
                <Text style={[styles.summaryTitle, { color: textPrimary }]}>Order Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: textPrimary }]}>Product Subtotal ({cartItems.reduce((s, i) => s + (i.qty ?? 1), 0)} items):</Text>
                  <Text style={[styles.summaryValue, { color: textPrimary }]}>{formatCurrency(subtotal)}</Text>
                </View>
                {colorCustomization && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: textPrimary }]}>
                      Add-ons:
                    </Text>
                    <Text style={[styles.summaryValue, { color: textPrimary }]}>
                      {formatCurrency(addOnsTotal)}
                    </Text>
                  </View>
                )}
                {colorCustomization && customColor && (
                  <View style={styles.addOnDetailRow}>
                    <Text style={[styles.addOnDetailText, { color: textSecondary }]}>
                      • Color Customization - {formatCurrency(COLOR_CUSTOMIZATION_PRICE)} ({customColor})
                    </Text>
                  </View>
                )}
                {hasCustomMeasurements && (
                  <View style={styles.addOnDetailRow}>
                    <Text style={[styles.addOnDetailText, { color: textSecondary }]}>
                      • Measurement Customization - {cartItems.filter((item) => itemMeasurements[item.id]?.useCustom).length} item(s)
                    </Text>
                  </View>
                )}
                {appliedDiscount && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: '#0b9f34' }]}>
                      Discount ({appliedDiscount.code}):
                    </Text>
                    <Text style={[styles.summaryValue, { color: '#0b9f34' }]}>
                      -{formatCurrency(discountAmount)}
                    </Text>
                  </View>
                )}
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: textPrimary }]}>Reservation Fee:</Text>
                  <Text style={[styles.summaryValue, { color: textPrimary }]}>{formatCurrency(RESERVATION_FEE)}</Text>
                </View>
                <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: border, paddingTop: 8, marginTop: 8 }]}>
                  <Text style={[styles.summaryLabel, { color: textPrimary, fontWeight: '700', fontSize: 16 }]}>Total:</Text>
                  <Text style={[styles.summaryValue, { fontWeight: '700', fontSize: 18, color: '#a81d1d' }]}>
                    {formatCurrency(totalProductValue)}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.reserveBtn, processingPayment && styles.reserveBtnDisabled]}
                  onPress={onReserve}
                  disabled={processingPayment}
                >
                  {processingPayment ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.reserveBtnText}>Processing...</Text>
                    </View>
                  ) : (
                    <Text style={styles.reserveBtnText}>Place Order & Pay</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* small spacer to allow comfortable scroll above footer */}
              <View style={{ height: 24 }} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 14, paddingBottom: 32 },
  backWrap: {
    width: '100%',
    marginBottom: 8,
    marginTop: Platform.OS === 'android' ? 30 : 0,
  },
  backBtnSmall: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4 },
  backTextSmall: { marginLeft: 8, color: '#333', fontWeight: '600' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },

  infoWrap: { width: '100%' },
  itemsCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    elevation: 1,
  },
  sectionTitleLarge: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#222',
  },
  cartItemRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  cartItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  cartItemPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartItemDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 4,
  },
  cartItemSku: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  cartItemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartItemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#a81d1d',
    marginRight: 8,
  },
  cartItemQty: {
    fontSize: 13,
    color: '#666',
  },
  cartItemTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
    alignSelf: 'center',
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  productSku: { color: '#777' },
  dividerSmall: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 12,
  },

  priceBlock: { alignItems: 'flex-end' },
  price: { color: '#0b9f34', fontSize: 20, fontWeight: '700' },
  stockBadge: { marginTop: 6, backgroundColor: '#f1f5f4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  stockText: { color: '#444', fontSize: 12 },

  sectionTitle: { marginTop: 12, fontWeight: '700', fontSize: 14 },
  description: { marginTop: 6, color: '#444' },
  specsCard: { marginTop: 12, backgroundColor: '#fafafa', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  specsTitle: { fontWeight: '700', marginBottom: 8 },
  specsGrid: { marginTop: 8 },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  specLabel: { color: '#666' },
  specValue: { color: '#222', fontWeight: '600' },

  formCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#eee', shadowColor: '#000', shadowOpacity: 0.03, elevation: 1 },
  reserveTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },

  formLabel: { fontWeight: '700', marginBottom: 6, color: '#333' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  qtyBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#f6f6f6', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 20, fontWeight: '700' },
  qtyInput: { marginHorizontal: 12, borderBottomWidth: Platform.OS === 'web' ? 0 : 1, borderColor: '#ddd', padding: 8, width: 72, textAlign: 'center', borderRadius: 6 },

  input: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, backgroundColor: '#fff', marginBottom: 6, color: '#333' },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 6,
    justifyContent: 'center',
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#333',
  },
  dimRow: { flexDirection: 'row', gap: 8, marginBottom: 8, marginTop: 6 },
  dimInput: { flex: 1 },

  paymentMethods: { marginTop: 8 },
  radioRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#ccc', marginRight: 8 },
  radioActive: { backgroundColor: '#a81d1d', borderColor: '#a81d1d' },
  radioLabel: { color: '#333', flexShrink: 1 },

  summaryCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#eee' },
  summaryTitle: { fontWeight: '700', marginBottom: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { color: '#666' },
  summaryValue: { fontWeight: '700' },

  reserveBtn: { marginTop: 12, backgroundColor: '#a81d1d', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  reserveBtnDisabled: { backgroundColor: '#ccc', opacity: 0.7 },
  reserveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  // Discount code styles
  discountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  discountInput: {
    flex: 1,
    marginBottom: 0,
  },
  applyDiscountBtn: {
    backgroundColor: '#a81d1d',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyDiscountBtnDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  applyDiscountBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  appliedDiscountContainer: {
    backgroundColor: '#f0f9f4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#c6f6d5',
  },
  appliedDiscountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appliedDiscountCode: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0b9f34',
  },
  appliedDiscountDesc: {
    fontSize: 13,
    color: '#2d7a4a',
    marginTop: 2,
  },
  removeDiscountBtn: {
    padding: 4,
  },
  savedAddressCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  savedAddressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  savedAddressTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#a81d1d',
    marginLeft: 6,
  },
  savedAddressText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  changeAddressBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  changeAddressBtnText: {
    fontSize: 13,
    color: '#a81d1d',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  // Add-ons styles
  addOnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#a81d1d',
    borderColor: '#a81d1d',
  },
  addOnLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    flex: 1,
  },
  addOnDetailRow: {
    paddingVertical: 4,
    paddingLeft: 8,
    marginTop: -4,
    marginBottom: 4,
  },
  addOnDetailText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  measurementsHelperText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  measurementCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 10,
    marginBottom: 8,
  },
  measurementHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  measurementProductName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
  },
  measurementDefaultText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  measurementToggleRow: {
    marginBottom: 6,
  },
  measurementDefaultInfo: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
  },
  measurementInputDisabled: {
    backgroundColor: '#f2f2f2',
    color: '#777',
  },
});