/**
 * Cart Screen - Mobile App
 * 
 * This screen displays and manages the user's shopping cart.
 * 
 * DATABASE SYNCHRONIZATION:
 * - All cart items are stored in the 'user_items' table in Supabase
 * - Items are filtered by: user_id, item_type='order', status='active'
 * - Changes made here (add, update quantity, remove) are immediately saved to the database
 * - The same cart items will appear on both mobile app and website for the same user
 * - When user adds items on mobile, website will see them (and vice versa)
 * 
 * REAL-TIME SYNC:
 * - Cart reloads when screen comes into focus (useFocusEffect)
 * - To enable real-time updates without reload, consider adding Supabase realtime subscriptions
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, Alert, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../supabaseClient';
import { Ionicons } from '@expo/vector-icons';

type CartItem = {
  id: string;
  product_id?: string;
  name: string;
  qty?: number;
  price?: number;
  image?: string;
  inserted_at?: string;
};

export default function CartScreen() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  // Load cart when component mounts
  useEffect(() => {
    loadCart();
  }, []);

  // Reload cart whenever the screen comes into focus (user navigates back to cart)
  useFocusEffect(
    React.useCallback(() => {
      loadCart();
    }, [])
  );

  const loadCart = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        Alert.alert('Not signed in', 'Please sign in to view your cart.');
        router.replace('/login');
        return;
      }
      
      const { data, error } = await supabase
        .from('user_items')
        .select(`
          id,
          product_id,
          quantity,
          price,
          created_at,
          products (
            name,
            image1
          )
        `)
        .eq('user_id', authData.user.id)
        .eq('item_type', 'order')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform data to match CartItem type
      const items = (data ?? []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        name: item.products?.name || 'Unknown Product',
        qty: item.quantity || 1,
        price: item.price || 0,
        image: item.products?.image1 || null,
        inserted_at: item.created_at,
      }));
      setCartItems(items as CartItem[]);
    } catch (e: any) {
      console.error('Failed to load cart', e);
      Alert.alert('Error', `Failed to load cart: ${e?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCart(true);
  };

  const removeFromCart = async (id: string) => {
    Alert.alert('Remove item', 'Remove this item from cart?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('user_items').delete().eq('id', id);
            if (error) throw error;
            await loadCart();
            Alert.alert('Removed', 'Item removed from cart.');
          } catch (e) {
            console.error('Failed to remove', e);
            Alert.alert('Error', 'Failed to remove item.');
          }
        },
      },
    ]);
  };

  const updateQuantity = async (id: string, newQty: number) => {
    if (newQty < 1) {
      removeFromCart(id);
      return;
    }
    
    try {
      const item = cartItems.find(i => i.id === id);
      if (!item) return;
      
      const newTotal = newQty * (item.price ?? 0);
      const { error } = await supabase
        .from('user_items')
        .update({ 
          quantity: newQty,
          total_amount: newTotal,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
      await loadCart();
    } catch (e) {
      console.error('Failed to update quantity', e);
      Alert.alert('Error', 'Failed to update quantity.');
    }
  };

  const cartTotal = cartItems.reduce((s, it) => s + (it.price ?? 0) * (it.qty ?? 1), 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Cart</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Cart Items */}
      {loading ? (
        <View style={styles.centerContent}>
          <Text>Loading cart...</Text>
        </View>
      ) : cartItems.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="cart-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <TouchableOpacity style={styles.shopButton} onPress={() => router.push('/shop')}>
            <Text style={styles.shopButtonText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cartItems}
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#a81d1d']}
                tintColor="#a81d1d"
              />
            }
            renderItem={({ item }) => (
              <View style={styles.cartItem}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.cartItemImage} />
                ) : (
                  <View style={styles.cartItemImagePlaceholder}>
                    <Ionicons name="image-outline" size={30} color="#ccc" />
                  </View>
                )}
                
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.itemPrice}>₱{(item.price ?? 0).toFixed(2)}</Text>
                  
                  <View style={styles.quantityRow}>
                    <TouchableOpacity 
                      style={styles.qtyButton} 
                      onPress={() => updateQuantity(item.id, (item.qty ?? 1) - 1)}
                    >
                      <Ionicons name="remove" size={18} color="#222" />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.qty ?? 1}</Text>
                    <TouchableOpacity 
                      style={styles.qtyButton} 
                      onPress={() => updateQuantity(item.id, (item.qty ?? 1) + 1)}
                    >
                      <Ionicons name="add" size={18} color="#222" />
                    </TouchableOpacity>
                  </View>
                </View>
                
                <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.removeButton}>
                  <Ionicons name="trash-outline" size={22} color="#a81d1d" />
                </TouchableOpacity>
              </View>
            )}
          />

          {/* Footer with Total and Checkout */}
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalAmount}>₱{cartTotal.toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={styles.checkoutButton} onPress={() => router.push('../payment')}>
              <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Bottom Navbar */}
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
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('../profile')}>
          <Image source={require('@/assets/images/settings.png')} style={styles.navIcon} resizeMode="contain" />
          <Text style={styles.navLabel}>Profile</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  shopButton: {
    backgroundColor: '#a81d1d',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  shopButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 180,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 1,
  },
  cartItemImage: {
    width: 80,
    height: 80,
    backgroundColor: '#eee',
    borderRadius: 8,
  },
  cartItemImagePlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#a81d1d',
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  qtyText: {
    marginHorizontal: 16,
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  removeButton: {
    padding: 8,
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 70,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 5,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#a81d1d',
  },
  checkoutButton: {
    backgroundColor: '#a81d1d',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkoutButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
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
});
