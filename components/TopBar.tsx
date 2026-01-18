import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Text, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/app/supabaseClient';
import { Ionicons } from '@expo/vector-icons';

type TopBarProps = {
  onProfilePress?: () => void;
};

export default function TopBar({ onProfilePress }: TopBarProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState<number>(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState<any[]>([]);
  const [notifUnread, setNotifUnread] = useState<number>(0);
  const notifChannelRef = useRef<any>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          setUser(authData.user);
          
          // Check if user has a Google profile image
          const metadata = authData.user.user_metadata;
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
        const { count, error } = await supabase
          .from('user_items')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('item_type', 'order')
          .eq('status', 'active');
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
          { event: '*', schema: 'public', table: 'user_items', filter: `user_id=eq.${uid}` },
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
          .select('*')
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

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
    } else {
      router.push('/(tabs)/profile');
    }
  };

  return (
    <View style={styles.container}>
      {/* Logo */}
      <Image
        source={require('@/assets/images/GRANDEASTLOGO.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* Right actions: Notifications + Cart + Profile */}
      <View style={styles.rightActions}>
        {/* Notifications */}
        <View style={{ position: 'relative', zIndex: 9999 }}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setNotifOpen((v) => !v)}
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={22} color="#333" />
            {notifUnread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText} numberOfLines={1}>
                  {notifUnread > 99 ? '99+' : notifUnread}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Removed extra inline count to avoid duplicated numbers next to the bell */}

          {notifOpen && (
            <View style={styles.dropdown}>
              <View style={styles.dropdownHeader}>
                <Text style={styles.dropdownTitle}>Notifications</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={markAllAsRead}>
                    <Text style={styles.dropdownLink}>Mark all as read</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setNotifOpen(false); router.push('/(tabs)/notification'); }}>
                    <Text style={styles.dropdownLink}>View all</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {notifItems.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="notifications-off-outline" size={20} color="#999" />
                  <Text style={{ color: '#999', marginTop: 6 }}>No notifications</Text>
                </View>
              ) : (
                <FlatList
                  data={notifItems}
                  keyExtractor={(n) => String(n.id)}
                  contentContainerStyle={{ paddingVertical: 6 }}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.notifRow, !item.is_read && styles.notifRowUnread]}
                      onPress={async () => {
                        try {
                          await supabase.from('user_notifications').update({ is_read: true }).eq('id', item.id);
                          setNotifItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
                          setNotifUnread((u) => Math.max(0, u - (item.is_read ? 0 : 1)));
                        } catch {}
                        if (item.action_url) {
                          setNotifOpen(false);
                          try { router.push(item.action_url as any); } catch {}
                        }
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="notifications" size={16} color={item.is_read ? '#666' : '#8B1C1C'} />
                        <Text style={[styles.notifTitle, { color: item.is_read ? '#444' : '#8B1C1C' }]} numberOfLines={1}>
                          {item.title || 'Notification'}
                        </Text>
                      </View>
                      <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
                      <Text style={styles.notifDate}>{new Date(item.created_at).toLocaleString()}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.push('/(tabs)/cart')}
          accessibilityLabel="Cart"
        >
          <Ionicons name="cart-outline" size={24} color="#333" />
          {cartCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {cartCount > 99 ? '99+' : cartCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profileButton}
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
    paddingVertical: 0,
    paddingTop: 1, // Account for status bar
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
    height: 100,
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
    position: 'absolute',
    right: 0,
    top: 48,
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
  dropdownTitle: { fontWeight: '700', color: '#333' },
  dropdownLink: { color: '#8B1C1C', fontWeight: '600' },
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
