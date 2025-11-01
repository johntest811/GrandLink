import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../supabaseClient";
import { useAppContext } from "../../context/AppContext"; // ✅ same context hook as InquirePage

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Showroom = {
  id: number;
  title: string;
  address: string;
  description: string;
  image?: string;
};

export default function ShowroomScreen() {
  const navigation = useNavigation();
  const { darkMode } = useAppContext(); // ✅ use context-based dark mode
  const [showrooms, setShowrooms] = useState<Showroom[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetchShowrooms();
  }, []);

  const fetchShowrooms = async () => {
    const { data, error } = await supabase.from("showrooms").select("*");
    if (error) console.error("Error fetching showrooms:", error.message);
    else setShowrooms(data || []);
  };

  const toggleExpand = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  const styles = getStyles(darkMode);

  return (
    <View style={styles.root}>
      {/* ✅ Fixed Back Button */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
        activeOpacity={0.8}
      >
        <Ionicons
          name="arrow-back"
          size={22}
          color={darkMode ? "#E3B23C" : "#B11C1C"}
        />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>Visit Us at Our{"\n"}Showroom Locations</Text>
        <View style={styles.line} />

        {showrooms.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <View key={item.id} style={styles.card}>
              {item.image ? (
                <Image
                  source={{ uri: item.image }}
                  style={styles.image}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.noImage}>
                  <Text style={styles.noImageText}>No Image</Text>
                </View>
              )}

              <View style={styles.cardContent}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.address}>{item.address}</Text>

                <Text
                  numberOfLines={isExpanded ? undefined : 3}
                  style={styles.description}
                >
                  {item.description.replace(/<[^>]*>?/gm, "")}
                </Text>

                <TouchableOpacity onPress={() => toggleExpand(item.id)}>
                  <Text style={styles.toggle}>
                    {isExpanded ? "Show Less" : "Show More"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* ✅ Spacer so last item isn’t blocked by navbar */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (darkMode: boolean) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: darkMode ? "#121212" : "#f9f9f9",
    },
    backButton: {
      position: "absolute",
      top: 50,
      left: 20,
      zIndex: 10,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: darkMode ? "#1E1E1E" : "rgba(255, 255, 255, 0.9)",
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 10,
      shadowColor: "#000",
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 5,
    },
    backText: {
      fontSize: 16,
      fontWeight: "500",
      marginLeft: 6,
      color: darkMode ? "#E3B23C" : "#B11C1C",
    },
    container: {
      padding: 16,
      paddingTop: 100,
      alignItems: "center",
    },
    header: {
      fontSize: 26,
      fontWeight: "800",
      textAlign: "center",
      color: darkMode ? "#E3B23C" : "#222",
      marginTop: 20,
      marginBottom: 10,
    },
    line: {
      width: 60,
      height: 3,
      backgroundColor: "#B11C1C",
      marginBottom: 20,
      borderRadius: 2,
    },
    card: {
      backgroundColor: darkMode ? "#1E1E1E" : "#fff",
      borderRadius: 16,
      width: "100%",
      marginBottom: 20,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
      overflow: "hidden",
    },
    image: {
      width: "100%",
      height: 180,
    },
    noImage: {
      width: "100%",
      height: 180,
      backgroundColor: darkMode ? "#2B2B2B" : "#eee",
      justifyContent: "center",
      alignItems: "center",
    },
    noImageText: {
      color: darkMode ? "#888" : "#999",
    },
    cardContent: {
      padding: 14,
      alignItems: "center",
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: "#B11C1C",
      textTransform: "uppercase",
      marginBottom: 4,
      textAlign: "center",
    },
    address: {
      fontSize: 13,
      color: darkMode ? "#ccc" : "#555",
      textAlign: "center",
      marginBottom: 6,
    },
    description: {
      fontSize: 14,
      color: darkMode ? "#fff" : "#444",
      textAlign: "center",
      lineHeight: 20,
    },
    toggle: {
      color: "#B11C1C",
      fontWeight: "600",
      marginTop: 6,
    },
  });
