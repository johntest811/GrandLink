import React, { useEffect, useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../supabaseClient';

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
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('products') 
        .select('*');
      if (error) setError(error.message);
      else setData(data || []);
    };
    fetchData();
  }, []);

  // Filter products by selectedCategory and search query
  const filteredData = data.filter(product => {
    // Category filter
    const categoryMatch = selectedCategory === 'All' || product.category === selectedCategory;
    
    // Search filter - search in product name (case insensitive)
    const searchMatch = searchQuery.trim() === '' || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    return categoryMatch && searchMatch;
  });

  // Fetch products from Supabase, filtered by the category/type
  useEffect(() => {
    const fetchProducts = async () => {
      let query = supabase.from('products').select('*');
      if (filter) {
        query = query.eq('category', filter); // or .eq('type', filter) depending on your schema
      }
      const { data } = await query;
      setData(data || []);
    };
    fetchProducts();
  }, [filter]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        {/* Logo and Title */}
        <View style={styles.logoRow}>
          <Image
            source={require('@/assets/images/GLLogo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.logoTitle}>GRAND EAST</Text>
            <Text style={styles.logoSubtitle}>GLASS AND ALUMINUM</Text>
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
        <View style={styles.blueBar} />
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#888" />
            <TextInput
              placeholder="Search products..."
              style={styles.searchInput}
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setFilterVisible(true)}
          >
            <Ionicons name="menu" size={24} color="#222" />
          </TouchableOpacity>
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          <TouchableOpacity onPress={() => setSelectedCategory('All')}>
            <Text style={[styles.tabText, selectedCategory === 'All' && styles.tabActive]}>All</Text>
          </TouchableOpacity>
          {filterOptions.map(option => (
            <TouchableOpacity key={option} onPress={() => setSelectedCategory(option)}>
              <Text style={[styles.tabText, selectedCategory === option && styles.tabActive]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Products */}
        <View style={styles.productsContainer}>
          {filteredData.map(product => (
            <TouchableOpacity
              key={product.id}
              style={styles.productBox}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/(tabs)/product', params: { id: product.id } })}
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
              <Text style={styles.productName}>{product.name}</Text>
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Text style={[styles.productDesc, { maxWidth: 440, paddingHorizontal: 16 }]}>
                  {product.description}
                </Text>
              </View>
              <Text style={styles.productPrice}>₱{product.price}</Text>
              {/* You can add more info here, e.g. material, type, etc. */}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={filterVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="filter" size={24} color="#2563eb" />
              <Text style={{ fontWeight: 'bold', fontSize: 18, marginLeft: 8, color: '#2563eb' }}>Filter</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
              {filterOptions.map(option => (
                <TouchableOpacity
                  key={option}
                  style={styles.radioRow}
                  onPress={() => setSelectedCategory(option)}
                  activeOpacity={0.7}
                >
                  <View style={styles.radioOuter}>
                    {selectedCategory === option && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.radioLabel}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity style={styles.dropdown}>
                <Text>Colors ▼</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyButton} onPress={() => setFilterVisible(false)}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom Bar */}
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
          <Text style={styles.navLabel}>Service</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  logoImage: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  logoTitle: {
    fontWeight: 'bold',
    fontSize: 20,
    color: '#a81d1d',
  },
  logoSubtitle: {
    fontSize: 12,
    color: '#222',
  },
  blueBar: {
    height: 32,
    backgroundColor: '#2c3848',
    width: '100%',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12, // Add spacing between search and filter
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    maxWidth: '85%', // Limit search box width
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  filterButton: {
    padding: 8, // Add padding for better touch target
    backgroundColor: '#f2f2f2', // Add background to make it visible
    borderRadius: 8, // Match search box style
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40, // Ensure minimum width
    height: 40, // Match search box height
  },
  tabsRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignSelf: 'center',
  },
  tabText: {
    fontSize: 16,
    color: '#222',
    marginRight: 18,
    marginLeft: 30,
  },
  tabActive: {
    color: '#a81d1d',
    fontWeight: 'bold',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterModal: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '45%',
    marginBottom: 12,
    marginRight: 12,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563eb',
  },
  radioLabel: {
    fontSize: 15,
    color: '#222',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 8,
    padding: 10,
    minWidth: 100,
    marginRight: 12,
  },
  applyButton: {
    backgroundColor: '#a81d1d',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  productsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 8,
  },
  productBox: {
    width: 320,
    backgroundColor: '#fff',
    borderRadius: 20,
    margin: 16,
    padding: 20,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  productImage: {
    width: 280,
    height: 280,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#eee',
  },
  productName: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
    color: '#222',
  },
  productDesc: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 15,
    color: '#a81d1d',
    fontWeight: 'bold',
  },
  profileButton: {
    position: 'absolute',
    right: 15,
    top: '50%',
    transform: [{ translateY: -20 }],
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eee',
  },
});