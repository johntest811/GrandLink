import React, { useState, useEffect } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, TextInput, TouchableOpacity, View, ScrollView, ImageBackground, Alert } from 'react-native';
import { Link, Stack, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from './supabaseClient';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const colorScheme = useColorScheme() ?? 'light';
  const tintColor = Colors[colorScheme].tint;
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Login Failed', error.message);
    } else {
      router.replace('/(tabs)/homepage');
    }
  };

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.replace('/(tabs)/homepage');
      }
    });
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
  const redirectTo = 'https://auth.expo.io/@your-username/your-app-slug'; // Replace with your Expo redirect URI
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  });

  if (data?.url) {
    await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  }
  if (error) {
    Alert.alert('Google Login Failed', error.message);
  }
};

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground
        source={require('@/assets/images/loginbg.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <ThemedView style={styles.container}>

            {/* Login Card */}
            <View style={styles.card}>
              {/* Logo at the top */}
              <View style={styles.logoContainer}>
                <Image
                  source={require('@/assets/images/GLLogo.png')}
                  style={styles.logo}
                  contentFit="contain"
                />
                <ThemedText type="title" style={styles.logoText}>GRAND EAST</ThemedText>
                <ThemedText style={styles.logoSubtext}>GLASS AND ALUMINIUM</ThemedText>
              </View>
              <ThemedText type="title" style={styles.loginTitle}>Login</ThemedText>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>Gmail</ThemedText>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Please Enter your Gmail Address"
                    placeholderTextColor="#696969ff"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>Password</ThemedText>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Please Enter your password"
                    placeholderTextColor="#696969ff"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
                <TouchableOpacity style={styles.forgotPasswordContainer}>
                  <ThemedText style={[styles.forgotPassword]}>Forgot Password</ThemedText>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginButton, { backgroundColor: '#000000ff' }]}
                onPress={handleLogin}
                disabled={loading}
              >
                <ThemedText style={styles.loginButtonText}>
                  {loading ? 'Logging in...' : 'LOGIN'}
                </ThemedText>
              </TouchableOpacity>

              {/* Google Sign In */}
              <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
                <Image
                  source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                  style={styles.googleIcon}
                  contentFit="contain"
                />
                <ThemedText style={styles.googleButtonText}>Sign in with Google</ThemedText>
              </TouchableOpacity>

              {/* Sign Up Link */}
              <View style={styles.signupContainer}>
                <ThemedText style={[styles.signupText]}>Don't have an account yet?</ThemedText>
                <Link href="/register">
                  <ThemedText style={[styles.signupLink]}>Sign Up</ThemedText>
                </Link>
              </View>
            </View>
          </ThemedView>
        </ScrollView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'transparent', // Make container transparent
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#803838ff', // White text for better contrast on background
    textShadowColor: 'rgba(0, 0, 0, 0.75)', // Add text shadow for readability
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  logoSubtext: {
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#050505ff', // White text
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Slightly transparent white
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B0000',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    marginBottom: 5,
    fontWeight: '600',
    color: '#080808ff',
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: '#323232ff',
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    fontSize: 13,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: 5,
  },
  forgotPassword: {
    fontSize: 14,
    color: '#000000ff',
    textDecorationLine: 'underline',
  },
  loginButton: {
    backgroundColor: '#271414ff',
    borderRadius: 5,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginButtonPress: {
    marginBottom: 10,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000000ff',
    borderRadius: 5,
    paddingVertical: 10,
    marginBottom: 20,

  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 16,
    color: '#000000ff',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    color: '#000000ff',
  },
  signupLink: {
    fontWeight: 'bold',
    color: '#8f4545ff',
  },
  signupText: {
    fontSize: 14,
    color: '#000000ff',
    marginRight: 8,
  },
});