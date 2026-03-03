"use client";

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "../supabaseClient";
import { useAppContext } from "@/context/AppContext"; // ✅ import context (fixed alias)
import BottomNavBar from "@BottomNav/../components/BottomNav";
import TopBar from "@/components/TopBar";


export default function InquirePage() {
  const router = useRouter();
  const { darkMode } = useAppContext(); // ✅ use darkMode
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    service: "",
    message: "",
  });
  const inquiryOptions = [
    "Doors",
    "Windows",
    "Enclosure",
    "Casement",
    "Sliding",
    "Railings",
    "Canopy",
    "Curtain Wall",
    "Custom Design",
  ];
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.service) {
      Alert.alert("Missing Info", "Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = (userData as any)?.user?.id ?? null;

      const payload = {
        user_id: userId,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        inquiry_type: formData.service,
        message: formData.message.trim() || null,
      };

      const { error } = await supabase.from("inquiries").insert([payload]);
      if (error) throw error;

      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        service: "",
        message: "",
      });

      Alert.alert(
        "Success",
        "Your inquiry was successfully sent!",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ],
        { cancelable: true }
      );
    } catch (err) {
      Alert.alert("Error", "Failed to send inquiry. Please try again.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = getStyles(darkMode); // ✅ dynamic styles

  return (
    <View style={styles.screen}>
      {/* Full-width TopBar (not constrained by page padding) */}
      <TopBar />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* Back Button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={darkMode ? "#E3B23C" : "#8B1C1C"}
            />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Inquire Now</Text>
          <Text style={styles.description}>
            We’re happy to help you bring your vision to life. Kindly provide your
            requirements and contact information below.
          </Text>

          <View style={styles.form}>
            <View style={styles.row}>
              <TextInput
                placeholder="First Name"
                placeholderTextColor={darkMode ? "#aaa" : "#555"}
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                value={formData.firstName}
                onChangeText={(text) => handleChange("firstName", text)}
              />
              <TextInput
                placeholder="Last Name"
                placeholderTextColor={darkMode ? "#aaa" : "#555"}
                style={[styles.input, { flex: 1, marginLeft: 8 }]}
                value={formData.lastName}
                onChangeText={(text) => handleChange("lastName", text)}
              />
            </View>

            <TextInput
              placeholder="Email"
              placeholderTextColor={darkMode ? "#aaa" : "#555"}
              keyboardType="email-address"
              style={styles.input}
              value={formData.email}
              onChangeText={(text) => handleChange("email", text)}
            />
            <TextInput
              placeholder="Phone"
              placeholderTextColor={darkMode ? "#aaa" : "#555"}
              keyboardType="phone-pad"
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => handleChange("phone", text)}
            />
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={formData.service}
                onValueChange={(value) => handleChange("service", String(value))}
                dropdownIconColor={darkMode ? "#fff" : "#000"}
                style={styles.picker}
              >
                <Picker.Item
                  label="What is your inquiry about?"
                  value=""
                  color={darkMode ? "#aaa" : "#555"}
                />
                {inquiryOptions.map((opt) => (
                  <Picker.Item key={opt} label={opt} value={opt} color={darkMode ? "#fff" : "#000"} />
                ))}
              </Picker>
            </View>
            <TextInput
              placeholder="Message"
              placeholderTextColor={darkMode ? "#aaa" : "#555"}
              style={[styles.input, { height: 100, textAlignVertical: "top" }]}
              multiline
              value={formData.message}
              onChangeText={(text) => handleChange("message", text)}
            />

            <TouchableOpacity
              style={[styles.button, isSubmitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.buttonText}>
                {isSubmitting ? "Sending..." : "Send Inquiry"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <BottomNavBar />
    </View>
  );
}

const getStyles = (darkMode: boolean) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: darkMode ? "#121212" : "#fafafa",
    },
    scrollContent: {
      paddingBottom: 110,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 10,
    },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10,
    },
    backText: {
      fontSize: 16,
      color: darkMode ? "#E3B23C" : "#8B1C1C",
      marginLeft: 6,
      fontWeight: "500",
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: darkMode ? "#E3B23C" : "#8B1C1C",
      marginBottom: 8,
    },
    description: {
      fontSize: 14,
      color: darkMode ? "#ccc" : "#555",
      marginBottom: 20,
      lineHeight: 20,
    },
    form: {
      backgroundColor: darkMode ? "#1E1E1E" : "#fff",
      padding: 16,
      borderRadius: 10,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    input: {
      backgroundColor: darkMode ? "#2B2B2B" : "#f5f5f5",
      color: darkMode ? "#fff" : "#000",
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: darkMode ? "#444" : "#ddd",
    },
    pickerWrapper: {
      backgroundColor: darkMode ? "#2B2B2B" : "#f5f5f5",
      borderRadius: 8,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: darkMode ? "#444" : "#ddd",
      overflow: "hidden",
    },
    picker: {
      color: darkMode ? "#fff" : "#000",
      height: 48,
      width: "100%",
    },
    button: {
      backgroundColor: "#8B1C1C",
      borderRadius: 8,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 10,
    },
    buttonText: {
      color: "#fff",
      fontWeight: "bold",
      fontSize: 16,
    },
  });
