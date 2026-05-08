import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, ImageBackground } from "react-native";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { supabase } from "./supabaseClient";
import { useModal } from '@/hooks/useModal'; 
import { useAppContext } from '@/context/AppContext';

export default function RegisterScreen() {
  const { darkMode } = useAppContext();
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const modal = useModal();

  const passwordChecks = useMemo(() => {
    const pw = password ?? '';
    const hasLower = /[a-z]/.test(pw);
    const hasUpper = /[A-Z]/.test(pw);
    const hasNumber = /\d/.test(pw);
    const hasSymbol = /[^A-Za-z0-9]/.test(pw);
    const minLen8 = pw.length >= 8;
    return { minLen8, hasLower, hasUpper, hasNumber, hasSymbol };
  }, [password]);

  const passwordStrength = useMemo(() => {
    const { minLen8, hasLower, hasUpper, hasNumber, hasSymbol } = passwordChecks;
    const score = [minLen8, hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
    if (!password) return { label: 'Enter a password', color: '#666' as const, score: 0 };
    if (score <= 2) return { label: 'Weak', color: '#b91c1c' as const, score };
    if (score <= 4) return { label: 'Medium', color: '#b45309' as const, score };
    return { label: 'Strong', color: '#166534' as const, score };
  }, [password, passwordChecks]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setInterval(() => {
      setCooldownSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownSeconds]);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleRegister = async () => {
    if (cooldownSeconds > 0) {
      modal.showWarning('Please wait', `Try again in ${cooldownSeconds}s.`);
      return;
    }

    const trimmedFirstName = firstName.trim();
    const trimmedMiddleName = middleName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const pw = password;
    const cpw = confirmPassword;

    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail || !pw || !cpw) {
      modal.showWarning("Error", "Please fill in all fields.");
      return;
    }
    if (!emailRegex.test(trimmedEmail)) {
      modal.showWarning("Invalid Email", "Please enter a valid email address.");
      return;
    }
    if (pw.length < 6) {
      modal.showWarning("Weak Password", "Password must be at least 6 characters.");
      return;
    }

    // Strength guidance (still allow sign-up, but warn)
    if (passwordStrength.score < 3) {
      modal.showWarning(
        'Weak Password',
        'Your password looks weak. Add length (8+), uppercase, lowercase, numbers, and symbols for a stronger password.'
      );
      return;
    }
    if (pw !== cpw) {
      modal.showWarning("Error", "Passwords do not match.");
      return;
    }

    const displayName = [trimmedFirstName, trimmedMiddleName, trimmedLastName]
      .filter(Boolean)
      .join(' ');

    try {
      setLoading(true);
      setCooldownSeconds(60);
      const { error, data } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: pw,
        options: {
          data: {
            first_name: trimmedFirstName,
            middle_name: trimmedMiddleName || null,
            last_name: trimmedLastName,
            full_name: displayName,
            name: displayName,
          },
        },
      });
      if (error) {
        // Friendly duplicate email message
        const msg = /already registered|user already exists|Duplicate/i.test(error.message)
          ? 'This email is already registered. Try logging in instead.'
          : error.message;
        modal.showError("Registration Failed", msg);
        return;
      }

      // Success: take user back to Login
      modal.showSuccess(
        "Success",
        "Account created. Please check your email to verify your account."
      );
      setTimeout(() => router.replace("/login"), 2000);
    } catch (e: any) {
      modal.showError("Registration Failed", e?.message ?? 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground
        source={require("@/assets/images/loginbg.png")}
        style={styles.bg}
        imageStyle={styles.bgImage}
        resizeMode="cover"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.container}>
          <View style={[styles.card, { backgroundColor: darkMode ? '#1a1a1a' : '#fff' }]}>
            {/* Brand header moved inside the form card */}
            <View style={styles.logoContainer}>
              <Image
                source={require("@/assets/images/GRANDEASTLOGO.png")}
                style={styles.logo}
                contentFit="contain"
              />
              <Text style={styles.logoText}>GRAND EAST</Text>
              <Text style={[styles.logoSubtext, { color: darkMode ? '#b8b8b8' : '#555' }]}>GLASS AND ALUMINIUM</Text>
            </View>
            <Text style={styles.title}>Register</Text>

            {/* Name Inputs */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: darkMode ? '#e6e6e6' : '#333' }]}>First Name</Text>
              <View style={[styles.inputWrapper, { backgroundColor: darkMode ? '#242424' : '#f3f4f6', borderColor: darkMode ? '#3a3a3a' : '#d1d5db' }]}>
                <Ionicons name="person" size={18} color={darkMode ? '#b0b0b0' : '#999'} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: darkMode ? '#f0f0f0' : '#222' }]}
                  placeholder="Please Enter your First Name"
                  placeholderTextColor={darkMode ? '#9a9a9a' : '#999'}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: darkMode ? '#e6e6e6' : '#333' }]}>Middle Name <Text style={{ fontWeight: '400', color: darkMode ? '#b8b8b8' : '#666' }}>(Optional)</Text></Text>
              <View style={[styles.inputWrapper, { backgroundColor: darkMode ? '#242424' : '#f3f4f6', borderColor: darkMode ? '#3a3a3a' : '#d1d5db' }]}>
                <Ionicons name="person" size={18} color={darkMode ? '#b0b0b0' : '#999'} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: darkMode ? '#f0f0f0' : '#222' }]}
                  placeholder="Please Enter your Middle Name"
                  placeholderTextColor={darkMode ? '#9a9a9a' : '#999'}
                  value={middleName}
                  onChangeText={setMiddleName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: darkMode ? '#e6e6e6' : '#333' }]}>Last Name</Text>
              <View style={[styles.inputWrapper, { backgroundColor: darkMode ? '#242424' : '#f3f4f6', borderColor: darkMode ? '#3a3a3a' : '#d1d5db' }]}>
                <Ionicons name="person" size={18} color={darkMode ? '#b0b0b0' : '#999'} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: darkMode ? '#f0f0f0' : '#222' }]}
                  placeholder="Please Enter your Last Name"
                  placeholderTextColor={darkMode ? '#9a9a9a' : '#999'}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: darkMode ? '#e6e6e6' : '#333' }]}>Gmail</Text>
              <View style={[styles.inputWrapper, { backgroundColor: darkMode ? '#242424' : '#f3f4f6', borderColor: darkMode ? '#3a3a3a' : '#d1d5db' }]}>
                <Ionicons name="mail" size={18} color={darkMode ? '#b0b0b0' : '#999'} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: darkMode ? '#f0f0f0' : '#222' }]}
                  placeholder="Please Enter your Gmail Address"
                  placeholderTextColor={darkMode ? '#9a9a9a' : '#999'}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: darkMode ? '#e6e6e6' : '#333' }]}>Password</Text>
              <View style={[styles.inputWrapper, { backgroundColor: darkMode ? '#242424' : '#f3f4f6', borderColor: darkMode ? '#3a3a3a' : '#d1d5db' }]}>
                <Ionicons name="lock-closed" size={18} color={darkMode ? '#b0b0b0' : '#999'} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: darkMode ? '#f0f0f0' : '#222' }]}
                  placeholder="Please Enter your password"
                  placeholderTextColor={darkMode ? '#9a9a9a' : '#999'}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPressIn={() => setShowPassword(true)}
                  onPressOut={() => setShowPassword(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={showPassword ? "eye" : "eye-off"} 
                    size={16} 
                    color={darkMode ? '#b0b0b0' : '#666'} 
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.passwordHints}>
                <Text style={[styles.passwordStrengthText, { color: passwordStrength.color }]}
                >Strength: {passwordStrength.label}</Text>
                <View style={styles.passwordChecklist}>
                  <Text style={[styles.passwordCheckItem, passwordChecks.minLen8 && styles.passwordCheckItemOk]}>
                    • 8+ characters
                  </Text>
                  <Text style={[styles.passwordCheckItem, passwordChecks.hasUpper && styles.passwordCheckItemOk]}>
                    • Uppercase
                  </Text>
                  <Text style={[styles.passwordCheckItem, passwordChecks.hasLower && styles.passwordCheckItemOk]}>
                    • Lowercase
                  </Text>
                  <Text style={[styles.passwordCheckItem, passwordChecks.hasNumber && styles.passwordCheckItemOk]}>
                    • Number
                  </Text>
                  <Text style={[styles.passwordCheckItem, passwordChecks.hasSymbol && styles.passwordCheckItemOk]}>
                    • Symbol
                  </Text>
                </View>
              </View>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: darkMode ? '#e6e6e6' : '#333' }]}>Confirm Password</Text>
              <View style={[styles.inputWrapper, { backgroundColor: darkMode ? '#242424' : '#f3f4f6', borderColor: darkMode ? '#3a3a3a' : '#d1d5db' }]}>
                <Ionicons name="lock-closed" size={18} color={darkMode ? '#b0b0b0' : '#999'} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: darkMode ? '#f0f0f0' : '#222' }]}
                  placeholder="Confirm your password"
                  placeholderTextColor={darkMode ? '#9a9a9a' : '#999'}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPressIn={() => setShowConfirmPassword(true)}
                  onPressOut={() => setShowConfirmPassword(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={showConfirmPassword ? "eye" : "eye-off"} 
                    size={16} 
                    color={darkMode ? '#b0b0b0' : '#666'} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Register Button */}
            <TouchableOpacity
              style={[styles.button, (loading || cooldownSeconds > 0) && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading || cooldownSeconds > 0}
            >
              <Text style={styles.buttonText}>
                {loading
                  ? 'Registering...'
                  : cooldownSeconds > 0
                    ? `Please wait (${cooldownSeconds}s)`
                    : 'REGISTER'}
              </Text>
            </TouchableOpacity>

            {/* Login Link */}
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 12, textAlign: "center", color: darkMode ? '#b8b8b8' : "#666" }}>
                Already have an account?{" "}
                <Text
                  style={{ color: darkMode ? '#7fb3ff' : "#2563eb" }}
                  onPress={() => router.replace("/login")}
                >
                  Login
                </Text>
              </Text>
            </View>
          </View>
          </View>
        </ScrollView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: 8,
  },
  logoText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#8B1C1C",
    letterSpacing: 1,
  },
  logoSubtext: {
    fontSize: 12,
    color: "#555",
    marginTop: -2,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#8B1C1C",
    marginBottom: 18,
    textAlign: "center",
  },
  inputContainer: {
    width: "100%",
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
    color: "#333",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#222", // black text
    paddingVertical: 4,
    backgroundColor: "transparent",
  },
  eyeIcon: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: "#232d3b",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    width: "100%",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },

  passwordHints: {
    marginTop: 8,
    width: '100%',
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  passwordChecklist: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  passwordCheckItem: {
    fontSize: 12,
    color: '#666',
  },
  passwordCheckItemOk: {
    color: '#166534',
    fontWeight: '700',
  },
} as any);