import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';
import type { User } from '@supabase/supabase-js';
import { Ionicons, MaterialIcons, FontAwesome5, Entypo, Feather } from '@expo/vector-icons';

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [savedAddress, setSavedAddress] = useState<any>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      // load cart count when user is available
      if (data?.user) {
        await loadCartCount();
        await loadUserAddress();
      }
    };
    fetchUser();
  }, []);

  const loadCartCount = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const { count, error } = await supabase
        .from('user_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authData.user.id)
        .eq('item_type', 'order')
        .eq('status', 'active');
      if (error) throw error;
      setCartCount(count ?? 0);
    } catch (e: any) {
      // Failed to load cart count
    }
  };

  const loadUserAddress = async () => {
    try {
      setLoadingAddress(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', authData.user.id)
        .eq('is_default', true)
        .maybeSingle();

      if (error) {
        // Don't throw error, just log it - table might not exist yet
        console.error('Load address error:', error);
        return;
      }
      
      if (data) {
        setSavedAddress(data);
        // Try to split full_name if first_name/last_name aren't available
        if (data.first_name && data.last_name) {
          setFirstName(data.first_name);
          setLastName(data.last_name);
        } else if (data.full_name) {
          const nameParts = data.full_name.split(' ');
          setFirstName(nameParts[0] || '');
          setLastName(nameParts.slice(1).join(' ') || '');
        }
        setPhoneNumber(data.phone || '');
        setEmail(data.email || '');
        setAddress(data.address || '');
      }
    } catch (e: any) {
      // Failed to load address
    } finally {
      setLoadingAddress(false);
    }
  };

  const openAddressModal = () => {
    setShowAddressModal(true);
  };

  const closeAddressModal = () => {
    setShowAddressModal(false);
  };

  const saveAddress = async () => {
    try {
      // Validate required fields
      if (!firstName.trim() || !lastName.trim() || !phoneNumber.trim() || !email.trim() || !address.trim()) {
        Alert.alert('Missing Information', 'Please fill in all required fields.');
        return;
      }

      setSavingAddress(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        Alert.alert('Error', 'Please sign in to save address.');
        return;
      }

      const addressRecord = {
        user_id: authData.user.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        phone: phoneNumber.trim(),
        email: email.trim(),
        address: address.trim(),
        is_default: true,
      };

      if (savedAddress) {
        // Update existing address
        const { data, error } = await supabase
          .from('addresses')
          .update(addressRecord)
          .eq('id', savedAddress.id)
          .select();

        if (error) throw error;
      } else {
        // Insert new address
        const { data, error } = await supabase
          .from('addresses')
          .insert(addressRecord)
          .select();

        if (error) throw error;
      }

      Alert.alert('Success', 'Your address has been saved successfully!');
      await loadUserAddress();
      closeAddressModal();
    } catch (e: any) {
      console.error('Save address error:', JSON.stringify(e, null, 2));
      const errorMsg = e?.message || e?.error_description || e?.hint || e?.details || 'Unknown error';
      Alert.alert('Error', `Failed to save address: ${errorMsg}`);
    } finally {
      setSavingAddress(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const openCart = () => {
    router.push('../cart');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView style={{ flex: 1 }}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.profileTitle}>Profile</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>
        <View style={styles.profileSection}>
          <Image
            source={require('@/assets/images/profileicon.png')}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.welcome}>Welcome</Text>
            <Text style={styles.name}>{user?.user_metadata?.name || 'No Name'}</Text>
          </View>
        </View>
        <View style={styles.divider} />

        {/* Purchases Section */}
        <Text style={styles.sectionTitle}>My Purchases</Text>
        <View style={styles.purchasesRow}>
          <TouchableOpacity style={styles.purchaseItem} onPress={openCart}>
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

        {/* Settings List */}
        <View style={styles.menuList}>
          <TouchableOpacity style={styles.menuItem} onPress={openAddressModal}>
            <FontAwesome5 name="address-book" size={22} color="#a81d1d" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuText, { color: '#a81d1d', fontWeight: 'bold' }]}>My Address</Text>
              {savedAddress && (
                <Text style={styles.addressPreview} numberOfLines={1}>
                  {savedAddress.address}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#a81d1d" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="notifications" size={22} color="#2c3848" />
            <Text style={[styles.menuText, { color: '#2c3848', fontWeight: 'bold' }]}>Notification Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="settings" size={22} color="#222" />
            <Text style={styles.menuText}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <MaterialIcons name="live-help" size={22} color="#a81d1d" />
            <Text style={[styles.menuText, { color: '#a81d1d', fontWeight: 'bold' }]}>FAQs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Feather name="help-circle" size={22} color="#222" />
            <Text style={styles.menuText}>Help Centre</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Entypo name="help" size={22} color="#222" />
            <Text style={styles.menuText}>Inquire</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Address Modal */}
      <Modal
        visible={showAddressModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeAddressModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>My Address</Text>
              <TouchableOpacity onPress={closeAddressModal}>
                <Ionicons name="close" size={28} color="#222" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Text style={styles.inputLabel}>First Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="First Name"
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Text style={styles.inputLabel}>Last Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Last Name"
                    value={lastName}
                    onChangeText={setLastName}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Address *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="e.g., 123 Main Street, Barangay San Jose, Makati City, Metro Manila 1920"
                value={address}
                onChangeText={setAddress}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <TouchableOpacity 
                style={[styles.saveButton, savingAddress && styles.saveButtonDisabled]} 
                onPress={saveAddress}
                disabled={savingAddress}
              >
                {savingAddress ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Address</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={closeAddressModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modern Bottom Navbar */}
      <View style={styles.bottomNavBar}>
                <TouchableOpacity style={styles.navItem} onPress={() => router.push('../homepage')}>
                  <Image source={require('@/assets/images/home.png')} style={styles.navIcon} resizeMode="contain" />
                  <Text style={styles.navLabel}>Home</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => {/* Add your action */}}>
                  <Image source={require('@/assets/images/inquire.png')} style={styles.navIcon} resizeMode="contain" />
                  <Text style={styles.navLabel}>Inquire</Text>
                </TouchableOpacity>
                <View style={styles.fabWrapper}>
                  <TouchableOpacity style={styles.fabButton} onPress={() => router.push('../shop')}>
                    <Image source={require('@/assets/images/catalogbutton.png')} style={styles.fabIcon} resizeMode="contain" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.navItem} onPress={() => {/* Add your action */}}>
                  <Image source={require('@/assets/images/service.png')} style={styles.navIcon} resizeMode="contain" />
                  <Text style={styles.navLabel}>Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => {/* Add your action */}}>
                  <Image source={require('@/assets/images/settings.png')} style={styles.navIcon} resizeMode="contain" />
                  <Text style={styles.navLabel}>Settings</Text>
                </TouchableOpacity>
              </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#a81d1d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  profileTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#222',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 16,
    backgroundColor: '#eee',
  },
  welcome: {
    fontSize: 16,
    color: '#888',
    marginBottom: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 12,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    marginLeft: 24,
    marginBottom: 8,
  },
  purchasesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  purchaseItem: {
    alignItems: 'center',
    flex: 1,
  },
  purchaseLabel: {
    fontSize: 12,
    color: '#222',
    marginTop: 4,
    textAlign: 'center',
  },
  menuList: {
    marginTop: 8,
    paddingHorizontal: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  menuText: {
    fontSize: 16,
    marginLeft: 16,
    color: '#222',
  },
  logoutButton: {
    backgroundColor: '#a81d1d',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    margin: 24,
    alignItems: 'center',
    elevation: 2,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  bottomNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#4f5f8aff',
    height: 70,
    paddingBottom: 8,
    paddingTop: 8,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    width: 45,
    height: 45,
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  fabWrapper: {
    position: 'relative',
    top: -28,
    alignItems: 'center',
    flex: 1,
  },
  fabButton: {
    width: 65,
    height: 65,
    borderRadius: 28,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    borderWidth: 3,
    borderColor: '#4c58c0ff',
  },
  fabIcon: {
    width: 32,
    height: 32,
  },
  addressPreview: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    marginLeft: 16,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#a81d1d',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    elevation: 2,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});