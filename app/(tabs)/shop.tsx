import React, { useEffect, useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, ScrollView, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../supabaseClient';
import TopBar from '@/components/TopBar';
import BottomNavBar from "@/components/BottomNav";
import { useAppContext } from '@/context/AppContext';

const filterOptions = [
  'Doors',
  'Windows',
  'Enclosures',
  'Casement',
  'Sliding',
  'Curtain Wall',
  'Railings',
  'Canopy',
];

const CATEGORY_ALIASES: Record<string, string> = {
  door: 'Doors',
  doors: 'Doors',
  window: 'Windows',
  windows: 'Windows',
  enclosure: 'Enclosures',
  enclosures: 'Enclosures',
  casement: 'Casement',
  sliding: 'Sliding',
  'curtain wall': 'Curtain Wall',
  curtainwall: 'Curtain Wall',
  rail: 'Railings',
  rails: 'Railings',
  railing: 'Railings',
  railings: 'Railings',
  canopy: 'Canopy',
};

const normalizeCategory = (value: unknown): string => {
  const key = String(value || '').trim().toLowerCase();
  return CATEGORY_ALIASES[key] || String(value || '').trim();
};

const parseProductCategories = (value: unknown): string[] => {
  if (value == null) return [];

  if (Array.isArray(value)) {
    return value
      .map(normalizeCategory)
      .filter(Boolean);
  }

  return String(value)
    .split(/[|,/;]+/)
    .map(part => normalizeCategory(part))
    .filter(Boolean);
};

export default function ShopScreen() {
  const router = useRouter();
  const { darkMode } = useAppContext();
  const { filter } = useLocalSearchParams();
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('All');
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

  useEffect(() => {
    if (!filter) return;
    const normalizedFilter = normalizeCategory(filter);
    if (filterOptions.includes(normalizedFilter)) {
      setSelectedTab(normalizedFilter);
    }
  }, [filter]);

  // Filter products by selectedTab (horizontal tabs) or selectedCategories (modal) and search query
  const filteredData = data.filter(product => {
    const productCategories = parseProductCategories(product.category);
    let categoryMatch = true;

    if (selectedTab !== 'All') {
      categoryMatch = productCategories.includes(normalizeCategory(selectedTab));
    } else if (selectedCategories.length > 0) {
      const normalizedSelected = selectedCategories.map(normalizeCategory);
      categoryMatch = normalizedSelected.some(category => productCategories.includes(category));
    }

    const productName = String(product.name || '').toLowerCase();
    const searchMatch = searchQuery.trim() === '' ||
      productName.includes(searchQuery.toLowerCase());

    return categoryMatch && searchMatch;
  });

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        // Remove category if already selected
        return prev.filter(c => c !== category);
      } else {
        // Add category if not selected
        return [...prev, category];
      }
    });
  };

  const clearAllFilters = () => {
    setSelectedCategories([]);
  };

  const getPlainDescription = (html: any): string => {
    const raw = String(html || '');
    if (!raw.trim()) return 'No description available.';

    return raw
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim();
  };

  return (
    <View style={{ flex: 1, backgroundColor: darkMode ? '#121212' : '#fff' }}>
      <ScrollView style={[styles.container, { backgroundColor: darkMode ? '#121212' : '#fff' }]}>
        {/* Logo and Title */}

        <TopBar />

        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: darkMode ? '#1f1f1f' : '#f2f2f2' }]}>
            <Ionicons name="search" size={20} color="#888" />
            <TextInput
              placeholder="Search products..."
              style={[styles.searchInput, { color: darkMode ? '#eee' : '#222' }]}
              placeholderTextColor="#888"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: darkMode ? '#1f1f1f' : '#f2f2f2' }]}
            onPress={() => setFilterVisible(true)}
          >
            <Ionicons name="menu" size={24} color={darkMode ? '#e8e8e8' : '#222'} />
          </TouchableOpacity>
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          <TouchableOpacity onPress={() => setSelectedTab('All')}>
            <Text style={[styles.tabText, { color: darkMode ? '#d6d6d6' : '#222' }, selectedTab === 'All' && styles.tabActive]}>All</Text>
          </TouchableOpacity>
          {filterOptions.map(option => (
            <TouchableOpacity key={option} onPress={() => setSelectedTab(option)}>
              <Text style={[styles.tabText, { color: darkMode ? '#d6d6d6' : '#222' }, selectedTab === option && styles.tabActive]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Products */}
        <View style={styles.productsContainer}>
          {filteredData.map(product => (
            <TouchableOpacity
              key={product.id}
              style={[styles.productBox, { backgroundColor: darkMode ? '#1b1b1b' : '#fff' }]}
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
              <Text style={[styles.productName, { color: darkMode ? '#f2f2f2' : '#222' }]}>{product.name}</Text>
              <View style={{ width: '100%', alignItems: 'center' }}>
                <Text numberOfLines={6} style={[styles.productDesc, { maxWidth: 440, paddingHorizontal: 16, color: darkMode ? '#bdbdbd' : '#666' }]}>
                  {getPlainDescription(product.description)}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="filter" size={24} color="#2563eb" />
                <Text style={{ fontWeight: 'bold', fontSize: 18, marginLeft: 8, color: '#2563eb' }}>Filter</Text>
              </View>
              <TouchableOpacity onPress={clearAllFilters}>
                <Text style={{ color: '#a81d1d', fontSize: 14, fontWeight: '600' }}>Clear All</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
              {filterOptions.map(option => (
                <TouchableOpacity
                  key={option}
                  style={styles.radioRow}
                  onPress={() => toggleCategory(option)}
                  activeOpacity={0.7}
                >
                  <View style={styles.checkboxOuter}>
                    {selectedCategories.includes(option) && (
                      <Ionicons name="checkmark" size={16} color="#2563eb" />
                    )}
                  </View>
                  <Text style={styles.radioLabel}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
              <TouchableOpacity style={styles.applyButton} onPress={() => setFilterVisible(false)}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bottom Bar */}
      <BottomNavBar />
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
  checkboxOuter: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  radioLabel: {
    fontSize: 15,
    color: '#222',
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
    paddingBottom: 100, // Extra space at bottom to prevent navigation bar from blocking last products
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