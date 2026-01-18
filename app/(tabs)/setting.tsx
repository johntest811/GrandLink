"use client";

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  ScrollView,
  Image,
} from "react-native";
import { Ionicons, MaterialIcons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "./../supabaseClient";
import { useAppContext } from "@AppContext/../context/AppContext";

import BottomNavBar from "@BottomNav/../components/BottomNav";
export default function SettingsTab() {
  const router = useRouter();
  const { darkMode, setDarkMode } = useAppContext();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    getUser();
  }, []);

  const handleLogout = async () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: darkMode ? "#111" : "#f9f9f9" }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
            
        
        <View
          style={[
            styles.header,
            { backgroundColor: darkMode ? "#333" : "#8B1C1C" },
          ]}
        >
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        
        <View
          style={[
            styles.section,
            { backgroundColor: darkMode ? "#1e1e1e" : "#fff" },
          ]}
        >
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity
            style={styles.item}
            onPress={() => router.push("/profile")}
          >
            <Ionicons
              name="person-circle-outline"
              size={22}
              color={darkMode ? "#fff" : "#8B1C1C"}
            />
            <Text style={[styles.itemText, { color: darkMode ? "#fff" : "#222" }]}>
              Profile
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.item}
            onPress={() => router.push("/ChangeAddress")}
          >
            <Feather name="map-pin" size={22} color="#888" />
            <Text style={[styles.itemText, { color: darkMode ? "#fff" : "#222" }]}>
              My Address
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.item}
            onPress={() => router.push("/inquire")}
          >
            <Feather name="message-square" size={22} color="#888" />
            <Text style={[styles.itemText, { color: darkMode ? "#fff" : "#222" }]}>
              Inquire
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.item}
            onPress={() => router.push("/FAQs")}
          >
            <MaterialIcons name="help-outline" size={22} color="#888" />
            <Text style={[styles.itemText, { color: darkMode ? "#fff" : "#222" }]}>
              FAQs
            </Text>
          </TouchableOpacity>
        </View>

        
        <View
          style={[
            styles.section,
            { backgroundColor: darkMode ? "#1e1e1e" : "#fff" },
          ]}
        >
          <Text style={styles.sectionTitle}>Notifications</Text>
          <TouchableOpacity
            style={styles.item}
            onPress={() => router.push("/notification")}
          >
            <Ionicons name="notifications-outline" size={22} color="#888" />
            <Text style={[styles.itemText, { color: darkMode ? "#fff" : "#222" }]}>
              Notification Settings
            </Text>
          </TouchableOpacity>
        </View>

        
        <View
          style={[
            styles.section,
            { backgroundColor: darkMode ? "#1e1e1e" : "#fff" },
          ]}
        >
          <Text style={styles.sectionTitle}>App Preferences</Text>

          <View style={styles.item}>
            <Feather name="moon" size={22} color="#888" />
            <Text style={[styles.itemText, { color: darkMode ? "#fff" : "#222" }]}>
              Dark Mode
            </Text>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              thumbColor={darkMode ? "#8B1C1C" : "#f4f3f4"}
              trackColor={{ false: "#ccc", true: "#f7bcbc" }}
            />
          </View>
        </View>

        {/* 🧾 About */}
        <View
          style={[
            styles.section,
            { backgroundColor: darkMode ? "#1e1e1e" : "#fff" },
          ]}
        >
          <Text style={styles.sectionTitle}>Support & About</Text>
          <TouchableOpacity style={styles.item} onPress={() => router.push("/about")}>
            <Ionicons name="information-circle-outline" size={22} color="#888" />
            <Text style={[styles.itemText, { color: darkMode ? "#fff" : "#222" }]}>
              About Grand Link
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.item} onPress={() => router.push("/showroom")}>
    <MaterialIcons name="storefront" size={22} color="#888" />
    <Text
      style={[styles.itemText, { color: darkMode ? "#fff" : "#222" }]}
    >
      Showroom
    </Text>
  </TouchableOpacity>
        </View>

        
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      
      <BottomNavBar />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 40,
    paddingBottom: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
  },
  purchasesSection: {
    marginVertical: 16,
    alignItems: "center",
  },
  purchaseIcons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    paddingHorizontal: 12,
  },
  purchaseItem: {
    alignItems: "center",
    width: 70,
  },
  purchaseLabel: {
    fontSize: 12,
    marginTop: 4,
    color: "#333",
  },
  section: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#8B1C1C",
    marginLeft: 16,
    marginBottom: 4,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  itemText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  logoutButton: {
    marginTop: 28,
    backgroundColor: "#8B1C1C",
    borderRadius: 10,
    paddingVertical: 14,
    marginHorizontal: 24,
    alignItems: "center",
  },
  logoutText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
});
