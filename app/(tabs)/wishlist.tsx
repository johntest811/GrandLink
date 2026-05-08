import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';
import { useModal } from '@/hooks/useModal';
import BottomNavBar from '@/components/BottomNav';
import { useAppContext } from '@/context/AppContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type WishlistItem = {
  id: string;
  product_id: string;
  status: string;
  created_at: string;
  product?: {
    name: string;
    image1: string;
    category: string;
    price?: number;
    stock?: number;
    inventory?: number;
  };
};

export default function WishlistScreen() {
  const { darkMode } = useAppContext();
  const router = useRouter();
  const modal = useModal();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWishlist();
  }, []);

  // Real-time subscription to wishlist updates
  useEffect(() => {
    const channel = supabase
      .channel('wishlist-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_items', filter: "item_type=eq.my-list" },
        (payload) => {
          // Reload wishlist on any changes
          loadWishlist();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadWishlist = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        modal.showInfo('Error', 'Please sign in to view your wishlist.');
        router.replace('/login');
        return;
      }

      // First, get wishlist items
      const { data: wishlistData, error: wishlistError } = await supabase
        .from('user_items')
        .select('id, product_id, status, created_at')
        .eq('user_id', authData.user.id)
        .eq('item_type', 'my-list')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (wishlistError) throw wishlistError;

      if (!wishlistData || wishlistData.length === 0) {
        setWishlistItems([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Then fetch product details for all product IDs
      const productIds = wishlistData.map((item) => item.product_id);
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, image1, category, price, inventory')
        .in('id', productIds);

      if (productsError) throw productsError;

      // Merge wishlist items with product data
      const enrichedItems = wishlistData.map((item) => ({
        ...item,
        product: productsData?.find((p) => p.id === item.product_id),
      }));

      setWishlistItems(enrichedItems);
    } catch (error: any) {
      console.error('Failed to load wishlist:', error);
      modal.showError('Error', 'Failed to load wishlist. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWishlist();
  };

  const getWishlistItemStock = (item: WishlistItem) => {
    return Math.max(0, Number(item.product?.inventory ?? 0));
  };

  const canAddWishlistItemToCart = (item: WishlistItem) => getWishlistItemStock(item) > 0;

  const removeFromWishlist = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('user_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setWishlistItems((prev) => prev.filter((item) => item.id !== itemId));
      modal.showSuccess('Removed', 'Item removed from wishlist.');
    } catch (error: any) {
      console.error('Failed to remove from wishlist:', error);
      modal.showError('Error', 'Failed to remove item from wishlist.');
    }
  };

  const addToCart = async (item: WishlistItem) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        modal.showInfo('Login Required', 'Please login to add items to your cart.');
        return;
      }

      if (!canAddWishlistItemToCart(item)) {
        modal.showInfo('Out of Stock', 'This product is currently out of stock and cannot be added to your cart.');
        return;
      }

      // Check if item already exists in cart
      const { data: existing, error: selErr } = await supabase
        .from('cart')
        .select('*')
        .eq('user_id', authData.user.id)
        .eq('product_id', item.product_id)
        .maybeSingle();

      if (selErr) throw selErr;

      if (existing) {
        // Update quantity if item already in cart
        const newQty = (existing.quantity ?? 1) + 1;
        const { error: updErr } = await supabase
          .from('cart')
          .update({
            quantity: newQty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (updErr) throw updErr;
      } else {
        // Insert new cart item
        const payload = {
          user_id: authData.user.id,
          product_id: item.product_id,
          quantity: 1,
          meta: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const { error: insErr } = await supabase.from('cart').insert([payload]);
        if (insErr) throw insErr;
      }

      // Keep wishlist and cart in sync: remove the item from wishlist after successful add.
      const { error: delErr } = await supabase
        .from('user_items')
        .delete()
        .eq('id', item.id)
        .eq('user_id', authData.user.id)
        .eq('item_type', 'my-list');

      if (delErr) {
        console.error('Added to cart but failed to remove from wishlist:', delErr);
        modal.showWarning(
          'Added to Cart',
          `${item.product?.name || 'Item'} was added to cart, but we could not remove it from wishlist automatically.`
        );
        await loadWishlist();
        return;
      }

      setWishlistItems((prev) => prev.filter((wishlistItem) => wishlistItem.id !== item.id));
      modal.showSuccess('Added', `${item.product?.name || 'Item'} added to cart and removed from wishlist.`);
    } catch (error: any) {
      console.error('Failed to add to cart:', error);
      modal.showError('Error', 'Failed to add item to cart.');
    }
  };

  const openProduct = (productId: string) => {
    router.push({
      pathname: '../product',
      params: { id: productId },
    } as any);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: darkMode ? '#101010' : '#fff' }]}>
        <View style={[styles.centered, { flex: 1 }]}>
          <ActivityIndicator size="large" color="#E24343" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: darkMode ? '#101010' : '#fff' }]}>
      <View style={[styles.container, { backgroundColor: darkMode ? '#101010' : '#fff' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>My Wishlist</Text>
          <View style={{ width: 40 }} />
        </View>

        {wishlistItems.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyContainer}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            <Ionicons name="heart-outline" size={64} color={darkMode ? '#8c8c8c' : '#ccc'} />
            <Text style={[styles.emptyText, { color: darkMode ? '#f0f0f0' : '#333' }]}>Your wishlist is empty</Text>
            <Text style={[styles.emptySubtext, { color: darkMode ? '#a8a8a8' : '#999' }]}>Add items from the shop to your wishlist</Text>
          </ScrollView>
        ) : (
          <ScrollView
            style={[styles.content, { backgroundColor: darkMode ? '#101010' : '#fff' }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          >
            {wishlistItems.map((item) => (
              <View key={item.id} style={[styles.wishlistCard, { backgroundColor: darkMode ? '#1a1a1a' : '#f9f9f9', borderColor: darkMode ? '#333' : '#eee' }]}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => openProduct(item.product_id)}
                  style={styles.cardContent}
                >
                  {item.product?.image1 ? (
                    <Image
                      source={{ uri: item.product.image1 }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.productImage, styles.placeholderImage]}>
                      <Ionicons name="image-outline" size={40} color={darkMode ? '#8c8c8c' : '#ccc'} />
                    </View>
                  )}

                  <View style={styles.productInfo}>
                    <Text style={[styles.productName, { color: darkMode ? '#f0f0f0' : '#000' }]} numberOfLines={2}>
                      {item.product?.name || 'Unknown Product'}
                    </Text>
                    {item.product?.category && (
                      <Text style={[styles.category, { color: darkMode ? '#b0b0b0' : '#666' }]}>{item.product.category}</Text>
                    )}
                    {item.product?.price && (
                      <Text style={styles.price}>₱{item.product.price.toLocaleString()}</Text>
                    )}
                  </View>
                </TouchableOpacity>

                <View style={styles.actionButtons}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionButton,
                      !canAddWishlistItemToCart(item) && styles.actionButtonDisabled,
                      pressed && styles.buttonPressed,
                    ]}
                    disabled={!canAddWishlistItemToCart(item)}
                    onPress={() => addToCart(item)}
                  >
                    <Ionicons name="cart" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Add</Text>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.removeButton,
                      pressed && styles.removeButtonPressed,
                    ]}
                    onPress={() => removeFromWishlist(item.id)}
                  >
                    <Ionicons name="trash" size={20} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#a81d1d',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  wishlistCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardContent: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  category: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#a81d1d',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#a81d1d',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    backgroundColor: '#8B1515',
    opacity: 0.9,
  },
  removeButton: {
    flex: 0.5,
    backgroundColor: '#d32f2f',
  },
  removeButtonPressed: {
    backgroundColor: '#b71c1c',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
