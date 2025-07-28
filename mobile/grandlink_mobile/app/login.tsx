import React, { useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import { Link, Stack } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const colorScheme = useColorScheme() ?? 'light';
  const tintColor = Colors[colorScheme].tint;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <ThemedView style={styles.container}>
      {/* Logo at the top */}
      <View style={styles.logoContainer}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.logo}
          contentFit="contain"
        />
        <ThemedText type="title" style={styles.logoText}>GRAND EAST</ThemedText>
        <ThemedText style={styles.logoSubtext}>GLASS AND ALUMINIUM</ThemedText>
      </View>

      {/* Login Card */}
      <View style={styles.card}>
        <ThemedText type="title" style={styles.loginTitle}>Login</ThemedText>
        
        {/* Email Input */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.inputLabel}>Gmail</ThemedText>
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

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <ThemedText style={styles.inputLabel}>Password</ThemedText>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Please Enter your password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
          <TouchableOpacity style={styles.forgotPasswordContainer}>
            <ThemedText style={[styles.forgotPassword, { color: tintColor }]}>Forgot Password</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Login Button */}
        <TouchableOpacity style={[styles.loginButton, { backgroundColor: '#333' }]}>
          <ThemedText style={styles.loginButtonText}>LOGIN</ThemedText>
        </TouchableOpacity>

        {/* Google Sign In */}
        <TouchableOpacity style={styles.googleButton}>
          <Image
            source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
            style={styles.googleIcon}
            contentFit="contain"
          />
          <ThemedText style={styles.googleButtonText}>Sign in with Google</ThemedText>
        </TouchableOpacity>

        {/* Sign Up Link */}
        <View style={styles.signupContainer}>
          <ThemedText>Don't have an account yet? </ThemedText>
          <Link href="/signup">
            <ThemedText style={[styles.signupLink, { color: tintColor }]}>Sign Up</ThemedText>
          </Link>
        </View>
      </View>
    </ThemedView>
       </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
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
  },
  logoSubtext: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'white',
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
    color: '#8B0000', // Dark red color for "Login" text
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    marginBottom: 5,
    fontWeight: '600',
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: 5,
  },
  forgotPassword: {
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#333',
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
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
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
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signupLink: {
    fontWeight: 'bold',
  },
});