import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/app/supabaseClient';

// Handle how notifications are displayed when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    // iOS (SDK 53+) specific fields
    shouldShowBanner: true,
    shouldShowList: true,
  } as Notifications.NotificationBehavior),
});

type UserNotification = {
  id: number;
  user_id: string;
  title: string;
  message: string;
  type: 'new_product' | 'stock_update' | 'order_status' | 'general' | string;
  is_read: boolean;
  created_at: string;
  metadata?: any;
  action_url?: string | null;
  product_id?: string | null;
  order_id?: string | null;
};

export default function NotificationScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const channelCreatedRef = useRef(false);

  // Ask for permissions and create Android channel
  const registerForPushAsync = async () => {
    if (!Device.isDevice) {
      setPermissionGranted(false);
      return false;
    }
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    const granted = finalStatus === 'granted';
    setPermissionGranted(granted);

    if (Platform.OS === 'android' && granted && !channelCreatedRef.current) {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
      channelCreatedRef.current = true;
    }
    // Optionally get Expo push token (store it in your backend if you plan server push)
    // NOTE: Android remote push is NOT supported in Expo Go starting SDK 53.
    // Avoid calling getExpoPushTokenAsync in Expo Go on Android to prevent the red error overlay.
    const isExpoGo = Constants.appOwnership === 'expo';
    if (!(Platform.OS === 'android' && isExpoGo)) {
      try {
        await Notifications.getExpoPushTokenAsync();
      } catch {}
    }
    return granted;
  };

  // Fetch initial data
  const fetchNotifications = async (uid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && data) setItems(data as any);
    setLoading(false);
  };

  // Realtime subscription for new notifications
  const subscribeRealtime = (uid: string) => {
    const channel = supabase
      .channel('user_notifications_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${uid}` },
        async (payload: any) => {
          const row = payload.new as UserNotification;
          setItems((prev) => [row, ...prev]);
          // Show a local notification to the user device
          try {
            await Notifications.scheduleNotificationAsync({
              content: { title: row.title || 'Notification', body: row.message },
              trigger: null,
            });
          } catch {}
        }
      )
      .subscribe();
    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  };

  useEffect(() => {
    (async () => {
      // Ensure permissions
      await registerForPushAsync();
      // Resolve user id
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id || null;
      setUserId(uid);
      if (uid) {
        await fetchNotifications(uid);
        const unsub = subscribeRealtime(uid);
        return () => unsub?.();
      } else {
        setLoading(false);
      }
    })();
  }, []);

  const markAllAsRead = async () => {
    if (!userId) return;
    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (!error) setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const renderItem = ({ item }: { item: UserNotification }) => {
    const tint = item.is_read ? '#666' : '#8B1C1C';
    return (
      <TouchableOpacity
        style={[styles.card, !item.is_read && styles.cardUnread]}
        activeOpacity={0.8}
        onPress={async () => {
          // Mark as read
          await supabase.from('user_notifications').update({ is_read: true }).eq('id', item.id);
          setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
          // Navigate if there's an action URL
          if (item.action_url) {
            try { router.push(item.action_url as any); } catch {}
          }
        }}
      >
        <View style={styles.row}>
          <Ionicons name="notifications" size={18} color={tint} />
          <Text style={[styles.title, { color: tint }]} numberOfLines={2}>{item.title}</Text>
        </View>
        <Text style={styles.message} numberOfLines={4}>{item.message}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.typeBadge}>{item.type || 'general'}</Text>
          <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f6f6f6' }}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity style={styles.headerBtn} onPress={markAllAsRead}>
            <Ionicons name="checkmark-done" size={18} color="#fff" />
            <Text style={styles.headerBtnText}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!permissionGranted && (
        <View style={styles.tip}>
          <Text style={styles.tipText}>Enable notifications to receive alerts on your phone.</Text>
          <TouchableOpacity style={styles.tipBtn} onPress={registerForPushAsync}>
            <Text style={styles.tipBtnText}>Enable</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        data={items}
        keyExtractor={(n) => String(n.id)}
        refreshing={loading}
        onRefresh={() => userId && fetchNotifications(userId)}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}> 
            <Ionicons name="notifications-off-outline" size={36} color="#888" />
            <Text style={{ color: '#888', marginTop: 8 }}>No notifications yet</Text>
          </View>
        ) : null}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 44,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#8B1C1C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginRight: 8,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerBtnText: { color: '#fff', fontWeight: '600' },
  tip: {
    margin: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tipText: { color: '#333', flex: 1, marginRight: 12 },
  tipBtn: {
    backgroundColor: '#8B1C1C',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tipBtnText: { color: '#fff', fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardUnread: {
    borderColor: '#f4c7c7',
    backgroundColor: '#fffafa',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title: { fontWeight: '700', fontSize: 15, flex: 1 },
  message: { color: '#444', fontSize: 14 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  typeBadge: { color: '#8B1C1C', backgroundColor: '#fdeaea', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  date: { color: '#777' },
  empty: { alignItems: 'center', marginTop: 40 },
});
