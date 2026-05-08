import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Text, ScrollView, Modal, Pressable, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/app/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TopBarProps = {
  onProfilePress?: () => void;
};

export default function TopBar({ onProfilePress }: TopBarProps) {
  const router = useRouter();
  const { darkMode } = useAppContext();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<any>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState<number>(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState<any[]>([]);
  const [notifUnread, setNotifUnread] = useState<number>(0);
  const notifChannelRef = useRef<any>(null);
  const NOTIFICATION_COLUMNS = 'id, user_id, title, message, type, is_read, created_at, metadata, action_url, product_id, order_id';

  const getCurrentUser = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      return sessionData.session.user;
    }

    const { data: authData } = await supabase.auth.getUser();
    return authData?.user ?? null;
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          
          // Check if user has a Google profile image
          const metadata = currentUser.user_metadata;
          if (metadata?.avatar_url) {
            setProfileImage(metadata.avatar_url);
          } else if (metadata?.picture) {
            setProfileImage(metadata.picture);
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };

    loadUser();

    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        const metadata = session.user.user_metadata;
        if (metadata?.avatar_url) {
          setProfileImage(metadata.avatar_url);
        } else if (metadata?.picture) {
          setProfileImage(metadata.picture);
        }
      } else {
        setUser(null);
        setProfileImage(null);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Load cart count for current user and subscribe to realtime changes
  useEffect(() => {
    let channel: any;
    const uid = user?.id;

    const loadCartCount = async () => {
      if (!uid) {
        setCartCount(0);
        return;
      }
      try {
        // Query the correct 'cart' table instead of 'user_items'
        const { count, error } = await supabase
          .from('cart')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', uid);
        if (error) throw error;
        setCartCount(count ?? 0);
      } catch (e) {
        // Fail silently; keep previous count
        // console.warn('Failed to load cart count', e);
      }
    };

    loadCartCount();

    if (uid) {
      channel = supabase
        .channel(`cart-count-${uid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cart', filter: `user_id=eq.${uid}` },
          () => loadCartCount()
        )
        .subscribe();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Notifications: load latest and subscribe for real-time updates
  useEffect(() => {
    const uid = user?.id;

    const loadNotifications = async () => {
      if (!uid) {
        setNotifItems([]);
        setNotifUnread(0);
        return;
      }
      try {
        // Fetch latest 10 notifications
        const { data, error } = await supabase
          .from('user_notifications')
          .select(NOTIFICATION_COLUMNS)
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(10);
        if (!error && data) setNotifItems(data);

        const { count } = await supabase
          .from('user_notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('is_read', false);
        setNotifUnread(count ?? 0);
      } catch (e) {
        // ignore errors, keep existing
      }
    };

    loadNotifications();

    if (uid) {
      // Cleanup previous channel
      if (notifChannelRef.current) supabase.removeChannel(notifChannelRef.current);
      const ch = supabase
        .channel(`user-notifs-${uid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${uid}` },
          async () => {
            await loadNotifications();
          }
        )
        .subscribe();
      notifChannelRef.current = ch;
    }

    return () => {
      if (notifChannelRef.current) supabase.removeChannel(notifChannelRef.current);
    };
  }, [user?.id]);

  const markAllAsRead = async () => {
    if (!user?.id) return;
    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    if (!error) {
      setNotifItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setNotifUnread(0);
    }
  };

  // Auto-mark all as read whenever the dropdown is opened
  useEffect(() => {
    if (notifOpen) markAllAsRead();
  }, [notifOpen]);

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
    } else {
      router.push('/(tabs)/profile');
    }
  };

  const getNotificationNavigationTarget = async (item: any): Promise<any> => {
    const metadata = item?.metadata && typeof item.metadata === 'object' ? item.metadata : {};
    const rawType = String(item?.type || '').toLowerCase();
    const title = String(item?.title || '');
    const message = String(item?.message || '');
    const normalizeActionUrl = (raw: any): any => {
      const value = String(raw || '').trim();
      if (!value) return null;

      const lower = value.toLowerCase();

      if (lower === '/(tabs)/orders' || lower === '/orders' || lower === 'orders' || lower === '../orders') {
        return '/(tabs)/orders';
      }
      if (lower === '/(tabs)/shop' || lower === '/shop' || lower === 'shop' || lower === '../shop') {
        return '/(tabs)/shop';
      }
      if (lower === '/(tabs)/notification' || lower === '/notification' || lower === 'notification' || lower === '../notification') {
        return '/(tabs)/notification';
      }
      if (lower === '/(tabs)/profile' || lower === '/profile' || lower === 'profile' || lower === '../profile') {
        return '/(tabs)/profile';
      }

      if (lower.startsWith('/(tabs)/product')) {
        return value;
      }

      if (lower.startsWith('/product') || lower.startsWith('product')) {
        const idMatch = value.match(/[?&]id=([^&]+)/i);
        const idFromPath = value.split('/').filter(Boolean).pop();
        const productId = (idMatch?.[1] || idFromPath || '').trim();
        if (productId && !productId.includes('product')) {
          return { pathname: '/(tabs)/product', params: { id: decodeURIComponent(productId) } };
        }
      }

      return null;
    };

    const looksLikeOrderUpdate =
      rawType === 'order_status' ||
      Boolean(item?.order_id) ||
      Boolean(metadata?.order_id) ||
      /order\s*status/i.test(title) ||
      /order\s*status/i.test(message);

    const looksLikeCompletedOrder =
      /completed/i.test(title) ||
      /completed/i.test(message) ||
      String(metadata?.order_status || '').toLowerCase() === 'completed' ||
      String(metadata?.status || '').toLowerCase() === 'completed';

    if (looksLikeOrderUpdate) {
      return looksLikeCompletedOrder ? '/(tabs)/completed' : '/(tabs)/orders';
    }

    const looksLikeStockUpdate =
      rawType === 'stock_update' ||
      Boolean(item?.product_id) ||
      Boolean(metadata?.product_id) ||
      /stock/i.test(title) ||
      /stock/i.test(message);

    if (looksLikeStockUpdate) {
      const stockProductId = String(item?.product_id || metadata?.product_id || '').trim();
      if (stockProductId) {
        return { pathname: '/(tabs)/product', params: { id: stockProductId } };
      }
      return '/(tabs)/shop';
    }

    const looksLikeNewProduct =
      rawType === 'new_product' ||
      Boolean(item?.product_id) ||
      Boolean(metadata?.product_id) ||
      /new\s*product/i.test(title);

    if (looksLikeNewProduct) {
      const directProductId = String(item?.product_id || metadata?.product_id || '').trim();
      if (directProductId) {
        return { pathname: '/(tabs)/product', params: { id: directProductId } };
      }

      const nameFromMeta = String(metadata?.product_name || '').trim();
      const nameFromMessage = (() => {
        const m = message.match(/new\s*product\s*:\s*(.+)$/i);
        return m?.[1]?.trim() || '';
      })();
      const candidateName = nameFromMeta || nameFromMessage;

      if (candidateName) {
        try {
          const { data: productRow } = await supabase
            .from('products')
            .select('id')
            .ilike('name', candidateName)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (productRow?.id) {
            return { pathname: '/(tabs)/product', params: { id: String(productRow.id) } };
          }
        } catch {
          // Fallback below.
        }
      }

      return '/(tabs)/shop';
    }

    const normalizedAction = normalizeActionUrl(item?.action_url);
    if (normalizedAction) return normalizedAction;

    return '/(tabs)/notification';
  };

  const topSpacing = (insets.top || StatusBar.currentHeight || 0) + 10;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: topSpacing,
          backgroundColor: darkMode ? '#121212' : '#ffffff',
          borderBottomColor: darkMode ? '#2b2b2b' : '#f0f0f0',
        },
      ]}
    >
      {/* Logo */}
      <View style={[styles.logoWrap, { borderColor: darkMode ? '#5a5a5a' : '#ffffff' }]}>
        <Image
          source={require('@/assets/images/grandeast_transparent.png')}
          style={[styles.logo, darkMode && { tintColor: '#f5f5f5' }]}
          resizeMode="contain"
        />
      </View>

      {/* Right actions: Notifications + Cart + Profile */}
      <View style={styles.rightActions}>
        {/* Notifications */}
        <View style={{ position: 'relative', zIndex: 9999 }}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: darkMode ? '#1f1f1f' : '#f5f5f5', borderColor: darkMode ? '#3a3a3a' : '#e0e0e0' }]}
            onPress={() => setNotifOpen((v) => !v)}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={22} color={darkMode ? '#e6e6e6' : '#333'} />
            {notifUnread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText} numberOfLines={1}>
                  {notifUnread > 99 ? '99+' : notifUnread}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Removed extra inline count to avoid duplicated numbers next to the bell */}

          <Modal
            visible={notifOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setNotifOpen(false)}
          >
            <View style={styles.dropdownModalRoot}>
              <Pressable style={styles.dropdownBackdrop} onPress={() => setNotifOpen(false)} />
              <View style={styles.dropdownFloating}>
                <View style={[styles.dropdown, { backgroundColor: darkMode ? '#1e1e1e' : '#fff', borderColor: darkMode ? '#353535' : '#eee' }]}>
                  <View style={styles.dropdownHeader}>
                    <Text style={[styles.dropdownTitle, { color: darkMode ? '#f2f2f2' : '#333' }]}>Notifications</Text>
                    <TouchableOpacity style={styles.actionButton} onPress={() => { setNotifOpen(false); router.push('/(tabs)/notification'); }}>
                      <Text style={styles.actionButtonText}>View all</Text>
                    </TouchableOpacity>
                  </View>
                  {notifItems.length === 0 ? (
                    <View style={styles.emptyWrap}>
                      <Ionicons name="notifications-off-outline" size={20} color="#999" />
                      <Text style={{ color: '#999', marginTop: 6 }}>No notifications</Text>
                    </View>
                  ) : (
                    <ScrollView
                      style={styles.dropdownList}
                      contentContainerStyle={{ paddingVertical: 6 }}
                      showsVerticalScrollIndicator={true}
                      nestedScrollEnabled={true}
                      keyboardShouldPersistTaps="handled"
                    >
                      {notifItems.map((item) => (
                        <TouchableOpacity
                          key={String(item.id)}
                          style={[
                            styles.notifRow,
                            { backgroundColor: darkMode ? '#1a1a1a' : '#fff' },
                            !item.is_read && (darkMode ? { backgroundColor: '#2a1818' } : styles.notifRowUnread),
                          ]}
                          onPress={async () => {
                            try {
                              await supabase.from('user_notifications').update({ is_read: true }).eq('id', item.id);
                              setNotifItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
                              setNotifUnread((u) => Math.max(0, u - (item.is_read ? 0 : 1)));
                            } catch {}

                            const target = await getNotificationNavigationTarget(item);
                            setNotifOpen(false);
                            try { router.push(target as any); } catch {}
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="notifications" size={16} color={item.is_read ? '#666' : '#8B1C1C'} />
                            <Text style={[styles.notifTitle, { color: item.is_read ? (darkMode ? '#d0d0d0' : '#444') : '#8B1C1C' }]} numberOfLines={1}>
                              {item.title || 'Notification'}
                            </Text>
                          </View>
                          <Text style={[styles.notifMessage, { color: darkMode ? '#b8b8b8' : '#555' }]} numberOfLines={2}>{item.message}</Text>
                          <Text style={[styles.notifDate, { color: darkMode ? '#999' : '#888' }]}>{new Date(item.created_at).toLocaleString()}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              </View>
            </View>
          </Modal>
        </View>

        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: darkMode ? '#1f1f1f' : '#f5f5f5', borderColor: darkMode ? '#3a3a3a' : '#e0e0e0' }]}
          onPress={() => router.push('/(tabs)/cart')}
          accessibilityLabel="Cart"
        >
          <Ionicons name="cart-outline" size={24} color={darkMode ? '#e6e6e6' : '#333'} />
          {cartCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {cartCount > 99 ? '99+' : cartCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.profileButton, { backgroundColor: darkMode ? '#1f1f1f' : '#f5f5f5', borderColor: darkMode ? '#3a3a3a' : '#e0e0e0' }]}
          onPress={handleProfilePress}
          activeOpacity={0.7}
        >
          {profileImage ? (
            <Image
              source={{ uri: profileImage }}
              style={styles.profileImage}
              resizeMode="cover"
            />
          ) : (
            <Image
              source={require('@/assets/images/profileicon.png')}
              style={styles.profileIcon}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 4,
    paddingTop: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    zIndex: 999, // Ensure container has high z-index
  },
  logo: {
    width: 150,
    height: 58,
  },
  logoWrap: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 9999,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  inlineCount: {
    position: 'absolute',
    right: -18,
    top: 10,
    minWidth: 18,
    textAlign: 'center',
    fontSize: 11,
    color: '#a81d1d',
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#a81d1d',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  dropdown: {
    width: 280,
    maxHeight: 340,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 9999,
    zIndex: 9999,
    padding: 8,
    backgroundColor: '#fff',
  },
  dropdownModalRoot: {
    flex: 1,
  },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  dropdownFloating: {
    position: 'absolute',
    right: 14,
    top: 64,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  dropdownList: {
    maxHeight: 268,
  },
  dropdownTitle: { fontWeight: '700', color: '#333' },
  dropdownLink: { color: '#8B1C1C', fontWeight: '600' },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#8B1C1C',
    borderRadius: 6,
    minWidth: 44, // Ensures minimum touch target size
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  emptyWrap: { alignItems: 'center', paddingVertical: 16 },
  notifRow: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  notifRowUnread: { backgroundColor: '#fff6f6' },
  notifTitle: { fontWeight: '700', fontSize: 13, flexShrink: 1 },
  notifMessage: { color: '#555', marginTop: 2, fontSize: 12 },
  notifDate: { color: '#888', marginTop: 4, fontSize: 11 },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  profileIcon: {
    width: 24,
    height: 24,
    tintColor: '#333',
  },
});
