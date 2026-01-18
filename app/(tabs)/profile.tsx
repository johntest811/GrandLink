import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Modal, TextInput, Alert, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';
import type { User } from '@supabase/supabase-js';
import { Ionicons, MaterialIcons, FontAwesome5, Entypo, Feather } from '@expo/vector-icons';
import BottomNavBar from "@BottomNav/../components/BottomNav";

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [reservationsCount, setReservationsCount] = useState(0);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [savedAddress, setSavedAddress] = useState<any>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [deletingAddress, setDeletingAddress] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        // User not logged in, redirect to login
        Alert.alert(
          'Login Required',
          'Please login to access your profile.',
          [
            { text: 'Cancel', onPress: () => router.back() },
            { text: 'Login', onPress: () => router.replace('/login') }
          ]
        );
        return;
      }
      setUser(data.user);
      // load counts when user is available
      await loadCartCount();
      await loadOrdersCounts();
      await loadUserAddress();
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

  const loadOrdersCounts = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      // Count active orders (not completed or cancelled)
      const { count: ordersCount, error: ordersError } = await supabase
        .from('user_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authData.user.id)
        .eq('item_type', 'order')
        .not('status', 'in', '(cancelled,completed)');
      
      if (!ordersError) setOrdersCount(ordersCount ?? 0);

      // Count completed orders
      const { count: completedCount, error: completedError } = await supabase
        .from('user_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authData.user.id)
        .eq('item_type', 'order')
        .eq('status', 'completed');
      
      if (!completedError) setCompletedCount(completedCount ?? 0);

      // Count cancelled orders
      const { count: cancelledCount, error: cancelledError } = await supabase
        .from('user_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authData.user.id)
        .eq('item_type', 'order')
        .or('status.eq.cancelled,order_status.eq.cancelled');
      
      if (!cancelledError) setCancelledCount(cancelledCount ?? 0);

      // Count reservations (paid items pending admin approval)
      const { count: reservationsCount, error: reservationsError } = await supabase
        .from('user_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authData.user.id)
        .eq('item_type', 'reservation');
      
      if (!reservationsError) setReservationsCount(reservationsCount ?? 0);
    } catch (e: any) {
      console.error('Failed to load order counts', e);
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

  const confirmDeleteAddress = () => {
    if (!savedAddress) {
      Alert.alert('No address', 'There is no saved address to delete.');
      return;
    }

    Alert.alert(
      'Delete address',
      'Are you sure you want to delete your saved address?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleDeleteAddress },
      ],
    );
  };

  const handleDeleteAddress = async () => {
    try {
      if (!savedAddress) return;
      setDeletingAddress(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        Alert.alert('Error', 'Please sign in to delete an address.');
        return;
      }

      const { error } = await supabase
        .from('addresses')
        .delete()
        .eq('id', savedAddress.id)
        .eq('user_id', authData.user.id);

      if (error) throw error;

      setSavedAddress(null);
      setFirstName('');
      setLastName('');
      setPhoneNumber('');
      setEmail('');
      setAddress('');
      Alert.alert('Removed', 'Address deleted successfully.');
      closeAddressModal();
    } catch (e: any) {
      console.error('Delete address error:', e);
      const errorMsg = e?.message || 'Failed to delete address.';
      Alert.alert('Error', errorMsg);
    } finally {
      setDeletingAddress(false);
    }
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
            source={
              user?.user_metadata?.avatar_url || user?.user_metadata?.picture
                ? { uri: (user.user_metadata.avatar_url || user.user_metadata.picture) as string }
                : require('@/assets/images/profileicon.png')
            }
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
           <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.purchaseItem, pressed && styles.purchaseItemPressed]}
            onPress={openCart}
           >
            {({ pressed }) => (
              <>
                <View style={styles.iconContainer}>
                  <Ionicons name="cart" size={28} color={pressed ? '#8B1C1C' : '#000'} />
                  {cartCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{cartCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.purchaseLabel, pressed && { color: '#8B1C1C' }]}>Cart</Text>
              </>
            )}
          </Pressable>
           <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.purchaseItem, pressed && styles.purchaseItemPressed]}
            onPress={() => router.push('../reservation')}
           >
            {({ pressed }) => (
              <>
                <View style={styles.iconContainer}>
                  <Ionicons name="calendar" size={28} color={pressed ? '#8B1C1C' : '#000'} />
                  {reservationsCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{reservationsCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.purchaseLabel, pressed && { color: '#8B1C1C' }]}>Reservation</Text>
              </>
            )}
           </Pressable>
           <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.purchaseItem, pressed && styles.purchaseItemPressed]}
            onPress={() => router.push('../orders')}
           >
            {({ pressed }) => (
              <>
                <View style={styles.iconContainer}>
                  <Ionicons name="receipt" size={28} color={pressed ? '#8B1C1C' : '#000'} />
                  {ordersCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{ordersCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.purchaseLabel, pressed && { color: '#8B1C1C' }]}>Orders</Text>
              </>
            )}
           </Pressable>
           <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.purchaseItem, pressed && styles.purchaseItemPressed]}
            onPress={() => router.push('../completed')}
           >
            {({ pressed }) => (
              <>
                <View style={styles.iconContainer}>
                  <Feather name="check-square" size={28} color={pressed ? '#8B1C1C' : '#000'} />
                  {completedCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{completedCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.purchaseLabel, pressed && { color: '#8B1C1C' }]}>Completed</Text>
              </>
            )}
           </Pressable>
           <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.purchaseItem, pressed && styles.purchaseItemPressed]}
            onPress={() => router.push('../cancelled')}
           >
            {({ pressed }) => (
              <>
                <View style={styles.iconContainer}>
                  <MaterialIcons name="cancel" size={28} color={pressed ? '#8B1C1C' : '#000'} />
                  {cancelledCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{cancelledCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.purchaseLabel, pressed && { color: '#8B1C1C' }]}>Cancelled</Text>
              </>
            )}
           </Pressable>
        </View>
        <View style={styles.divider} />

        {/* Settings List */}
        <View style={styles.menuList}>
          <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={openAddressModal}
          >
            {({ pressed }) => (
              <>
                <FontAwesome5 name="address-book" size={22} color={pressed ? '#8B1C1C' : '#000'} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuText, { color: pressed ? '#8B1C1C' : '#000' }]}>My Address</Text>
                  {savedAddress && (
                    <Text style={styles.addressPreview} numberOfLines={1}>
                      {savedAddress.address}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={pressed ? '#8B1C1C' : '#000'} />
              </>
            )}
          </Pressable>
          <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => router.push('../setting')}
          >
            {({ pressed }) => (
              <>
                <Ionicons name="notifications" size={22} color={pressed ? '#8B1C1C' : '#000'} />
                <Text style={[styles.menuText, { color: pressed ? '#8B1C1C' : '#000' }]}>Notification Settings</Text>
              </>
            )}
          </Pressable>
          <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => router.push('../setting')}
          >
            {({ pressed }) => (
              <>
                <Ionicons name="settings" size={22} color={pressed ? '#8B1C1C' : '#000'} />
                <Text style={[styles.menuText, { color: pressed ? '#8B1C1C' : '#000' }]}>Settings</Text>
              </>
            )}
          </Pressable>
          <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => router.push('../FAQs')}
          >
            {({ pressed }) => (
              <>
                <MaterialIcons name="live-help" size={22} color={pressed ? '#8B1C1C' : '#000'} />
                <Text style={[styles.menuText, { color: pressed ? '#8B1C1C' : '#000'}]}>FAQs</Text>
              </>
            )}
          </Pressable>
          <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => router.push('../about')}
          >
            {({ pressed }) => (
              <>
                <Feather name="help-circle" size={22} color={pressed ? '#8B1C1C' : '#000'} />
                <Text style={[styles.menuText, { color: pressed ? '#8B1C1C' : '#000' }]}>Help Centre</Text>
              </>
            )}
          </Pressable>
          <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={openAddressModal}
          >
            {({ pressed }) => (
              <>
                <Entypo name="help" size={22} color={pressed ? '#8B1C1C' : '#000'} />
                <Text style={[styles.menuText, { color: pressed ? '#8B1C1C' : '#000' }]}>Inquire</Text>
              </>
            )}
          </Pressable>
          <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => router.push('../ar-measure')}
          >
            {({ pressed }) => (
              <>
                <MaterialIcons name="straighten" size={22} color={pressed ? '#8B1C1C' : '#000'} />
                <Text style={[styles.menuText, { color: pressed ? '#8B1C1C' : '#000' }]}>AR Measurement</Text>
              </>
            )}
          </Pressable>
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

              {savedAddress && (
                <TouchableOpacity
                  style={[styles.deleteButton, deletingAddress && styles.deleteButtonDisabled]}
                  onPress={confirmDeleteAddress}
                  disabled={deletingAddress}
                >
                  {deletingAddress ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.deleteButtonText}>Delete Saved Address</Text>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modern Bottom Navbar */}
      <BottomNavBar />
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
    backgroundColor: '#8B1C1C',
  },
  profileTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
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
    color: '#000',
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
    paddingVertical: 8,
    borderRadius: 10,
  },
  purchaseItemPressed: {
    backgroundColor: 'rgba(139,28,28,0.08)',
  },
  iconContainer: {
    position: 'relative',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#a81d1d',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  purchaseLabel: {
    fontSize: 12,
    color: '#000',
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
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  menuItemPressed: {
    backgroundColor: 'rgba(139,28,28,0.08)',
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
  deleteButton: {
    backgroundColor: '#b3261e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    elevation: 1,
  },
  deleteButtonDisabled: {
    opacity: 0.7,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});