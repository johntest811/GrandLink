import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import BottomNavBar from "@BottomNav/../components/BottomNav";
import TopBar from '@/components/TopBar';
import { supabase } from '../supabaseClient';

interface Service {
  id: number;
  name: string;
  short_description: string | null;
  long_description: string | null;
  icon: string | null;
  created_at: string;
}

export default function ServicesScreen() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('Error fetching services:', error);
      } else if (data) {
        setServices(data);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TopBar />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image
            source={require("@/assets/images/homeimage1.png")}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.overlay}>
            <Text style={styles.heroTitle}>Our Services</Text>
            <View style={styles.redLine} />
          </View>
        </View>

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.description}>
            Explore our full range of services, expertly designed to meet both
            residential and commercial needs. From precision-crafted aluminum
            windows and doors to custom glass installations, our expertise spans
            design, fabrication, and installation. Discover how we can transform
            your space with top-tier craftsmanship and innovative solutions
            built for style, durability, and performance.
          </Text>
        </View>

        {/* Services Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#e63946" />
            <Text style={styles.loadingText}>Loading services...</Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {services.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={styles.card}
              >
                <MaterialCommunityIcons
                  name={(service.icon || "cog") as any}
                  size={40}
                  color="#fff"
                  style={{ marginBottom: 10 }}
                />
                <Text style={styles.cardTitle}>{service.name}</Text>
                <Text style={styles.cardDescription}>
                  {service.short_description || service.long_description || ""}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Updated Bottom NavBar (same as Awning) */}
      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffffff" },
  heroSection: { position: "relative", height: 200 },
  heroImage: { width: "100%", height: "100%" },
  overlay: { position: "absolute", bottom: 20, left: 20 },
  heroTitle: { fontSize: 28, fontWeight: "bold", color: "#fff" },
  redLine: {
    width: 80,
    height: 4,
    backgroundColor: "#e63946",
    marginTop: 5,
    borderRadius: 2,
  },
  descriptionContainer: { padding: 20 },
  description: {
    color: "#000000ff",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "justify",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    padding: 10,
  },
  card: {
    width: "45%",
    backgroundColor: "#2c2c2c",
    borderRadius: 15,
    padding: 15,
    marginVertical: 10,
    alignItems: "center",
  },
  cardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
  },
  cardDescription: {
    color: "#bbb",
    fontSize: 13,
    textAlign: "center",
  },

  // ✅ Navbar styles (copied from Awning)
  bottomNavBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#4f5f8aff",
    height: 70,
    borderTopWidth: 1,
    borderTopColor: "#ccc",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 10,
  },
  navItem: {
    alignItems: "center",
  },
  navIcon: {
    width: 25,
    height: 25,
    marginBottom: 4,
  },
  navLabel: {
    fontSize: 12,
    color: "#ffffffff",
  },
  fabWrapper: {
    position: "absolute",
    bottom: 25,
    alignSelf: "center",
    zIndex: 1,
  },
  fabButton: {
    backgroundColor: "#ffffffff",
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
  },
  fabIcon: {
    width: 40,
    height: 40,
  },
});
