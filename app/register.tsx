import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { supabase } from "./supabaseClient"; 

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !name) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });
    setLoading(false);
    if (error) {
      Alert.alert("Registration Failed", error.message);
    } else {
      Alert.alert("Success", "Check your email for a confirmation link.");
      router.replace("/login");
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.container}>
          <View style={styles.logoContainer}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.logoText}>GRAND EAST</Text>
            <Text style={styles.logoSubtext}>GLASS AND ALUMINIUM</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Register</Text>

            {/* Name Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person" size={18} color="#999" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Please Enter your Full Name"
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Gmail</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail" size={18} color="#999" style={{ marginRight: 8 }} />
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
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed" size={18} color="#999" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Please Enter your password"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed" size={18} color="#999" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm your password"
                  placeholderTextColor="#999"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>
            </View>

            {/* Register Button */}
            <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? "Registering..." : "REGISTER"}</Text>
            </TouchableOpacity>

            {/* Login Link */}
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 12, textAlign: "center", color: "#666" }}>
                Already have an account?{" "}
                <Text
                  style={{ color: "#2563eb" }}
                  onPress={() => router.replace("/login")}
                >
                  Login
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f6f6",
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
    color: "#222",
    paddingVertical: 4,
    backgroundColor: "transparent",
  },
  button: {
    backgroundColor: "#232d3b",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    width: "100%",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});