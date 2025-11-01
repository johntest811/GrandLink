import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons, MaterialIcons, Feather, Entypo } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function ProfileHeader({ user }: { user: any }) {
  const router = useRouter();

  return (
    <View>
      <View style={styles.profileSection}>
        <Image
          source={require("@/assets/images/profileicon.png")}
          style={styles.avatar}
        />
        <View>
          <Text style={styles.welcome}>Welcome</Text>
          <Text style={styles.name}>{user?.user_metadata?.name || "No Name"}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>My Purchases</Text>
      <View style={styles.purchasesRow}>
        <TouchableOpacity style={styles.purchaseItem} onPress={() => router.push("/cart")}>
          <Ionicons name="cart" size={28} color="#000" />
          <Text style={styles.purchaseLabel}>Cart</Text>
        </TouchableOpacity>
        <View style={styles.purchaseItem}>
          <Ionicons name="calendar" size={28} color="#222" />
          <Text style={styles.purchaseLabel}>Reservation</Text>
        </View>
        <View style={styles.purchaseItem}>
          <MaterialIcons name="payment" size={28} color="#222" />
          <Text style={styles.purchaseLabel}>To Pay</Text>
        </View>
        <View style={styles.purchaseItem}>
          <Feather name="check-square" size={28} color="#222" />
          <Text style={styles.purchaseLabel}>Completed</Text>
        </View>
        <View style={styles.purchaseItem}>
          <Entypo name="circle-with-cross" size={28} color="#222" />
          <Text style={styles.purchaseLabel}>Canceled</Text>
        </View>
      </View>

      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 16,
    backgroundColor: "#eee",
  },
  welcome: {
    fontSize: 16,
    color: "#888",
    marginBottom: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#222",
  },
  divider: {
    height: 1,
    backgroundColor: "#ddd",
    marginVertical: 12,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#222",
    marginLeft: 24,
    marginBottom: 8,
  },
  purchasesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  purchaseItem: {
    alignItems: "center",
    flex: 1,
  },
  purchaseLabel: {
    fontSize: 12,
    color: "#222",
    marginTop: 4,
    textAlign: "center",
  },
});
