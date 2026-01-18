import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { supabase } from "../supabaseClient";
import { useRouter } from "expo-router";

type Address = {
  id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  email?: string;
  address: string;
  is_default: boolean;
  created_at?: string;
};

type ChangeAddressProps = {
  onSelectAddress?: (address: Address) => void;
};

export default function ChangeAddress({ onSelectAddress }: ChangeAddressProps) {
  const router = useRouter();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressText, setAddressText] = useState("");
  const [email, setEmail] = useState("");
  const [isDefaultChecked, setIsDefaultChecked] = useState(false);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setAddresses([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) console.error("fetch addresses error", error);
    else setAddresses(data ?? []);
    setLoading(false);
  };

  const openAddForm = () => {
    setEditingId(null);
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setAddressText("");
    setIsDefaultChecked(false);
    setShowForm(true);
  };

  const openEditForm = (addr: Address) => {
    setEditingId(addr.id);
    setFirstName(addr.first_name);
    setLastName(addr.last_name);
    setPhone(addr.phone);
    setEmail(addr.email || "");
    setAddressText(addr.address);
    setIsDefaultChecked(addr.is_default);
    setShowForm(true);
  };

  const setAsDefault = async (addr: Address) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Error", "You must be signed in.");
        return;
      }

      // Unset previous defaults for this user
      const { error: unsetError } = await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", user.id);
      if (unsetError) throw unsetError;

      // Set selected as default
      const { error: setError } = await supabase
        .from("addresses")
        .update({ is_default: true })
        .eq("id", addr.id)
        .eq("user_id", user.id);
      if (setError) throw setError;

      Alert.alert("Success", "Default address updated.");
      fetchAddresses();
    } catch (e) {
      console.error("Set default error:", e);
      Alert.alert("Error", "Could not set default address.");
    }
  };

  const handleSaveAddress = async () => {
    if (!firstName || !lastName || !phone || !addressText) {
      Alert.alert("Error", "All fields are required!");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("Error", "You must be signed in.");
      return;
    }

    const fullName = `${firstName} ${lastName}`;

    if (editingId) {
      const { error } = await supabase
        .from("addresses")
        .update({
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          phone,
          email,
          address: addressText,
          is_default: isDefaultChecked,
        })
        .eq("id", editingId)
        .eq("user_id", user.id);

      if (error) Alert.alert("Error", "Could not update address.");
    } else {
      const isDefault = isDefaultChecked || addresses.length === 0;
      const { error } = await supabase
        .from("addresses")
        .insert([
          {
            user_id: user.id,
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            phone,
            email,
            address: addressText,
            is_default: isDefault,
          },
        ]);

      if (error) {
        Alert.alert("Error", "Could not save address.");
        return;
      }
    }

    setShowForm(false);
    fetchAddresses();
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Delete Address", "Are you sure you want to delete this address?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (userError || !user) {
            Alert.alert("Error", "You must be signed in.");
            return;
          }

          const { error } = await supabase
            .from("addresses")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

          if (error) {
            console.error("Delete error:", error);
            Alert.alert("Error", "Could not delete address. Check your console for details.");
          } else {
            Alert.alert("Deleted", "Address deleted successfully.");
            fetchAddresses();
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header with Back Button */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, paddingTop: 36 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
          <Text style={{ fontSize: 18, color: "#8B1C1C" }}>{"<"}</Text>
        </TouchableOpacity>
        
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#8B1C1C" }}>My Addresses</Text>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

          {loading ? (
            <ActivityIndicator size="large" color="#8B1C1C" />
          ) : (
            <View>
              {addresses.map((addr) => (
                <View key={addr.id} style={styles.addrCard}>
                  <TouchableOpacity onPress={() => openEditForm(addr)}>
                    <Text style={styles.addrName}>
                      {addr.full_name} ({addr.phone})
                    </Text>
                    <Text style={styles.addrText}>{addr.address}</Text>
                    {addr.is_default && (
                      <Text style={styles.defaultBadge}>Default</Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.addrActions}>
                    {!addr.is_default && (
                      <TouchableOpacity onPress={() => setAsDefault(addr)}>
                        <Text style={styles.setDefaultBtn}>Set Default</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => openEditForm(addr)}>
                      <Text style={styles.editBtn}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(addr.id)}>
                      <Text style={styles.deleteBtn}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.addBtn} onPress={openAddForm}>
                <Text style={styles.addBtnText}>+ Add New Address</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Modal for Add/Edit */}
          <Modal visible={showForm} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalHeader}>
                  {editingId ? "Edit Address" : "Add New Address"}
                </Text>

                <TextInput
                  placeholder="First Name"
                  value={firstName}
                  onChangeText={setFirstName}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Last Name"
                  value={lastName}
                  onChangeText={setLastName}
                  style={styles.input}
                />
                <TextInput
                  placeholder="Phone"
                  value={phone}
                  onChangeText={setPhone}
                  style={styles.input}
                  keyboardType="phone-pad"
                />
                <TextInput
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  style={styles.input}
                  keyboardType="email-address"
                />
                <TextInput
                  placeholder="Address"
                  value={addressText}
                  onChangeText={setAddressText}
                  style={[styles.input, { height: 80 }]}
                  multiline
                />

                <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 8 }}>
                  <TouchableOpacity
                    style={[styles.checkbox, isDefaultChecked && styles.checkboxChecked]}
                    onPress={() => setIsDefaultChecked(!isDefaultChecked)}
                  >
                    {isDefaultChecked && <Text style={{ color: "#fff" }}>✓</Text>}
                  </TouchableOpacity>
                  <Text style={{ marginLeft: 8 }}>Set as Default</Text>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12 }}>
                  <TouchableOpacity onPress={() => setShowForm(false)} style={styles.cancelBtn}>
                    <Text>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveAddress} style={styles.saveBtn}>
                    <Text style={{ color: "#fff" }}>{editingId ? "Save" : "Add"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </KeyboardAvoidingView>

      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { fontSize: 20, fontWeight: "700", marginBottom: 12, color: "#8B1C1C" },
  addrCard: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#eee", marginBottom: 12, backgroundColor: "#fff" },
  addrName: { fontWeight: "700", fontSize: 16 },
  addrText: { marginTop: 4, color: "#555" },
  defaultBadge: { marginTop: 4, color: "#fff", backgroundColor: "#8B1C1C", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start" },
  addrActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  editBtn: { marginRight: 12, color: "#007bff", fontWeight: "600" },
  deleteBtn: { color: "#dc3545", fontWeight: "600" },
  setDefaultBtn: { marginRight: 12, color: "#28a745", fontWeight: "700" },
  addBtn: { padding: 12, borderRadius: 8, backgroundColor: "#8B1C1C", alignItems: "center", marginTop: 16 },
  addBtnText: { color: "#fff", fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 16 },
  modalContent: { backgroundColor: "#fff", borderRadius: 12, padding: 16 },
  modalHeader: { fontSize: 18, fontWeight: "700", marginBottom: 12, color: "#8B1C1C" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 8, marginBottom: 8 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: "#ccc", justifyContent: "center", alignItems: "center", borderRadius: 4 },
  checkboxChecked: { backgroundColor: "#8B1C1C", borderColor: "#8B1C1C" },
  cancelBtn: { padding: 10, marginRight: 8 },
  saveBtn: { padding: 10, backgroundColor: "#8B1C1C", borderRadius: 6 },
  bottomNavBar: {
    flexDirection: "row",
    height: 70,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "space-around",
    position: "absolute",
    bottom: 0,
    width: "100%",
  },
  navItem: { alignItems: "center", justifyContent: "center" },
  navIcon: { width: 24, height: 24 },
  navLabel: { fontSize: 12, color: "#8B1C1C", marginTop: 2 },
  fabWrapper: { position: "absolute", bottom: 15, alignSelf: "center" },
  fabButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 5 },
  fabIcon: { width: 50, height: 50 },
});
