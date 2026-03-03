"use client";

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../supabaseClient";
import { useAppContext } from "../../context/AppContext";
import { Ionicons } from "@expo/vector-icons";

export default function AboutPage() {
  const { darkMode } = useAppContext();
  const router = useRouter();
  const [about, setAbout] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAboutData = async () => {
      const { data, error } = await supabase.from("about").select("*").single();
      if (!error && data) setAbout(data);
      setLoading(false);
    };
    fetchAboutData();
  }, []);

  const styles = getStyles(darkMode);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={darkMode ? "#E3B23C" : "#8B1C1C"} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!about) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>No data available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed Back Button */}
      <TouchableOpacity style={styles.fixedBackButton} onPress={() => router.back()}>
        <Ionicons
          name="arrow-back"
          size={26}
          color={darkMode ? "#E3B23C" : "#fff"}
        />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image
            source={require("../../assets/images/inquireNOW.png")}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>About Us</Text>
            <View style={styles.heroLine} />
            <Text style={styles.heroSubtitle}>
              High Quality, Long Lasting Performance
            </Text>
          </View>
        </View>

        {/* Logo & Description */}
        <View style={styles.logoSection}>
          <Image
            source={require("../../assets/images/GRANDEASTLOGO.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.grandTitle}>{about.grand}</Text>
          <Text style={styles.description}>{about.description}</Text>
        </View>

        {/* Mission & Vision */}
        <View style={styles.mvContainer}>
          <View style={[styles.mvBox, { backgroundColor: "#8B1C1C" }]}>
            <Text style={styles.mvTitle}>MISSION</Text>
            <Text style={styles.mvText}>{about.mission}</Text>
          </View>
          <View style={[styles.mvBox, { backgroundColor: "#232d3b" }]}>
            <Text style={styles.mvTitle}>VISION</Text>
            <Text style={styles.mvText}>{about.vision}</Text>
          </View>
        </View>

        {/* Call to Action */}
        <View style={styles.ctaSection}>
          <Image
            source={require("../../assets/images/homeimage2.png")}
            style={styles.ctaBg}
            resizeMode="cover"
          />
          <View style={styles.ctaContent}>
            <Text style={styles.ctaHeading}>Ready to elevate your space?</Text>
            <Text style={styles.ctaSubText}>
              Inquire now for a custom solution!
            </Text>

            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => router.push("/inquire")}
            >
              <Text style={styles.ctaButtonText}>CONTACT US NOW</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (darkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: darkMode ? "#121212" : "#fff",
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: darkMode ? "#121212" : "#fff",
    },
    loadingText: {
      marginTop: 10,
      color: darkMode ? "#E3B23C" : "#8B1C1C",
      fontSize: 16,
    },

    /* 🔹 Fixed back button (stays on top even when scrolling) */
    fixedBackButton: {
      position: "absolute",
      top: 50,
      left: 20,
      zIndex: 999,
      backgroundColor: "rgba(0,0,0,0.4)",
      borderRadius: 20,
      padding: 8,
    },

    heroSection: {
      position: "relative",
      height: 300,
      width: "100%",
    },
    heroImage: {
      width: "100%",
      height: "100%",
      opacity: 0.6,
    },
    heroOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
    },
    heroTitle: {
      fontSize: 32,
      fontWeight: "bold",
      color: "#fff",
      marginBottom: 4,
    },
    heroLine: {
      width: 64,
      height: 4,
      backgroundColor: "#8B1C1C",
      marginVertical: 8,
    },
    heroSubtitle: {
      color: "#fff",
      fontSize: 18,
      fontStyle: "italic",
    },
    logoSection: {
      alignItems: "center",
      padding: 20,
    },
    logo: {
      width: 180,
      height: 100,
      marginBottom: 12,
    },
    grandTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: darkMode ? "#E3B23C" : "#8B1C1C",
      marginBottom: 8,
      textAlign: "center",
    },
    description: {
      fontSize: 16,
      color: darkMode ? "#ccc" : "#555",
      textAlign: "center",
      lineHeight: 22,
    },
    mvContainer: {
      flexDirection: "column",
      marginTop: 20,
    },
    mvBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 30,
      paddingHorizontal: 20,
    },
    mvTitle: {
      color: "#fff",
      fontSize: 28,
      fontWeight: "bold",
      marginBottom: 10,
    },
    mvText: {
      color: "#fff",
      fontSize: 16,
      textAlign: "center",
      lineHeight: 22,
    },
    ctaSection: {
      marginTop: 20,
      position: "relative",
      overflow: "hidden",
      borderRadius: 10,
      marginHorizontal: 10,
    },
    ctaBg: {
      width: "100%",
      height: 200,
      position: "absolute",
      top: 0,
      left: 0,
      opacity: 0.5,
    },
    ctaContent: {
      backgroundColor: darkMode ? "rgba(30,30,30,0.8)" : "rgba(248,249,250,0.9)",
      borderRadius: 8,
      padding: 20,
      alignItems: "center",
    },
    ctaHeading: {
      fontSize: 20,
      fontWeight: "bold",
      color: "#8B1C1C",
      marginBottom: 6,
    },
    ctaSubText: {
      color: darkMode ? "#ddd" : "#232d3b",
      fontSize: 16,
      marginBottom: 14,
    },
    ctaButton: {
      backgroundColor: "#8B1C1C",
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 20,
    },
    ctaButtonText: {
      color: "#fff",
      fontWeight: "bold",
      fontSize: 16,
    },
  });
