import React, { useState } from 'react';
import { Alert, ImageBackground, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { Image } from 'expo-image';
import { supabase } from './supabaseClient';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const sendResetLink = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }
    if (!emailRegex.test(trimmed)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    try {
      setLoading(true);
      // Send a password reset with explicit redirect URL to the website reset page
      const redirectTo = 'https://grandlnik-website.vercel.app/forgotpass/reset';
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
      setLoading(false);
      if (error) {
        Alert.alert('Failed to send link', error.message);
        return;
      }
      Alert.alert(
        'Check your email',
        'We sent a password reset link to your inbox. Follow the link to set a new password.',
        [{ text: 'Back to Login', onPress: () => router.replace('/login') }],
      );
    } catch (e: any) {
      setLoading(false);
      Alert.alert('Error', e?.message ?? 'Unexpected error');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground source={require('@/assets/images/loginbg.png')} style={styles.bg} resizeMode="cover">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.container}>
            <View style={styles.card}>
              <View style={styles.logoContainer}>
                <Image source={require('@/assets/images/GRANDEASTLOGO.png')} style={styles.logo} contentFit="contain" />
                <Text style={styles.logoText}>GRAND EAST</Text>
                <Text style={styles.logoSubtext}>GLASS AND ALUMINIUM</Text>
              </View>
              <Text style={styles.title}>Forgot Password</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Gmail</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Please Enter your Gmail Address"
                    placeholderTextColor="#999"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={sendResetLink} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Sending...' : 'SEND RESET LINK'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={{ marginTop: 12 }} onPress={() => router.replace('/login')}>
                <Text style={{ textAlign: 'center', color: '#2563eb', fontWeight: '600' }}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%' },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: 'transparent',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  logoContainer: { alignItems: 'center', marginBottom: 16 },
  logo: { width: 64, height: 64, marginBottom: 8 },
  logoText: { fontSize: 22, fontWeight: 'bold', color: '#8B1C1C', letterSpacing: 1 },
  logoSubtext: { fontSize: 12, color: '#555', marginTop: -2 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#8B1C1C', marginBottom: 16 },
  inputContainer: { width: '100%', marginBottom: 12 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 4, color: '#333' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  input: { flex: 1, fontSize: 15, color: '#222', paddingVertical: 4, backgroundColor: 'transparent' },
  button: { backgroundColor: '#232d3b', borderRadius: 8, paddingVertical: 12, alignItems: 'center', width: '100%', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
