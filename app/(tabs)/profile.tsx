import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';
import type { User } from '@supabase/supabase-js';
import { Ionicons, MaterialIcons, FontAwesome5, Entypo, Feather } from '@expo/vector-icons';

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.profileTitle}>Profile</Text>
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
          <View style={styles.purchaseItem}>
            <Ionicons name="list" size={28} color="#a81d1d" />
            <Text style={styles.purchaseLabel}>My List</Text>
          </View>
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
          <TouchableOpacity style={styles.menuItem}>
            <FontAwesome5 name="address-book" size={22} color="#a81d1d" />
            <Text style={[styles.menuText, { color: '#a81d1d', fontWeight: 'bold' }]}>My Address</Text>
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

      {/* Bottom Navbar */}
      <View style={styles.redLowerBar}>
        <View style={styles.sideIconsContainer}>
          <TouchableOpacity style={styles.sideIconButton} onPress={() => router.push('../homepage')}>
            <Image
              source={require('@/assets/images/home.png')}
              style={styles.sideIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sideIconButton}>
            <Image
              source={require('@/assets/images/inquire.png')}
              style={styles.sideIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.circleButton}
          onPress={() => router.push('../shop')}
        >
          <Image
            source={require('@/assets/images/catalogbutton.png')}
            style={styles.catalogIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <View style={styles.sideIconsContainer}>
          <TouchableOpacity style={styles.sideIconButton}>
            <Image
              source={require('@/assets/images/service.png')}
              style={styles.sideIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sideIconButton}>
            <Image
              source={require('@/assets/images/settings.png')}
              style={styles.sideIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  redLowerBar: {
    height: '9%',
    width: '100%',
    backgroundColor: '#860e0eff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sideIconsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  sideIconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideIcon: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    zIndex: 1,
  },
  catalogIcon: {
    width: 32,
    height: 32,
  },
});