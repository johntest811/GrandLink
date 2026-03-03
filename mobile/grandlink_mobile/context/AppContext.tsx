import React, { createContext, useContext, useMemo, useState, ReactNode, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '@/app/supabaseClient';

export type AppContextType = {
  darkMode: boolean;
  setDarkMode: (v: boolean) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  } as Notifications.NotificationBehavior),
});

export function AppContextProvider({ children }: { children: ReactNode }) {
  const [darkMode, setDarkMode] = useState(false);
  const channelCreatedRef = useRef(false);

  const ensureNotificationPermissions = async () => {
    if (!Device.isDevice) {
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    const granted = finalStatus === 'granted';

    if (Platform.OS === 'android' && granted && !channelCreatedRef.current) {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
      });
      channelCreatedRef.current = true;
    }

    const isExpoGo = Constants.appOwnership === 'expo';
    if (granted && !(Platform.OS === 'android' && isExpoGo)) {
      try {
        await Notifications.getExpoPushTokenAsync();
      } catch {
      }
    }

    return granted;
  };

  const subscribeToUserNotifications = (uid: string) => {
    const channel = supabase
      .channel(`global_user_notifications_${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${uid}` },
        async (payload: any) => {
          const row = payload.new as { title?: string; message?: string };

          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: row?.title || 'Grand East',
                body: row?.message || 'You have a new notification.',
                sound: true,
              },
              trigger: null,
            });
          } catch {
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
      }
    };
  };

  useEffect(() => {
    let unsubscribeRealtime: (() => void) | undefined;

    const initializeNotifications = async () => {
      await ensureNotificationPermissions();

      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;
      if (uid) {
        unsubscribeRealtime = subscribeToUserNotifications(uid);
      }
    };

    initializeNotifications();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (unsubscribeRealtime) {
        unsubscribeRealtime();
        unsubscribeRealtime = undefined;
      }

      const uid = session?.user?.id;
      if (uid) {
        unsubscribeRealtime = subscribeToUserNotifications(uid);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      if (unsubscribeRealtime) {
        unsubscribeRealtime();
      }
    };
  }, []);

  const value = useMemo(() => ({ darkMode, setDarkMode }), [darkMode]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppContextProvider');
  return ctx;
}
