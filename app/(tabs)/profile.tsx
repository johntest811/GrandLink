import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, Modal, TextInput, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabaseClient';
import { Ionicons, MaterialIcons, FontAwesome5, Entypo, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import BottomNavBar from '@/components/BottomNav';
import { useModal } from '@/hooks/useModal';
import { useAppContext } from '@/context/AppContext';

type ProfileUser = {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    full_name?: string;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    avatar_url?: string;
    picture?: string;
    [key: string]: any;
  };
};

const getDisplayName = (profileUser: ProfileUser | null) => {
  const metadata = profileUser?.user_metadata;
  if (!metadata) return '';

  const directName = String(metadata.name || '').trim();
  if (directName) return directName;

  const fullName = String(metadata.full_name || '').trim();
  if (fullName) return fullName;

  const first = String(metadata.first_name || '').trim();
  const middle = String(metadata.middle_name || '').trim();
  const last = String(metadata.last_name || '').trim();
  const combined = [first, middle, last].filter(Boolean).join(' ').trim();
  return combined;
};

export default function ProfileScreen() {
  const { darkMode } = useAppContext();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);
  const [reservationsCount, setReservationsCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [deletingAddress, setDeletingAddress] = useState(false);
  
  // Profile editing states
  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  
  const router = useRouter();
  const modal = useModal();

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        // User not logged in, redirect to login
        modal.show({
          type: 'info',
          title: 'Login Required',
          message: 'Please login to access your profile.',
          buttons: [
            {
              text: 'Login',
              onPress: () => router.replace('/login'),
            },
          ],
        });
        return;
      }
      setUser(data.user);
      // load counts when user is available
      await loadCartCount();
      await loadOrdersCounts();
      await loadWishlistCount();
    };
    fetchUser();
  }, []);

  const loadCartCount = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const { count, error } = await supabase
        .from('cart')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authData.user.id);
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

  const loadWishlistCount = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;

      const { count, error } = await supabase
        .from('user_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', authData.user.id)
        .eq('item_type', 'my-list')
        .eq('status', 'active');

      if (!error) setWishlistCount(count ?? 0);
    } catch (e: any) {
      console.error('Failed to load wishlist count', e);
    }
  };


  const handleLogout = async () => {
    modal.showConfirmation(
      'Logout',
      'Are you sure you want to logout?',
      async () => {
        await supabase.auth.signOut();
        router.replace('/login');
      }
    );
  };

  const openEditProfileModal = () => {
    setEditingName(getDisplayName(user));
    setSelectedImageUri(null);
    setEditProfileModalVisible(true);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
      modal.showError('Error', 'Failed to pick image');
    }
  };

  const updateProfile = async () => {
    try {
      if (!user) return;
      
      setIsUpdatingProfile(true);
      let avatarUrl = user.user_metadata?.avatar_url;

      // Upload image if a new one was selected
      if (selectedImageUri) {
        try {
          const fileName = `${user.id}-${Date.now()}.jpg`;
          
          // Read the image file
          const response = await fetch(selectedImageUri);
          const blob = await response.blob();

          // Upload to Supabase storage
          const { data, error: uploadError } = await supabase.storage
            .from('profile-pictures')
            .upload(fileName, blob, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) throw uploadError;

          if (data) {
            const { data: publicUrlData } = supabase.storage
              .from('profile-pictures')
              .getPublicUrl(fileName);

            avatarUrl = publicUrlData.publicUrl;
          }
        } catch (uploadErr: any) {
          console.error('Image upload failed:', uploadErr);
          modal.showError('Upload Error', 'Failed to upload profile picture. Please try again.');
          setIsUpdatingProfile(false);
          return;
        }
      }

      // Update user metadata
      const nextDisplayName = editingName.trim() || getDisplayName(user);
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          name: nextDisplayName,
          full_name: nextDisplayName,
          avatar_url: avatarUrl,
        },
      });

      if (updateError) throw updateError;

      // Refresh user data
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        setUser(authData.user);
      }

      setEditProfileModalVisible(false);
      modal.showSuccess('Success', 'Profile updated successfully');
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      modal.showError('Error', 'Failed to update profile: ' + error.message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };



  const openCart = () => {
    router.push('../cart');
  };

  return (
    <View style={{ flex: 1, backgroundColor: darkMode ? '#101010' : '#fff' }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: darkMode ? '#101010' : '#fff' }}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
      >
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.profileTitle}>Profile</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>
        <View style={[styles.profileSection, { backgroundColor: darkMode ? '#151515' : '#fff' }]}>
          <TouchableOpacity onPress={openEditProfileModal}>
            <View style={styles.avatarWrapper}>
              <Image
                source={
                  user?.user_metadata?.avatar_url || user?.user_metadata?.picture
                    ? { uri: (user.user_metadata.avatar_url || user.user_metadata.picture) as string }
                    : require('@/assets/images/profileicon.png')
                }
                style={styles.avatar}
              />
              <View style={styles.editAvatarBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={openEditProfileModal} style={{ flex: 1 }}>
            <View>
              <Text style={[styles.welcome, { color: darkMode ? '#b3b3b3' : '#888' }]}>Welcome</Text>
              <Text style={[styles.name, { color: darkMode ? '#f2f2f2' : '#222' }]}>{getDisplayName(user) || 'No Name'}</Text>
              {!!user?.email && (
                <Text style={[styles.profileEmail, { color: darkMode ? '#b3b3b3' : '#666' }]}>{user.email}</Text>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={openEditProfileModal} style={styles.editButton}>
            <Ionicons name="pencil" size={18} color="#a81d1d" />
          </TouchableOpacity>
        </View>
        <View style={[styles.divider, { backgroundColor: darkMode ? '#2c2c2c' : '#ddd' }]} />

        {/* Purchases Section */}
        <Text style={[styles.sectionTitle, { color: darkMode ? '#f2f2f2' : '#000' }]}>My Purchases</Text>
        <View style={styles.purchasesRow}>
          <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.purchaseItem, pressed && styles.purchaseItemPressed]}
            onPress={openCart}
          >
            {({ pressed }) => (
              <>
                <View style={styles.iconContainer}>
                  <Ionicons name="cart" size={28} color={pressed ? '#8B1C1C' : darkMode ? '#f2f2f2' : '#000'} />
                  {cartCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{cartCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.purchaseLabel, { color: darkMode ? '#f2f2f2' : '#000' }, pressed && { color: '#8B1C1C' }]}>Cart</Text>
              </>
            )}
          </Pressable>
          <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.purchaseItem, pressed && styles.purchaseItemPressed]}
            onPress={() => router.push('../wishlist')}
          >
            {({ pressed }) => (
              <>
                <View style={styles.iconContainer}>
                  <Ionicons name="heart" size={28} color={pressed ? '#E24343' : darkMode ? '#f2f2f2' : '#000'} />
                  {wishlistCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{wishlistCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.purchaseLabel, { color: darkMode ? '#f2f2f2' : '#000' }, pressed && { color: '#8B1C1C' }]}>Wishlist</Text>
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
                  <Ionicons name="calendar" size={28} color={pressed ? '#8B1C1C' : darkMode ? '#f2f2f2' : '#000'} />
                  {reservationsCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{reservationsCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.purchaseLabel, { color: darkMode ? '#f2f2f2' : '#000' }, pressed && { color: '#8B1C1C' }]}>Reservation</Text>
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
                  <Ionicons name="receipt" size={28} color={pressed ? '#8B1C1C' : darkMode ? '#f2f2f2' : '#000'} />
                  {ordersCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{ordersCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.purchaseLabel, { color: darkMode ? '#f2f2f2' : '#000' }, pressed && { color: '#8B1C1C' }]}>Orders</Text>
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
                  <Feather name="check-square" size={28} color={pressed ? '#8B1C1C' : darkMode ? '#f2f2f2' : '#000'} />
                  {completedCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{completedCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.purchaseLabel, { color: darkMode ? '#f2f2f2' : '#000' }, pressed && { color: '#8B1C1C' }]}>Completed</Text>
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
                  <MaterialIcons name="cancel" size={28} color={pressed ? '#8B1C1C' : darkMode ? '#f2f2f2' : '#000'} />
                  {cancelledCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{cancelledCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.purchaseLabel, { color: darkMode ? '#f2f2f2' : '#000' }, pressed && { color: '#8B1C1C' }]}>Cancelled</Text>
              </>
            )}
          </Pressable>
        </View>
        <View style={[styles.divider, { backgroundColor: darkMode ? '#2c2c2c' : '#ddd' }]} />

        {/* Settings List */}
        <View style={styles.menuList}>
          <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => router.push('../notification')}
          >
            {({ pressed }) => (
              <>
                <Ionicons name="notifications" size={22} color={pressed ? '#8B1C1C' : darkMode ? '#f2f2f2' : '#000'} />
                <Text style={[styles.menuText, { color: pressed ? '#8B1C1C' : darkMode ? '#f2f2f2' : '#000' }]}>Notification Settings</Text>
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
                <Ionicons name="settings" size={22} color={pressed ? '#8B1C1C' : darkMode ? '#f2f2f2' : '#000'} />
                <Text style={[styles.menuText, { color: pressed ? '#8B1C1C' : darkMode ? '#f2f2f2' : '#000' }]}>Settings</Text>
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
                <MaterialIcons name="live-help" size={22} color={pressed ? '#8B1C1C' : darkMode ? '#f2f2f2' : '#000'} />
                <Text style={[styles.menuText, { color: pressed ? '#8B1C1C' : darkMode ? '#f2f2f2' : '#000' }]}>FAQs</Text>
              </>
            )}
          </Pressable>
          <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => router.push('/(tabs)/contact-service')}
          >
            {({ pressed }) => (
              <>
                <Feather name="help-circle" size={22} color={pressed ? '#8B1C1C' : darkMode ? '#f2f2f2' : '#000'} />
                <Text style={[styles.menuText, { color: pressed ? '#8B1C1C' : darkMode ? '#f2f2f2' : '#000' }]}>Help Centre</Text>
              </>
            )}
          </Pressable>
          <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => router.push('../ChangeAddress')}
          >
            {({ pressed }) => (
              <>
                <Ionicons name="location" size={22} color={pressed ? '#8B1C1C' : darkMode ? '#f2f2f2' : '#000'} />
                <Text style={[styles.menuText, { color: pressed ? '#8B1C1C' : darkMode ? '#f2f2f2' : '#000' }]}>My Addresses</Text>
              </>
            )}
          </Pressable>
          <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={() => router.push('../inquire')}
          >
            {({ pressed }) => (
              <>
                <Entypo name="help" size={22} color={pressed ? '#8B1C1C' : darkMode ? '#f2f2f2' : '#000'} />
                <Text style={[styles.menuText, { color: pressed ? '#8B1C1C' : darkMode ? '#f2f2f2' : '#000' }]}>Inquire</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Logout Menu Item */}
        <View style={[styles.menuList, { marginBottom: 12, paddingBottom: 12 }]}>
          <Pressable
            android_ripple={{ color: '#8B1C1C' }}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={handleLogout}
          >
            {({ pressed }) => (
              <>
                <MaterialIcons name="logout" size={22} color={pressed ? '#fff' : '#a81d1d'} />
                <Text style={[styles.menuText, { color: pressed ? '#fff' : '#a81d1d' }]}>Logout</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editProfileModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditProfileModalVisible(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Profile Picture Selection */}
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <View style={styles.modalAvatarWrapper}>
                  <Image
                    source={
                      selectedImageUri
                        ? { uri: selectedImageUri }
                        : user?.user_metadata?.avatar_url || user?.user_metadata?.picture
                        ? { uri: (user.user_metadata.avatar_url || user.user_metadata.picture) as string }
                        : require('@/assets/images/profileicon.png')
                    }
                    style={styles.modalAvatar}
                  />
                </View>
                <Pressable
                  style={({ pressed }) => [styles.pickImageButton, pressed && styles.pickImageButtonPressed]}
                  onPress={pickImage}
                >
                  <Ionicons name="camera" size={18} color="#fff" />
                  <Text style={styles.pickImageButtonText}>Change Photo</Text>
                </Pressable>
              </View>

              {/* Name Input */}
              <View>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={String(user?.email || '')}
                  editable={false}
                  selectTextOnFocus={false}
                  placeholder="Email"
                  placeholderTextColor="#999"
                />

                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  value={editingName}
                  onChangeText={setEditingName}
                  placeholderTextColor="#999"
                  maxLength={50}
                />
              </View>

              {/* Save Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.saveButton,
                  isUpdatingProfile && styles.saveButtonDisabled,
                  pressed && !isUpdatingProfile && { opacity: 0.9 },
                ]}
                onPress={updateProfile}
                disabled={isUpdatingProfile}
              >
                {isUpdatingProfile ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </Pressable>

              {/* Cancel Button */}
              <Pressable
                style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.8 }]}
                onPress={() => setEditProfileModalVisible(false)}
                disabled={isUpdatingProfile}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
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
  avatarWrapper: {
    position: 'relative',
    marginRight: 16,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#a81d1d',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  editButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarWrapper: {
    marginBottom: 16,
  },
  modalAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#eee',
  },
  pickImageButton: {
    backgroundColor: '#a81d1d',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  pickImageButtonPressed: {
    backgroundColor: '#8B1515',
    opacity: 0.9,
  },
  pickImageButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  profileEmail: {
    fontSize: 13,
    marginTop: 2,
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
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  purchaseItem: {
    alignItems: 'center',
    width: '30%',
    paddingVertical: 12,
    paddingHorizontal: 4,
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
  inputDisabled: {
    backgroundColor: '#eceef1',
    color: '#7a7a7a',
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