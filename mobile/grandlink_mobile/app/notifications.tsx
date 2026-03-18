import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { User } from '@supabase/supabase-js';

import { supabase } from './supabaseClient';

type NotificationPreferences = {
  new_product_notifications: boolean;
  stock_update_notifications: boolean;
  order_status_notifications: boolean;
  email_notifications: boolean;
};

type UserNotification = {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

const defaultPreferences: NotificationPreferences = {
  new_product_notifications: true,
  stock_update_notifications: true,
  order_status_notifications: true,
  email_notifications: true,
};

const preferenceRows: {
  key: keyof NotificationPreferences;
  title: string;
  subtitle: string;
}[] = [
  {
    key: 'order_status_notifications',
    title: 'Order Updates',
    subtitle: 'Get notified when your order moves to a new stage.',
  },
  {
    key: 'email_notifications',
    title: 'Email Notifications',
    subtitle: 'Receive Gmail/email messages for important order events.',
  },
  {
    key: 'new_product_notifications',
    title: 'New Products',
    subtitle: 'Know when new products are added to the catalog.',
  },
  {
    key: 'stock_update_notifications',
    title: 'Stock Updates',
    subtitle: 'Get notified when items are restocked.',
  },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [savingKey, setSavingKey] = useState<keyof NotificationPreferences | null>(null);
  const unreadCount = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications]);

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async (userId: string) => {
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        const { data: inserted, error: insertError } = await supabase
          .from('user_notification_preferences')
          .upsert({
            user_id: userId,
            ...defaultPreferences,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })
          .select('*')
          .single();

        if (insertError) {
          throw insertError;
        }

        return inserted;
      }

      return data;
    };

    const loadNotifications = async (userId: string) => {
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      return (data || []) as UserNotification[];
    };

    const hydrate = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          router.replace('/login');
          return;
        }

        const [prefRow, notifRows] = await Promise.all([
          loadPreferences(data.user.id),
          loadNotifications(data.user.id),
        ]);

        if (!isMounted) return;

        setUser(data.user);
        setPreferences({
          new_product_notifications: prefRow.new_product_notifications ?? true,
          stock_update_notifications: prefRow.stock_update_notifications ?? true,
          order_status_notifications: prefRow.order_status_notifications ?? true,
          email_notifications: prefRow.email_notifications ?? true,
        });
        setNotifications(notifRows);
      } catch (error: any) {
        Alert.alert('Notifications', error?.message || 'Failed to load notifications.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    hydrate();

    const channel = supabase
      .channel('mobile-notification-center')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_notifications' },
        async () => {
          const { data } = await supabase.auth.getUser();
          if (!data.user?.id || !isMounted) return;

          const { data: notifRows } = await supabase
            .from('user_notifications')
            .select('*')
            .eq('user_id', data.user.id)
            .order('created_at', { ascending: false })
            .limit(50);

          if (isMounted) {
            setNotifications((notifRows || []) as UserNotification[]);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [router]);

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user?.id) return;

    const nextPreferences = { ...preferences, [key]: value };
    setPreferences(nextPreferences);
    setSavingKey(key);

    const { error } = await supabase
      .from('user_notification_preferences')
      .upsert({
        user_id: user.id,
        ...nextPreferences,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      setPreferences(preferences);
      Alert.alert('Notifications', error.message || 'Failed to update preferences.');
    }

    setSavingKey(null);
  };

  const markAsRead = async (notificationId: number) => {
    if (!user?.id) return;

    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id);

    if (!error) {
      setNotifications((current) => current.map((item) => (
        item.id === notificationId ? { ...item, is_read: true } : item
      )));
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id || unreadCount === 0) return;

    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      Alert.alert('Notifications', error.message || 'Failed to mark notifications as read.');
      return;
    }

    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#8b1c1c" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#1f2937" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>{unreadCount} unread</Text>
        </View>
        <TouchableOpacity onPress={markAllAsRead} disabled={unreadCount === 0}>
          <Text style={[styles.markAllText, unreadCount === 0 && styles.markAllTextDisabled]}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preferences</Text>
          {preferenceRows.map((row) => (
            <View key={row.key} style={styles.preferenceRow}>
              <View style={styles.preferenceCopy}>
                <Text style={styles.preferenceTitle}>{row.title}</Text>
                <Text style={styles.preferenceSubtitle}>{row.subtitle}</Text>
              </View>
              <Switch
                value={preferences[row.key]}
                onValueChange={(value) => updatePreference(row.key, value)}
                disabled={savingKey === row.key}
                trackColor={{ false: '#d1d5db', true: '#f0b8b8' }}
                thumbColor={preferences[row.key] ? '#8b1c1c' : '#f9fafb'}
              />
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Activity</Text>
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={28} color="#9ca3af" />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySubtitle}>Order updates and product alerts will appear here.</Text>
            </View>
          ) : (
            notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[styles.notificationItem, !notification.is_read && styles.notificationUnread]}
                onPress={() => markAsRead(notification.id)}
                activeOpacity={0.85}
              >
                <View style={styles.notificationIconWrap}>
                  <Ionicons
                    name={notification.is_read ? 'mail-open-outline' : 'notifications-outline'}
                    size={18}
                    color={notification.is_read ? '#6b7280' : '#8b1c1c'}
                  />
                </View>
                <View style={styles.notificationBody}>
                  <Text style={styles.notificationTitle}>{notification.title}</Text>
                  <Text style={styles.notificationMessage}>{notification.message}</Text>
                  <Text style={styles.notificationDate}>{formatDate(notification.created_at)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f7fb',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#4b5563',
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#6b7280',
  },
  markAllText: {
    color: '#8b1c1c',
    fontSize: 13,
    fontWeight: '700',
  },
  markAllTextDisabled: {
    color: '#9ca3af',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  preferenceCopy: {
    flex: 1,
    paddingRight: 16,
  },
  preferenceTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  preferenceSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  emptySubtitle: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    color: '#6b7280',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  notificationUnread: {
    backgroundColor: '#fff8f8',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  notificationIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notificationBody: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  notificationMessage: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: '#4b5563',
  },
  notificationDate: {
    marginTop: 6,
    fontSize: 12,
    color: '#9ca3af',
  },
});