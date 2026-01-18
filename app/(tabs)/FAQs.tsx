"use client";

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../supabaseClient";
import { useAppContext } from "@AppContext/../context/AppContext";
import { Ionicons } from "@expo/vector-icons";

// Enable animation for Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FAQCategory {
  id: number;
  name: string;
  faq_questions: {
    id: number;
    question: string;
    answer: string;
  }[];
}

export default function FAQsPage() {
  const { darkMode } = useAppContext();
  const router = useRouter();
  const [categories, setCategories] = useState<FAQCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [openQuestion, setOpenQuestion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFaqs = async () => {
      const { data, error } = await supabase
        .from("faq_categories")
        .select(`
          id,
          name,
          faq_questions (
            id,
            question,
            answer
          )
        `)
        .order("id", { ascending: true });

      if (!error && data) {
        setCategories(data);
        if (data.length > 0) setActiveCategory(data[0].id);
      } else {
        console.error(error);
      }
      setLoading(false);
    };

    fetchFaqs();
  }, []);

  const styles = getStyles(darkMode);

  const toggleQuestion = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenQuestion(openQuestion === id ? null : id);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={darkMode ? "#E3B23C" : "#8B1C1C"} />
        <Text style={styles.loadingText}>Loading FAQs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Fixed Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={26} color={darkMode ? "#E3B23C" : "#fff"} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>FAQs</Text>
            <Text style={styles.heroSubtitle}>
              Find quick answers to your most common questions
            </Text>
          </View>
        </View>

        {/* Categories (Now scrollable horizontally for mobile) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryButton,
                activeCategory === cat.id && styles.categoryButtonActive,
              ]}
              onPress={() => {
                setActiveCategory(cat.id);
                setOpenQuestion(null);
              }}
            >
              <Text
                style={[
                  styles.categoryText,
                  activeCategory === cat.id && styles.categoryTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Questions Accordion */}
        <View style={styles.faqContainer}>
          {categories
            .find((cat) => cat.id === activeCategory)
            ?.faq_questions.map((q) => (
              <View key={q.id} style={styles.questionBox}>
                <TouchableOpacity
                  onPress={() => toggleQuestion(q.id)}
                  style={styles.questionHeader}
                >
                  <Text style={styles.questionText}>{q.question}</Text>
                  <Text style={styles.toggleIcon}>
                    {openQuestion === q.id ? "−" : "+"}
                  </Text>
                </TouchableOpacity>

                {openQuestion === q.id && (
                  <View style={styles.answerBox}>
                    <Text style={styles.answerText}>{q.answer}</Text>
                  </View>
                )}
              </View>
            ))}
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (darkMode: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: darkMode ? "#121212" : "#f9fafb",
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
    backButton: {
      position: "absolute",
      top: 50,
      left: 20,
      zIndex: 999,
      backgroundColor: "rgba(0,0,0,0.4)",
      borderRadius: 20,
      padding: 8,
    },
    heroSection: {
      height: 250,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#8B1C1C",
    },
    heroOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    heroContent: {
      alignItems: "center",
      paddingHorizontal: 20,
    },
    heroTitle: {
      fontSize: 36,
      fontWeight: "bold",
      color: "#fff",
    },
    heroSubtitle: {
      color: "#eee",
      marginTop: 6,
      fontSize: 16,
      textAlign: "center",
    },

    // Improved mobile-friendly category tabs
    categoriesScroll: {
      paddingVertical: 16,
      paddingHorizontal: 10,
    },
    categoryButton: {
      backgroundColor: darkMode ? "#2c2c2c" : "#f2f2f2",
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 25,
      marginRight: 10,
      minWidth: 100,
      alignItems: "center",
      justifyContent: "center",
    },
    categoryButtonActive: {
      backgroundColor: "#8B1C1C",
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 3,
      elevation: 3,
    },
    categoryText: {
      fontSize: 15,
      fontWeight: "600",
      color: darkMode ? "#ccc" : "#333",
      textAlign: "center",
    },
    categoryTextActive: {
      color: "#fff",
    },
    faqContainer: {
      marginHorizontal: 15,
      marginTop: 15,
      marginBottom: 30,
    },
    questionBox: {
      backgroundColor: darkMode ? "#1e1e1e" : "#fff",
      borderRadius: 10,
      marginBottom: 10,
      overflow: "hidden",
      borderWidth: darkMode ? 0 : 1,
      borderColor: "#ddd",
    },
    questionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: darkMode ? "#2b2b2b" : "#f9f9f9",
    },
    questionText: {
      fontSize: 16,
      fontWeight: "600",
      color: darkMode ? "#fff" : "#111",
      flex: 1,
      marginRight: 10,
    },
    toggleIcon: {
      fontSize: 22,
      fontWeight: "bold",
      color: "#8B1C1C",
    },
    answerBox: {
      backgroundColor: darkMode ? "#121212" : "#fff",
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    answerText: {
      color: darkMode ? "#ccc" : "#555",
      fontSize: 14,
      lineHeight: 20,
    },
  });
