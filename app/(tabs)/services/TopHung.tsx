import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function Awning() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container}>
        {/* Header Section */}
        <View style={styles.header}>
          <MaterialCommunityIcons
            name="arrow-up-bold-box"
            size={80}
            color="#fff"
          />
          <Text style={styles.headerTitle}>Top Hung</Text>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          <Text style={styles.subHeading}>
            Top Hung Windows:{"\n"}A Unique and Versatile Option
          </Text>
          <Text style={styles.description}>
           Grand East’s top-hung windows provide secure ventilation with a hinged top that opens inward,
            making them perfect for basements or hard-to-reach areas.
             Choose from a range of sizes and finishes to suit your space.{"\n\n"}
          </Text>
        </View>

        {/* Inquiry Section */}
        <View style={styles.inquirySection}>
          <View style={styles.inquiryTextContainer}>
            <Text style={styles.inquiryHeading}>
              Ready to elevate your space?
            </Text>
            <Text style={styles.inquirySubText}>
              Inquire now for a custom solution!
            </Text>
          </View>
          <TouchableOpacity
            style={styles.inquiryButton}
            onPress={() => router.push("/services")}
          >
            <Text style={styles.inquiryButtonText}>
              INQUIRE NOW{"  "}
              <MaterialCommunityIcons
                name="phone-outline"
                size={18}
                color="#fff"
              />
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNavBar}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/homepage")}
        >
          <Image
            source={require("@/assets/images/home.png")}
            style={styles.navIcon}
            resizeMode="contain"
          />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("../inquire")}
        >
          <Image
            source={require("@/assets/images/inquire.png")}
            style={styles.navIcon}
            resizeMode="contain"
          />
          <Text style={styles.navLabel}>Inquire</Text>
        </TouchableOpacity>

        <View style={styles.fabWrapper}>
          <TouchableOpacity
            style={styles.fabButton}
            onPress={() => router.push("/shop")}
          >
            <Image
              source={require("@/assets/images/catalogbutton.png")}
              style={styles.fabIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("/services")}
        >
          <Image
            source={require("@/assets/images/service.png")}
            style={styles.navIcon}
            resizeMode="contain"
          />
          <Text style={styles.navLabel}>Services</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push("../settings")}
        >
          <Image
            source={require("@/assets/images/settings.png")}
            style={styles.navIcon}
            resizeMode="contain"
          />
          <Text style={styles.navLabel}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    backgroundColor: "#2c3e50", // Dark navy blue
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 10,
  },
  content: {
    paddingVertical: 40,
    paddingHorizontal: 25,
    alignItems: "center",
  },
  subHeading: {
    color: "#b71c1c",
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 15,
  },
  description: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    lineHeight: 24,
  },
  inquirySection: {
    backgroundColor: "#f5f5f5",
    marginHorizontal: 10,
    marginBottom: 90,
    borderRadius: 10,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  inquiryTextContainer: {
    marginBottom: 15,
    alignItems: "center",
  },
  inquiryHeading: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#b71c1c",
    marginBottom: 5,
  },
  inquirySubText: {
    fontSize: 16,
    color: "#444",
    fontStyle: "italic",
  },
  inquiryButton: {
    backgroundColor: "#b71c1c",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  inquiryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
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