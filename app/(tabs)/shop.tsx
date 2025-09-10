import React, { useEffect, useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';

export default function ShopScreen() {
    const router = useRouter();
    const [data, setData] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('your_table')
        .select('*');
      if (error) setError(error.message);
      else setData(data || []);
    };
    fetchData();
  }, []);
  
  return (
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
      </View>

      {/* Blue Bar */}
      <View style={styles.blueBar} />

      {/* Search and Filter */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#888" />
          <TextInput
            placeholder="Search"
            style={styles.searchInput}
            placeholderTextColor="#888"
          />
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="filter" size={24} color="#222" />
        </TouchableOpacity>
      </View>

      {/* Category Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        <TouchableOpacity onPress={() => router.push('../shop')}>
          <Text style={styles.tabText}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('../shop')}>
          <Text style={[styles.tabText, styles.tabActive]}>Doors</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('../shop')}>
          <Text style={styles.tabText}>Windows</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('../shop')}>
          <Text style={styles.tabText}>Enclosure</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('../shop')}>
          <Text style={styles.tabText}>Canopy</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('../shop')}>
          <Text style={styles.tabText}>Railings</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('../shop')}>
          <Text style={styles.tabText}>Curtain Wall</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScrollView>
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
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  filterButton: {
    marginLeft: 16,
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
});