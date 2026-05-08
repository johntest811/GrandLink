"use client";

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "../supabaseClient";
import { useAppContext } from "@/context/AppContext"; // ✅ import context (fixed alias)
import BottomNavBar from '@/components/BottomNav';
import TopBar from "@/components/TopBar";
import { useModal } from '@/hooks/useModal';

export default function InquirePage() {
  const router = useRouter();
  const modal = useModal();
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
      modal.showWarning("Missing Info", "Please fill in all required fields.");
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

      modal.showSuccess("Success", "Your inquiry was successfully sent!", () => router.back());
    } catch (err) {
      modal.showError("Error", "Failed to send inquiry. Please try again.");
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
            <View style={styles.formHeader}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={darkMode ? "#E3B23C" : "#8B1C1C"} />
              <Text style={styles.formHeaderTitle}>Inquiry Form</Text>
            </View>
            <Text style={styles.formHeaderSubtitle}>Fields marked with * are required.</Text>

            <Text style={styles.fieldLabel}>Full Name <Text style={styles.requiredMark}>*</Text></Text>
            <View style={styles.row}>
              <TextInput
                placeholder="First Name"
                placeholderTextColor={darkMode ? "#aaa" : "#555"}
                style={[styles.input, styles.halfInput]}
                value={formData.firstName}
                onChangeText={(text) => handleChange("firstName", text)}
              />
              <TextInput
                placeholder="Last Name"
                placeholderTextColor={darkMode ? "#aaa" : "#555"}
                style={[styles.input, styles.halfInput]}
                value={formData.lastName}
                onChangeText={(text) => handleChange("lastName", text)}
              />
            </View>

            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="mail-outline" size={18} color={darkMode ? "#b7b7b7" : "#777"} style={styles.iconInput} />
              <TextInput
                placeholder="Email"
                placeholderTextColor={darkMode ? "#aaa" : "#555"}
                keyboardType="email-address"
                style={styles.iconTextInput}
                value={formData.email}
                onChangeText={(text) => handleChange("email", text)}
              />
            </View>

            <Text style={styles.fieldLabel}>Phone</Text>
            <View style={styles.inputWithIcon}>
              <Ionicons name="call-outline" size={18} color={darkMode ? "#b7b7b7" : "#777"} style={styles.iconInput} />
              <TextInput
                placeholder="Phone"
                placeholderTextColor={darkMode ? "#aaa" : "#555"}
                keyboardType="phone-pad"
                style={styles.iconTextInput}
                value={formData.phone}
                onChangeText={(text) => handleChange("phone", text)}
              />
            </View>

            <Text style={styles.fieldLabel}>Inquiry Type <Text style={styles.requiredMark}>*</Text></Text>
            <View style={styles.pickerWrapper}>
              <Ionicons name="list-outline" size={18} color={darkMode ? "#b7b7b7" : "#777"} style={styles.iconInput} />
              <Picker
                selectedValue={formData.service}
                onValueChange={(value) => handleChange("service", String(value))}
                dropdownIconColor={darkMode ? "#fff" : "#000"}
                style={styles.iconPicker}
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

            <Text style={styles.fieldLabel}>Message</Text>
            <View style={[styles.inputWithIcon, styles.messageInputWrapper]}>
              <Ionicons name="chatbox-ellipses-outline" size={18} color={darkMode ? "#b7b7b7" : "#777"} style={[styles.iconInput, styles.messageIcon]} />
              <TextInput
                placeholder="Message"
                placeholderTextColor={darkMode ? "#aaa" : "#555"}
                style={[styles.iconTextInput, styles.messageInput]}
                multiline
                value={formData.message}
                onChangeText={(text) => handleChange("message", text)}
              />
            </View>

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
      paddingTop: 12,
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
      fontSize: 30,
      fontWeight: "bold",
      color: darkMode ? "#E3B23C" : "#8B1C1C",
      marginBottom: 10,
    },
    description: {
      fontSize: 15,
      color: darkMode ? "#ccc" : "#555",
      marginBottom: 22,
      lineHeight: 22,
    },
    form: {
      backgroundColor: darkMode ? "#1E1E1E" : "#fff",
      padding: 18,
      borderRadius: 14,
      shadowColor: "#000",
      shadowOpacity: darkMode ? 0.22 : 0.08,
      shadowRadius: 8,
      elevation: 4,
      borderWidth: 1,
      borderColor: darkMode ? "#2e2e2e" : "#e8e8e8",
    },
    formHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
    },
    formHeaderTitle: {
      marginLeft: 8,
      fontSize: 17,
      fontWeight: "700",
      color: darkMode ? "#f2f2f2" : "#222",
    },
    formHeaderSubtitle: {
      fontSize: 12,
      color: darkMode ? "#a8a8a8" : "#777",
      marginBottom: 12,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: darkMode ? "#d9d9d9" : "#444",
      marginBottom: 6,
      marginTop: 2,
    },
    requiredMark: {
      color: "#8B1C1C",
      fontWeight: "700",
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
    },
    halfInput: {
      flex: 1,
    },
    input: {
      backgroundColor: darkMode ? "#2B2B2B" : "#f5f5f5",
      color: darkMode ? "#fff" : "#000",
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: darkMode ? "#444" : "#ddd",
      fontSize: 14,
    },
    inputWithIcon: {
      backgroundColor: darkMode ? "#2B2B2B" : "#f5f5f5",
      borderRadius: 10,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: darkMode ? "#444" : "#ddd",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      minHeight: 48,
    },
    iconInput: {
      marginRight: 8,
    },
    iconTextInput: {
      flex: 1,
      color: darkMode ? "#fff" : "#000",
      fontSize: 14,
      paddingVertical: 12,
    },
    messageInput: {
      height: 110,
      textAlignVertical: "top",
    },
    messageInputWrapper: {
      alignItems: "flex-start",
    },
    messageIcon: {
      marginTop: 12,
    },
    pickerWrapper: {
      backgroundColor: darkMode ? "#2B2B2B" : "#f5f5f5",
      borderRadius: 10,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: darkMode ? "#444" : "#ddd",
      overflow: "hidden",
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 12,
    },
    iconPicker: {
      flex: 1,
      color: darkMode ? "#fff" : "#000",
      height: 48,
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
