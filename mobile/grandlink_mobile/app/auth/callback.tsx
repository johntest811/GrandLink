import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../supabaseClient';
import { resendVerificationCode } from '@/services/TwoFactorAuthService';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      console.log('Auth callback received with params:', params);

      const { code, error, error_description, access_token, refresh_token } = params;

      if (error || error_description) {
        console.error('OAuth error:', error, error_description);
        router.replace('/login');
        return;
      }

      let userEmail: string | undefined;

      if (typeof access_token === 'string' && typeof refresh_token === 'string') {
        console.log('Setting session from callback tokens...');
        const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (setSessionError || !sessionData?.session?.user) {
          console.error('Set session error:', setSessionError);
          router.replace('/login');
          return;
        }

        userEmail = sessionData.session.user.email;
      } else if (code && typeof code === 'string') {
        console.log('Exchanging OAuth code for session...');

        const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError || !sessionData?.session?.user) {
          console.error('Session exchange error:', exchangeError);
          router.replace('/login');
          return;
        }

        userEmail = sessionData.session.user.email;
      } else {
        console.error('No OAuth callback data received');
        router.replace('/login');
        return;
      }

      if (!userEmail) {
        console.error('No email found for OAuth user');
        router.replace('/login');
        return;
      }

      console.log('OAuth successful, sending 2FA verification code...');

      const result = await resendVerificationCode(userEmail);

      if (!result.success) {
        console.error('Failed to send 2FA code for OAuth user:', result.error);
        router.replace('/(tabs)/homepage');
        return;
      }

      router.replace({
        pathname: '/verify-code',
        params: {
          email: userEmail,
          password: '',
          isOAuth: 'true'
        },
      });
    } catch (error: any) {
      console.error('Auth callback error:', error);
      router.replace('/login');
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#0066cc" />
      <Text style={{ marginTop: 20, fontSize: 16 }}>Completing authentication...</Text>
    </View>
  );
}