/**
 * Mobile Notification Service
 * 
 * Handles sending notifications from the mobile app to the admin dashboard.
 * Similar to the admin-side notification service, but calls from mobile to admin API.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/app/supabaseClient';

// Get the admin API base URL from app.json extra config
const extra =
  (Constants.expoConfig?.extra as Record<string, any> | undefined) ||
  ((Constants as any).manifest2?.extra as Record<string, any> | undefined) ||
  ((Constants as any).manifest?.extra as Record<string, any> | undefined);

function normalizeBaseUrl(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/$/, '');
}

function rewriteLocalhostForAndroid(baseUrl: string) {
  if (Platform.OS !== 'android') {
    return baseUrl;
  }

  return baseUrl
    .replace(/^http:\/\/localhost(?::(\d+))?$/i, (_match, port) => `http://10.0.2.2${port ? `:${port}` : ''}`)
    .replace(/^http:\/\/127\.0\.0\.1(?::(\d+))?$/i, (_match, port) => `http://10.0.2.2${port ? `:${port}` : ''}`)
    .replace(/^http:\/\/0\.0\.0\.0(?::(\d+))?$/i, (_match, port) => `http://10.0.2.2${port ? `:${port}` : ''}`);
}

function buildCandidateBases(requestUrl?: string) {
  const configuredBase = normalizeBaseUrl(extra?.adminApiUrl) ||
    normalizeBaseUrl(process.env.EXPO_PUBLIC_ADMIN_API_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_ADMIN_ORIGIN) ||
    normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_BASE_URL) ||
    (process.env.EXPO_PUBLIC_API_ENV === 'production'
      ? 'https://your-admin-domain.com'
      : 'http://localhost:3000');

  const inputBase = normalizeBaseUrl(requestUrl);
  const baseCandidates = [inputBase, configuredBase]
    .filter((value): value is string => Boolean(value))
    .map((value) => rewriteLocalhostForAndroid(value));

  // Tolerate common domain typo mismatch (grandlnik <-> grandlink).
  for (const base of [...baseCandidates]) {
    if (base.includes('grandlnik')) {
      baseCandidates.push(base.replace(/grandlnik/g, 'grandlink'));
    }
    if (base.includes('grandlink')) {
      baseCandidates.push(base.replace(/grandlink/g, 'grandlnik'));
    }
  }

  return Array.from(new Set(baseCandidates));
}

function buildNotifyUrls(requestUrl?: string) {
  const endpoints = [
    '/api/notify',
    '/api/notifications/notify',
    '/api/notifications',
    '/api/admin/notify',
  ];

  const urls: string[] = [];
  for (const base of buildCandidateBases(requestUrl)) {
    for (const endpoint of endpoints) {
      try {
        urls.push(new URL(endpoint, base).toString());
      } catch {
        // Ignore malformed base and keep trying other candidates.
      }
    }
  }

  return Array.from(new Set(urls));
}

function buildInventoryUpdateAttempts(productId: string, requestUrl?: string) {
  const attempts: Array<{ url: string; method: 'PATCH' | 'PUT'; body: Record<string, any> }> = [];

  for (const base of buildCandidateBases(requestUrl)) {
    try {
      attempts.push({
        url: new URL('/api/order-management/products', base).toString(),
        method: 'PATCH',
        body: {
          productId,
          inventory: null,
        },
      });
    } catch {
      // Ignore malformed base and continue with the next candidate.
    }

    try {
      attempts.push({
        url: new URL(`/api/products/${encodeURIComponent(productId)}`, base).toString(),
        method: 'PUT',
        body: {
          inventory: null,
        },
      });
    } catch {
      // Ignore malformed base and continue with the next candidate.
    }
  }

  return attempts;
}

async function postNotify(payload: Record<string, any>, requestUrl?: string) {
  const urls = buildNotifyUrls(requestUrl);
  let lastFailure: any = null;

  for (const url of urls) {
    try {
      console.log('📤 [NOTIFICATION] Attempting POST to:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Mobile-Source': 'grandlink-mobile',
        },
        body: JSON.stringify(payload),
      });

      let result: any = {};
      try {
        result = await response.json();
      } catch {
        result = {};
      }

      console.log(`📥 [NOTIFICATION] Response from ${url}:`, { 
        status: response.status, 
        ok: response.ok, 
        result: JSON.stringify(result).substring(0, 200) 
      });

      // Accept various success indicators from the admin backend
      const isSuccess = response.ok && (
        result?.success === true ||
        result?.success === 'true' ||
        result?.ok === true ||
        result?.data?.id ||
        (response.status >= 200 && response.status < 300 && !result?.error && !result?.message)
      );

      if (isSuccess) {
        console.log('✅ [NOTIFICATION] /api notify succeeded via:', url);
        return { success: true, data: result, url };
      }

      lastFailure = {
        success: false,
        error: result?.error || result?.message || response.statusText || `HTTP ${response.status}`,
        status: response.status,
        data: result,
        url,
      };
      console.log('⚠️ [NOTIFICATION] Failed at', url, ':', lastFailure.error);
    } catch (error) {
      lastFailure = { success: false, error, url };
      console.error('❌ [NOTIFICATION] Network/fetch error at', url, ':', error);
    }
  }

  console.error('❌ [NOTIFICATION] All notification endpoints failed. Last error:', lastFailure?.error);
  return lastFailure || { success: false, error: 'No notification URLs available' };
}

async function postInventoryUpdate(productId: string, inventory: number, requestUrl?: string) {
  const attempts = buildInventoryUpdateAttempts(productId, requestUrl).map((attempt) => ({
    ...attempt,
    body: {
      ...attempt.body,
      inventory,
    },
  }));

  let lastFailure: any = null;

  for (const attempt of attempts) {
    try {
      console.log(`📤 [STOCK-UPDATE] Attempting ${attempt.method} to:`, attempt.url, 'with inventory:', inventory);
      const response = await fetch(attempt.url, {
        method: attempt.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Mobile-Source': 'grandlink-mobile',
        },
        body: JSON.stringify(attempt.body),
      });

      let result: any = {};
      try {
        result = await response.json();
      } catch {
        result = {};
      }

      console.log(`📥 [STOCK-UPDATE] Response from ${attempt.url}:`, { 
        status: response.status, 
        ok: response.ok, 
        result: JSON.stringify(result).substring(0, 200) 
      });

      // Accept various success indicators (success field, product in response, or 2xx status without error)
      const isSuccess = response.ok && (
        result?.success === true ||
        result?.success === 'true' ||
        result?.ok === true ||
        result?.product ||
        result?.data?.id ||
        (response.status >= 200 && response.status < 300 && !result?.error && !result?.message)
      );

      if (isSuccess) {
        console.log('✅ [STOCK-UPDATE] Inventory update succeeded via:', attempt.url);
        return { success: true, data: result, url: attempt.url };
      }

      lastFailure = {
        success: false,
        error: result?.error || result?.message || response.statusText || `HTTP ${response.status}`,
        status: response.status,
        data: result,
        url: attempt.url,
      };
      console.log('⚠️ [STOCK-UPDATE] Failed at', attempt.url, ':', lastFailure.error);
    } catch (error) {
      lastFailure = { success: false, error, url: attempt.url };
      console.error('❌ [STOCK-UPDATE] Network/fetch error at', attempt.url, ':', error);
    }
  }

  console.error('❌ [STOCK-UPDATE] All inventory update endpoints failed. Last error:', lastFailure?.error);
  return lastFailure || { success: false, error: 'No inventory update URLs available' };
}

function isAdminRow(row: Record<string, any> | null | undefined) {
  if (!row || typeof row !== 'object') return false;

  const role = String(row.role || row.account_type || row.user_type || '').toLowerCase();
  const isAdminFlag = row.is_admin === true || row.admin === true;
  return role === 'admin' || role === 'superadmin' || isAdminFlag;
}

function extractUserId(row: Record<string, any> | null | undefined): string | null {
  if (!row || typeof row !== 'object') return null;

  const raw = row.user_id || row.id || row.uid;
  const value = String(raw || '').trim();
  return value || null;
}

async function discoverAdminUserIds(): Promise<string[]> {
  const ids = new Set<string>();

  // First, reuse existing admin-targeted notification rows when they include recipient IDs.
  try {
    const { data } = await supabase
      .from('notifications')
      .select('recipient_role, recipient_id, metadata')
      .eq('recipient_role', 'admin')
      .order('created_at', { ascending: false })
      .limit(200);

    if (Array.isArray(data)) {
      for (const row of data as Record<string, any>[]) {
        const directRecipient = String(row?.recipient_id || '').trim();
        if (directRecipient) {
          ids.add(directRecipient);
        }

        const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : null;
        const metaAdminId = String(meta?.admin_id || meta?.recipient_id || '').trim();
        if (metaAdminId) {
          ids.add(metaAdminId);
        }
      }
    }
  } catch {
    // Ignore and continue with table-based discovery.
  }

  if (ids.size > 0) {
    return Array.from(ids);
  }

  const attempts: Array<{ table: string; select: string }> = [
    { table: 'profiles', select: 'id, user_id, role, is_admin, account_type' },
    { table: 'user_profiles', select: 'id, user_id, role, is_admin, account_type' },
    { table: 'users', select: 'id, role, is_admin, account_type' },
    { table: 'admins', select: 'id, user_id' },
  ];

  for (const attempt of attempts) {
    try {
      const { data, error } = await supabase
        .from(attempt.table)
        .select(attempt.select)
        .limit(500);

      if (error || !Array.isArray(data)) {
        continue;
      }

      for (const row of data as Record<string, any>[]) {
        if (attempt.table === 'admins' || isAdminRow(row)) {
          const userId = extractUserId(row);
          if (userId) ids.add(userId);
        }
      }
    } catch {
      // Keep going; this helper is best-effort across unknown schemas.
    }
  }

  return Array.from(ids);
}

async function fanoutAdminUserNotifications(input: {
  title: string;
  message: string;
  type: string;
  metadata: Record<string, any>;
  actionUrl: string;
}) {
  try {
    const adminUserIds = await discoverAdminUserIds();

    if (adminUserIds.length > 0) {
      const rows = adminUserIds.map((adminUserId) => ({
        user_id: adminUserId,
        title: input.title,
        message: input.message,
        type: input.type,
        is_read: false,
        metadata: input.metadata,
        action_url: input.actionUrl,
      }));

      const { error } = await supabase
        .from('user_notifications')
        .insert(rows);

      if (error) {
        return { success: false, error };
      }

      return { success: true, count: rows.length, mode: 'targeted' };
    }

    // Last-resort fallback for admin dashboards that consume broadcast rows.
    const broadcastRow = {
      user_id: null,
      title: input.title,
      message: input.message,
      type: input.type,
      is_read: false,
      metadata: {
        ...input.metadata,
        recipient_role: 'admin',
        broadcast: true,
      },
      action_url: input.actionUrl,
    };

    const { error } = await supabase
      .from('user_notifications')
      .insert([broadcastRow]);

    if (error) {
      return { success: false, error: `No admin user IDs discovered; broadcast insert failed: ${String((error as any)?.message || error)}` };
    }

    return { success: true, count: 1, mode: 'broadcast' };
  } catch (error) {
    return { success: false, error };
  }
}

export const mobileNotificationService = {
  /**
   * Write an admin notification directly into the shared Supabase notifications table.
   */
  async notifyAdminOrderPlaced(input: {
    orderIds: string[];
    paymentSessionId: string;
    userId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    items: Array<{ productName: string; quantity: number; price: number }>;
    totalAmount: number;
    deliveryAddress?: string;
    notes?: string;
    actionUrl?: string;
  }) {
    try {
      const orderCount = input.items.reduce((sum, item) => sum + Math.max(1, item.quantity || 1), 0);
      const itemSummary = input.items
        .map((item) => `${item.productName} x${Math.max(1, item.quantity || 1)}`)
        .join(', ');

      const title = 'New Order';
      const message = input.items.length === 1
        ? `User ${input.customerName} has made an order for ${itemSummary}.`
        : `User ${input.customerName} has made an order with ${input.items.length} items (${orderCount} pcs).`;

      const metadata = {
        source: 'mobile',
        event: 'new_order',
        user_id: input.userId,
        order_id: input.orderIds[0] || null,
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone,
        order_ids: input.orderIds,
        payment_session_id: input.paymentSessionId,
        total_amount: input.totalAmount,
        item_count: input.items.length,
        total_quantity: orderCount,
        items: input.items,
        delivery_address: input.deliveryAddress || null,
        notes: input.notes || null,
      };

      const tryInsert = async (typeValue: string, recipientRole: string) => {
        return supabase
          .from('notifications')
          .insert({
            title,
            message,
            type: typeValue,
            recipient_role: recipientRole,
            recipient_id: null,
            is_read: false,
            priority: 'medium',
            metadata,
            action_url: input.actionUrl || '/orders',
          })
          .select('id, title, message, type, recipient_role')
          .single();
      };

      // Match existing admin-dashboard table patterns first.
      const notificationTypeCandidates = [
        'general',
        'report',
        'task',
        'stock',
        'order_status',
        'order',
        'new_order',
        'order_update',
      ];
      const recipientRoleCandidates = ['all', 'employee', 'admin'];
      let lastError: any = null;
      let data: any = null;

      outerLoop:
      for (const candidateRole of recipientRoleCandidates) {
        for (const candidateType of notificationTypeCandidates) {
          const result = await tryInsert(candidateType, candidateRole);

          if (!result.error) {
            data = result.data;
            lastError = null;
            break outerLoop;
          }

          lastError = result.error;
          const errorText = String(result.error?.message || '').toLowerCase();
          const isTypeConstraint = String(result.error?.code || '') === '23514' &&
            errorText.includes('notifications_type_check');
          const isRoleConstraint = String(result.error?.code || '') === '23514' &&
            (errorText.includes('recipient_role') || errorText.includes('notifications_recipient_role_check'));

          // Keep trying alternatives only for known check-constraint mismatches.
          if (!isTypeConstraint && !isRoleConstraint) {
            break outerLoop;
          }
        }
      }

      if (lastError) {
        console.warn('⚠️ [NOTIFICATION] Failed to write admin notification row:', lastError);
      } else {
        console.log('✅ [NOTIFICATION] Admin notification row created:', data?.id, 'type:', data?.type, 'recipient_role:', data?.recipient_role);

        // Insert additional role variants to satisfy dashboards that filter by specific recipient_role.
        const broadcastRoles = ['all', 'employee', 'admin'].filter((role) => role !== String(data?.recipient_role || ''));
        for (const role of broadcastRoles) {
          try {
            const { error: variantErr } = await supabase
              .from('notifications')
              .insert({
                title,
                message,
                type: data?.type || 'general',
                recipient_role: role,
                recipient_id: null,
                is_read: false,
                priority: 'medium',
                metadata,
                action_url: input.actionUrl || '/orders',
              });

            if (variantErr) {
              console.log('ℹ️ [NOTIFICATION] Role variant insert skipped:', role, variantErr?.message || variantErr);
            } else {
              console.log('✅ [NOTIFICATION] Role variant notification row created for recipient_role:', role);
            }
          } catch (variantError) {
            console.log('ℹ️ [NOTIFICATION] Role variant insert error for', role, variantError);
          }
        }
      }

      // Secondary fan-out: write to per-user admin notifications when admin UI reads user_notifications.
      const fanoutResult = await fanoutAdminUserNotifications({
        title,
        message,
        type: 'order_status',
        metadata,
        actionUrl: input.actionUrl || '/orders',
      });

      if (fanoutResult.success) {
        console.log('✅ [NOTIFICATION] Admin user_notifications fan-out sent:', fanoutResult.mode || 'unknown', 'count =', fanoutResult.count);
      } else {
        console.log('ℹ️ [NOTIFICATION] Admin user_notifications fan-out skipped/failed (non-blocking):', fanoutResult.error);
      }

      if (lastError && !fanoutResult.success) {
        return { success: false, error: lastError };
      }

      return { success: true, data, fanout: fanoutResult };
    } catch (error) {
      console.warn('⚠️ [NOTIFICATION] Error writing admin notification row:', error);
      return { success: false, error };
    }
  },

  /**
   * Notify admin about a new order placed from the mobile app
   */
  async notifyNewOrder(
    orderId: string,
    userId: string,
    customerName: string,
    customerEmail: string,
    customerPhone: string,
    productName: string,
    quantity: number,
    totalAmount: number,
    requestUrl?: string
  ) {
    try {
      const orderCount = Math.max(1, Number(quantity || 1));

      // Primary payload: align with the admin route that creates the dashboard notification.
      const primaryResult = await postNotify(
        {
          type: 'order_placed',
          items: [
            {
              productName,
              quantity: orderCount,
              price: totalAmount,
            },
          ],
          total: totalAmount,
          orderId,
          userId,
          customerName,
          customerEmail,
          customerPhone,
          productName,
          quantity: orderCount,
          totalAmount,
          source: 'mobile',
          timestamp: new Date().toISOString(),
          priority: 'medium',
        },
        requestUrl
      );

      if (primaryResult.success) {
        const directMessage = `User ${customerName} has made an order ${productName} · Qty: ${orderCount}`;
        const { data: directRow, error: directErr } = await supabase
          .from('notifications')
          .insert({
            title: 'New Order',
            message: directMessage,
            type: 'general',
            recipient_role: 'admin',
            recipient_id: null,
            is_read: false,
            priority: 'medium',
            metadata: {
              source: 'mobile',
              event: 'new_order',
              user_id: userId,
              order_id: orderId,
              customer_name: customerName,
              customer_email: customerEmail,
              customer_phone: customerPhone,
              items: [
                {
                  productName,
                  quantity: orderCount,
                  price: totalAmount,
                },
              ],
              total_amount: totalAmount,
            },
            action_url: '/orders',
          })
          .select('id, created_at, recipient_role, type')
          .single();

        if (directErr) {
          console.warn('⚠️ [NOTIFICATION] Direct notifications insert failed for single order:', directErr);
        } else {
          console.log('✅ [NOTIFICATION] Direct notifications row inserted:', directRow?.id, directRow?.recipient_role, directRow?.type);
        }

        // Guarantee admin bell visibility by mirroring to shared notifications table.
        const mirrorResult = await mobileNotificationService.notifyAdminOrderPlaced({
          orderIds: [orderId],
          paymentSessionId: '',
          userId,
          customerName,
          customerEmail,
          customerPhone,
          items: [
            {
              productName,
              quantity: orderCount,
              price: totalAmount,
            },
          ],
          totalAmount,
          actionUrl: '/orders',
        });

        if (!mirrorResult?.success) {
          console.warn('⚠️ [NOTIFICATION] API notify succeeded but DB mirror write failed:', mirrorResult?.error);
        }

        console.log('✅ [NOTIFICATION] Admin notified about new order:', orderId);
        return primaryResult;
      }

      console.warn('⚠️ [NOTIFICATION] Failed to notify admin about order:', primaryResult.error);
      return { success: false, error: primaryResult.error };
    } catch (error) {
      console.warn('⚠️ [NOTIFICATION] Error notifying admin about order:', error);
      return { success: false, error };
    }
  },

  /**
   * Notify admin about batch orders (multiple items in one order)
   */
  async notifyBatchOrders(
    orderIds: string[],
    userId: string,
    customerName: string,
    customerEmail: string,
    customerPhone: string,
    items: Array<{ productName: string; quantity: number; price: number }>,
    totalAmount: number,
    requestUrl?: string
  ) {
    try {
      const primaryResult = await postNotify(
        {
          type: 'order_placed',
          orderIds,
          userId,
          customerName,
          customerEmail,
          customerPhone,
          items,
          total: totalAmount,
          totalAmount,
          itemCount: items.length,
          source: 'mobile',
          timestamp: new Date().toISOString(),
          priority: 'medium',
        },
        requestUrl
      );

      if (primaryResult.success) {
        const orderPieces = items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);
        const orderSummary = items
          .slice(0, 3)
          .map((item) => `${item.productName} · Qty: ${Math.max(1, Number(item.quantity || 1))}`)
          .join(', ');

        const directMessage =
          items.length === 1
            ? `User ${customerName} has made an order ${orderSummary}`
            : `User ${customerName} has made an order with ${items.length} items · Qty: ${orderPieces}`;

        const { data: directRow, error: directErr } = await supabase
          .from('notifications')
          .insert({
            title: 'New Order',
            message: directMessage,
            type: 'general',
            recipient_role: 'admin',
            recipient_id: null,
            is_read: false,
            priority: 'medium',
            metadata: {
              source: 'mobile',
              event: 'new_order',
              user_id: userId,
              order_id: orderIds[0] || null,
              order_ids: orderIds,
              customer_name: customerName,
              customer_email: customerEmail,
              customer_phone: customerPhone,
              items,
              total_amount: totalAmount,
              item_count: items.length,
              total_quantity: orderPieces,
            },
            action_url: '/orders',
          })
          .select('id, created_at, recipient_role, type')
          .single();

        if (directErr) {
          console.warn('⚠️ [NOTIFICATION] Direct notifications insert failed for batch order:', directErr);
        } else {
          console.log('✅ [NOTIFICATION] Direct notifications row inserted for batch:', directRow?.id, directRow?.recipient_role, directRow?.type);
        }

        // Guarantee admin bell visibility by mirroring to shared notifications table.
        const mirrorResult = await mobileNotificationService.notifyAdminOrderPlaced({
          orderIds,
          paymentSessionId: '',
          userId,
          customerName,
          customerEmail,
          customerPhone,
          items,
          totalAmount,
          actionUrl: '/orders',
        });

        if (!mirrorResult?.success) {
          console.warn('⚠️ [NOTIFICATION] API notify succeeded but DB mirror write failed for batch:', mirrorResult?.error);
        }

        console.log('✅ [NOTIFICATION] Admin notified about batch orders from mobile');
        return primaryResult;
      }

      console.warn('⚠️ [NOTIFICATION] Failed to notify admin about batch orders:', primaryResult.error);
      return { success: false, error: primaryResult.error };
    } catch (error) {
      console.warn('⚠️ [NOTIFICATION] Error notifying admin about batch orders:', error);
      return { success: false, error };
    }
  },

  /**
   * Notify admin about payment status update
   */
  async notifyPaymentStatusUpdate(
    orderId: string,
    userId: string,
    paymentStatus: string,
    paymentMethod: string,
    customerName: string,
    customerEmail: string,
    requestUrl?: string
  ) {
    try {
      const urls = buildNotifyUrls(requestUrl);
      const firstUrl = urls[0];
      
      if (!firstUrl) {
        return { success: false, error: 'No notification URLs available' };
      }

      const response = await fetch(firstUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Mobile-Source': 'grandlink-mobile' },
        body: JSON.stringify({
          type: 'mobile_payment_update',
          orderId,
          userId,
          paymentStatus,
          paymentMethod,
          customerName,
          customerEmail,
          source: 'mobile',
          timestamp: new Date().toISOString(),
        }),
      });

      let result: any = {};
      try {
        result = await response.json();
      } catch {
        result = {};
      }

      const isSuccess = response.ok && (result?.success === true || result?.ok === true);
      if (isSuccess) {
        console.log('✅ [NOTIFICATION] Payment update notification sent');
        return { success: true, data: result };
      }

      console.warn('⚠️ [NOTIFICATION] Failed to send payment update notification:', result?.error || response.statusText);
      return { success: false, error: result?.error || result?.message || `HTTP ${response.status}` };
    } catch (error) {
      console.warn('⚠️ [NOTIFICATION] Error sending payment update notification:', error);
      return { success: false, error };
    }
  },

  /**
   * Get the configured admin API URL (useful for debugging)
   */
  getAdminApiUrl(requestUrl?: string): string {
    const [first] = buildNotifyUrls(requestUrl);
    return first || '';
  },

  async updateProductInventory(productId: string, inventory: number, requestUrl?: string) {
    return postInventoryUpdate(productId, inventory, requestUrl);
  },
};
