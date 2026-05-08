import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import TopBar from "@/components/TopBar";
import BottomNavBar from "@/components/BottomNav";
import { useAppContext } from "../../context/AppContext";

const PROCESS_STEPS = [
  {
    title: "Initial Measurement",
    description: "Take precise measurement of the site.",
  },
  {
    title: "Quotation",
    description: "Provide a detailed quote based on measurements.",
  },
  {
    title: "Confirmation of Order",
    description: "Confirm customer acceptance of order.",
  },
  {
    title: "Final Measurement",
    description: "Re-verify measurements for accuracy.",
  },
  {
    title: "Shop Drawing",
    description: "Create detailed drawings for design.",
  },
  {
    title: "Confirmation of Design and Measurement",
    description: "Customer approval of design and measurements.",
  },
  {
    title: "Start Production",
    description: "Begin manufacturing.",
  },
  {
    title: "Delivery and Installation",
    description: "Deliver and install products.",
  },
  {
    title: "Turn Over",
    description: "Complete installation and hand over to customer.",
  },
  {
    title: "Cleaning Services",
    description: "Offer post-installation cleaning.",
  },
];

export default function DeliveryProcessScreen() {
  const router = useRouter();
  const { darkMode } = useAppContext();
  const styles = getStyles(darkMode);

  return (
    <View style={styles.container}>
      <TopBar />
      <View style={styles.contentArea}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ImageBackground
            source={require("../../assets/images/homeimage2.png")}
            style={styles.heroSection}
            imageStyle={styles.heroImage}
            resizeMode="cover"
          >
            <View style={styles.heroOverlay}>
              <Text style={styles.heroTitle}>Delivery & Ordering Process</Text>
              <View style={styles.heroLine} />
              <Text style={styles.heroSubtitle}>
                Track our full workflow from site measurement to final turnover.
              </Text>
            </View>
          </ImageBackground>

          <View style={styles.stepsWrapper}>
            {PROCESS_STEPS.map((step, index) => (
              <View key={step.title} style={styles.stepCard}>
                <View style={styles.stepNumberWrap}>
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                </View>
                <View style={styles.stepTextWrap}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.warrantyCard}>
            <Text style={styles.warrantyTitle}>Service Warranty Note</Text>
            <Text style={styles.warrantyText}>
              Warranty does not cover damages from natural disasters (for example,
              earthquakes, tsunamis, typhoons) or other uncontrollable events.
            </Text>
            <Text style={styles.warrantyText}>
              The signed shop drawing design and measurements will be strictly
              followed.
            </Text>
            <Text style={styles.warrantyText}>
              Additional fees may apply for post-warranty maintenance or repairs of
              window and door parts.
            </Text>
          </View>

          <View style={styles.ctaCard}>
            <Text style={styles.ctaTitle}>Can't find the answer to your question?</Text>
            <TouchableOpacity style={styles.ctaButton} onPress={() => router.push("/inquire")}>
              <Text style={styles.ctaButtonText}>Contact Us Now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      <BottomNavBar />
    </View>
  );
}

const getStyles = (darkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: darkMode ? "#0f1115" : "#f7f8fb",
    },
    contentArea: {
      flex: 1,
    },
    backButton: {
      position: "absolute",
      top: 54,
      left: 16,
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.45)",
      zIndex: 20,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 120,
    },
    heroSection: {
      minHeight: 210,
      borderRadius: 16,
      marginTop: 8,
      shadowColor: "#000",
      shadowOpacity: darkMode ? 0.25 : 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
      overflow: "hidden",
    },
    heroImage: {
      borderRadius: 16,
    },
    heroOverlay: {
      flex: 1,
      justifyContent: "center",
      backgroundColor: "rgba(15, 20, 34, 0.55)",
      paddingVertical: 20,
      paddingHorizontal: 16,
    },
    heroTitle: {
      fontSize: 26,
      lineHeight: 32,
      fontWeight: "800",
      color: "#f3f6ff",
    },
    heroLine: {
      marginTop: 10,
      width: 88,
      height: 4,
      borderRadius: 4,
      backgroundColor: "#cf2f2f",
    },
    heroSubtitle: {
      marginTop: 12,
      fontSize: 14,
      lineHeight: 20,
      color: "#e6ebf8",
    },
    stepsWrapper: {
      marginTop: 16,
      gap: 12,
    },
    stepCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      backgroundColor: darkMode ? "#171c28" : "#ffffff",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: darkMode ? "#273246" : "#e5e9f2",
      padding: 12,
    },
    stepNumberWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#8b1c1c",
      marginTop: 2,
    },
    stepNumber: {
      color: "#fff",
      fontWeight: "800",
      fontSize: 14,
    },
    stepTextWrap: {
      flex: 1,
    },
    stepTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: darkMode ? "#f0f4ff" : "#1a1f2e",
    },
    stepDescription: {
      marginTop: 6,
      fontSize: 14,
      lineHeight: 20,
      color: darkMode ? "#bcc5d7" : "#5a6275",
    },
    warrantyCard: {
      marginTop: 18,
      padding: 14,
      borderRadius: 14,
      backgroundColor: darkMode ? "#2a1616" : "#fff3f3",
      borderWidth: 1,
      borderColor: "#d89999",
    },
    warrantyTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: "#8b1c1c",
      marginBottom: 8,
    },
    warrantyText: {
      fontSize: 13,
      lineHeight: 20,
      color: darkMode ? "#f0dede" : "#5b2d2d",
      marginBottom: 8,
    },
    ctaCard: {
      marginTop: 16,
      borderRadius: 14,
      padding: 16,
      backgroundColor: darkMode ? "#151f2f" : "#eef4ff",
      borderWidth: 1,
      borderColor: darkMode ? "#2c3f59" : "#ccd9ef",
      alignItems: "center",
    },
    ctaTitle: {
      textAlign: "center",
      fontSize: 16,
      lineHeight: 22,
      fontWeight: "700",
      color: darkMode ? "#f2f6ff" : "#1e2a40",
      marginBottom: 12,
    },
    ctaButton: {
      backgroundColor: "#8b1c1c",
      borderRadius: 10,
      paddingVertical: 11,
      paddingHorizontal: 18,
    },
    ctaButtonText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
  });
