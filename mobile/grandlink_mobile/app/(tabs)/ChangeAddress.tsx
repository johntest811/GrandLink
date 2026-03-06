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
import { Ionicons } from "@expo/vector-icons";

type Address = {
  id: string;
  user_id?: string;
  label?: string;
  full_name: string;
  email?: string;
  phone: string;
  address: string; // Stores JSON stringified granular data or legacy string
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

  const [fullName, setFullName] = useState("");
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [zipCode, setZipCode] = useState("");
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
    setFullName("");
    setLabel("");
    setEmail("");
    setPhone("");
    setStreet("");
    setAddressLine2("");
    setCity("");
    setStateRegion("");
    setZipCode("");
    setIsDefaultChecked(false);
    setShowForm(true);
  };

  const openEditForm = (addr: Address) => {
    setEditingId(addr.id);
    setFullName(addr.full_name || "");
    setEmail(addr.email || "");
    setPhone(addr.phone || "");

    let parsedLabel = "";
    let parsedStreet = addr.address;
    let parsedLine2 = "";
    let parsedCity = "";
    let parsedState = "";
    let parsedZip = "";

    try {
      const parsed = JSON.parse(addr.address);
      if (parsed && typeof parsed === 'object' && parsed.street) {
        parsedLabel = parsed.label || "";
        parsedStreet = parsed.street || "";
        parsedLine2 = parsed.addressLine2 || "";
        parsedCity = parsed.city || "";
        parsedState = parsed.stateRegion || "";
        parsedZip = parsed.zipCode || "";
      }
    } catch (e) {
      // Legacy address format (just a string)
    }

    setLabel(parsedLabel);
    setStreet(parsedStreet);
    setAddressLine2(parsedLine2);
    setCity(parsedCity);
    setStateRegion(parsedState);
    setZipCode(parsedZip);
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
    if (!fullName || !phone || !street || !city || !stateRegion || !zipCode) {
      Alert.alert("Error", "Please fill in all required fields!");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("Error", "You must be signed in.");
      return;
    }

    // Check if there's an existing default address (other than the one being edited)
    const existingDefault = addresses.find(
      (a) => a.is_default && a.id !== editingId
    );
    const isFirstAddress = addresses.length === 0 && !editingId;

    // If user wants to set as default but another already exists → ask first
    if (isDefaultChecked && existingDefault) {
      Alert.alert(
        "Change Default Address?",
        `You already have a default address set to "${existingDefault.full_name}". Do you want to replace it with this one?`,
        [
          {
            text: "Yes, make this default",
            onPress: () => performSave(user, true),
          },
          {
            text: "No, save without default",
            style: "cancel",
            onPress: () => performSave(user, false),
          },
        ]
      );
    } else {
      // No conflict — just save. Auto-default if it's the very first address.
      performSave(user, isDefaultChecked || isFirstAddress);
    }
  };

  const performSave = async (user: any, makeDefault: boolean) => {
    const combinedPlain = `${street}${addressLine2 ? ', ' + addressLine2 : ''}, ${city}, ${stateRegion}, ${zipCode}`;
    const jsonAddress = JSON.stringify({
      label,
      street,
      addressLine2,
      city,
      stateRegion,
      zipCode,
      display: combinedPlain
    });

    const sharedData = {
      full_name: fullName,
      email: email,
      phone: phone,
      address: jsonAddress,
      is_default: makeDefault,
    };

    // If making default, unset all other defaults first
    if (makeDefault) {
      await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", user.id);
    }

    if (editingId) {
      // Do NOT include user_id in update payload — can conflict with RLS
      const { error } = await supabase
        .from("addresses")
        .update(sharedData)
        .eq("id", editingId)
        .eq("user_id", user.id);

      if (error) {
        console.error("Update error:", error);
        Alert.alert("Error", `Could not update address: ${error.message}`);
        return;
      }
      Alert.alert("Success", "Address updated.");
    } else {
      const { error } = await supabase
        .from("addresses")
        .insert([{ user_id: user.id, ...sharedData }]);

      if (error) {
        console.error("Insert error:", error);
        Alert.alert("Error", `Could not save address: ${error.message}`);
        return;
      }
      Alert.alert("Success", "Address saved.");
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      {/* Header */}
      <View style={{
        flexDirection: "row", alignItems: "center",
        backgroundColor: "#8B1C1C",
        paddingHorizontal: 16, paddingVertical: 12,
        elevation: 4, shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: 'rgba(255,255,255,0.2)',
            justifyContent: 'center', alignItems: 'center',
            marginRight: 12,
          }}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff", flex: 1 }}>My Addresses</Text>
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
              {addresses.map((addr) => {
                let displayAddress = addr.address;
                try {
                  const parsed = JSON.parse(addr.address);
                  if (parsed && typeof parsed === 'object' && parsed.display) {
                    displayAddress = parsed.display;
                  }
                } catch (e) {
                  // Legacy parsing fail is intended
                }

                return (
                  <View key={addr.id} style={styles.addrCard}>
                    <TouchableOpacity onPress={() => openEditForm(addr)}>
                      {(() => {
                        let lbl = "";
                        try { const p = JSON.parse(addr.address); lbl = p.label || ""; } catch { }
                        return lbl ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <View style={{ backgroundColor: '#8B1C1C', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 }}>
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{lbl}</Text>
                            </View>
                          </View>
                        ) : null;
                      })()}
                      <Text style={styles.addrName}>
                        {addr.full_name} ({addr.phone})
                      </Text>
                      <Text style={styles.addrText}>{displayAddress}</Text>
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
                );
              })}

              <TouchableOpacity style={styles.addBtn} onPress={openAddForm}>
                <Text style={styles.addBtnText}>+ Add New Address</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Modal for Add/Edit */}
          <Modal visible={showForm} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { maxHeight: '90%' }]}>
                <Text style={styles.modalHeader}>
                  {editingId ? "Edit Address" : "Add New Address"}
                </Text>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <TextInput
                    placeholder="Address Label (e.g. Home, Office)"
                    value={label}
                    onChangeText={setLabel}
                    style={styles.input}
                  />
                  <TextInput
                    placeholder="Full Name *"
                    value={fullName}
                    onChangeText={setFullName}
                    style={styles.input}
                  />
                  <TextInput
                    placeholder="Email Address"
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                    keyboardType="email-address"
                  />
                  <TextInput
                    placeholder="Phone Number *"
                    value={phone}
                    onChangeText={setPhone}
                    style={styles.input}
                    keyboardType="phone-pad"
                  />

                  <View style={{ height: 1, backgroundColor: '#eee', marginVertical: 10 }} />

                  <TextInput
                    placeholder="Address Line 1 (Street, House No.) *"
                    value={street}
                    onChangeText={setStreet}
                    style={styles.input}
                  />
                  <TextInput
                    placeholder="Address Line 2 (Optional)"
                    value={addressLine2}
                    onChangeText={setAddressLine2}
                    style={styles.input}
                  />
                  <TextInput
                    placeholder="City *"
                    value={city}
                    onChangeText={setCity}
                    style={styles.input}
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      placeholder="State/Region *"
                      value={stateRegion}
                      onChangeText={setStateRegion}
                      style={[styles.input, { flex: 2 }]}
                    />
                    <TextInput
                      placeholder="ZIP Code *"
                      value={zipCode}
                      onChangeText={setZipCode}
                      style={[styles.input, { flex: 1 }]}
                      keyboardType="numeric"
                    />
                  </View>

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
                </ScrollView>
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
