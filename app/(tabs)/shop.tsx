import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../supabaseClient';
import { useAppContext } from '../../context/AppContext';

const filterOptions = [
  'Doors',
  'Windows',
  'Enclosure',
  'Casement',
  'Sliding',
  'Curtain Wall',
  'Rails',
  'Canopy',
];

export default function ShopScreen() {
  const router = useRouter();
  const { filter } = useLocalSearchParams();
  const { darkMode } = useAppContext(); 

  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.from('products').select('*');
      if (error) setError(error.message);
      else setData(data || []);
    };
    fetchData();
  }, []);

  // Filtered results
  const filteredData = data.filter((product) => {
    const categoryMatch =
      selectedCategory === 'All' || product.category === selectedCategory;
    const searchMatch =
      searchQuery.trim() === '' ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return categoryMatch && searchMatch;
  });

  // Dark mode colors
  const colors = {
    background: darkMode ? '#0d1117' : '#fff',
    text: darkMode ? '#f0f6fc' : '#222',
    secondary: darkMode ? '#161b22' : '#f2f2f2',
    accent: '#a81d1d',
    navbar: '#4f5f8aff',
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.logoRow}>
          <Image
            source={require('@/assets/images/GLLogo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View>
            <Text style={[styles.logoTitle, { color: colors.accent }]}>
              GRAND EAST
            </Text>
            <Text style={[styles.logoSubtitle, { color: colors.text }]}>
              GLASS AND ALUMINUM
            </Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('../profile')}
          >
            <Image
              source={require('@/assets/images/profileicon.png')}
              style={styles.profileIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View
            style={[styles.searchBox, { backgroundColor: colors.secondary }]}
          >
            <Ionicons
              name="search"
              size={20}
              color={darkMode ? '#999' : '#555'}
            />
            <TextInput
              placeholder="Search products..."
              style={[styles.searchInput, { color: colors.text }]}
              placeholderTextColor={darkMode ? '#888' : '#999'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: colors.secondary }]}
            onPress={() => setFilterVisible(true)}
          >
            <Ionicons
              name="menu"
              size={24}
              color={darkMode ? '#fff' : '#222'}
            />
          </TouchableOpacity>
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {['All', ...filterOptions].map((option) => (
            <TouchableOpacity
              key={option}
              onPress={() => setSelectedCategory(option)}
              style={[
                styles.tabButton,
                {
                  backgroundColor:
                    selectedCategory === option
                      ? colors.accent
                      : colors.secondary,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    selectedCategory === option
                      ? '#fff'
                      : darkMode
                      ? '#f0f6fc'
                      : '#222',
                  fontWeight: selectedCategory === option ? 'bold' : '500',
                }}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Products */}
        <View style={styles.productsContainer}>
          {filteredData.map((product) => (
            <TouchableOpacity
              key={product.id}
              style={[
                styles.productBox,
                { backgroundColor: colors.secondary },
              ]}
              activeOpacity={0.85}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/product',
                  params: { id: product.id },
                })
              }
            >
              <Image
                source={
                  product.image1
                    ? { uri: product.image1 }
                    : require('@/assets/images/placeholder.png')
                }
                style={styles.productImage}
                resizeMode="cover"
              />
              <Text style={[styles.productName, { color: colors.text }]}>
                {product.name}
              </Text>
              <Text
                style={[styles.productDesc, { color: darkMode ? '#aaa' : '#555' }]}
              >
                {product.description}
              </Text>
              <Text style={[styles.productPrice, { color: colors.accent }]}>
                ₱{product.price}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Bottom Navbar */}
      <View style={[styles.bottomNavBar, { backgroundColor: colors.navbar }]}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('../homepage')}
        >
          <Image
            source={require('@/assets/images/home.png')}
            style={styles.navIcon}
          />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('../inquire')}
        >
          <Image
            source={require('@/assets/images/inquire.png')}
            style={styles.navIcon}
          />
          <Text style={styles.navLabel}>Inquire</Text>
        </TouchableOpacity>

        <View style={styles.fabWrapper}>
          <TouchableOpacity
            style={styles.fabButton}
            onPress={() => router.push('../shop')}
          >
            <Image
              source={require('@/assets/images/catalogbutton.png')}
              style={styles.fabIcon}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.navItem}>
          <Image
            source={require('@/assets/images/service.png')}
            style={styles.navIcon}
          />
          <Text style={styles.navLabel}>Service</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('../setting')}
        >
          <Image
            source={require('@/assets/images/settings.png')}
            style={styles.navIcon}
          />
          <Text style={styles.navLabel}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  logoImage: { width: 40, height: 40, marginRight: 10 },
  logoTitle: { fontWeight: 'bold', fontSize: 20 },
  logoSubtitle: { fontSize: 12 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16 },
  filterButton: {
    padding: 10,
    borderRadius: 10,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  tabButton: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginRight: 10,
  },
  productsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 8,
  },
  productBox: {
    width: 320,
    borderRadius: 20,
    margin: 12,
    padding: 16,
    alignItems: 'center',
  },
  productImage: {
    width: 260,
    height: 260,
    borderRadius: 10,
    marginBottom: 8,
  },
  productName: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  productDesc: { fontSize: 13, textAlign: 'center', marginBottom: 4 },
  productPrice: { fontSize: 15, fontWeight: 'bold' },
  bottomNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 70,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  navItem: { flex: 1, alignItems: 'center' },
  navIcon: { width: 35, height: 35, marginBottom: 2 },
  navLabel: { fontSize: 11, color: '#fff', fontWeight: '600' },
  fabWrapper: { position: 'relative', top: -28, alignItems: 'center' },
  fabButton: {
    width: 65,
    height: 65,
    borderRadius: 32,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#4c58c0ff',
  },
  fabIcon: { width: 32, height: 32 },
  profileButton: {
    position: 'absolute',
    right: 15,
    top: '50%',
    transform: [{ translateY: -20 }],
  },
  profileIcon: { width: 36, height: 36, borderRadius: 18 },
});
