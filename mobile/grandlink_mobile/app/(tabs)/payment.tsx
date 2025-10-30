import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
  SafeAreaView,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { supabase } from '../supabaseClient';

const { width } = Dimensions.get('window');

type PaymentMethod = 'paymongo' | 'paypal';

type CartItem = {
  id: string;
  product_id?: string;
  name: string;
  qty?: number;
  price?: number;
  image?: string;
  category?: string;
  material?: string;
  sku?: string;
};

export default function PaymentScreen() {
  const router = useRouter();
  
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState<string>('');
  const [branch, setBranch] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('paymongo');

  const RESERVATION_FEE = 500;

  useEffect(() => {
    loadCartItems();
  }, []);

  const loadCartItems = async () => {
    try {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        Alert.alert('Not signed in', 'Please sign in to continue.');
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
          products (
            name,
            image1,
            category,
            material,
            sku
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
        category: item.products?.category || '',
        material: item.products?.material || '',
        sku: item.products?.sku || '',
      }));
      setCartItems(items as CartItem[]);
      
      if (items.length === 0) {
        Alert.alert('Empty Cart', 'Your cart is empty. Please add items first.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (e: any) {
      console.error('Failed to load cart items', e);
      Alert.alert('Error', `Failed to load cart items: ${e?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const totalProductValue = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (item.price ?? 0) * (item.qty ?? 1), 0);
  }, [cartItems]);
  
  const remainingBalance = Math.max(0, totalProductValue - RESERVATION_FEE);

  const formatCurrency = (v: number) =>
    v.toLocaleString(undefined, { style: 'currency', currency: 'PHP', minimumFractionDigits: 0 });

  const onReserve = () => {
    if (!address) {
      Alert.alert('Missing info', 'Please select or enter a delivery address.');
      return;
    }
    if (!branch) {
      Alert.alert('Missing info', 'Please select a store branch.');
      return;
    }

    // Replace with real reservation / payment flow
    const itemCount = cartItems.reduce((sum, item) => sum + (item.qty ?? 1), 0);
    Alert.alert(
      'Confirm Order',
      `You will pay ${formatCurrency(totalProductValue)} for ${itemCount} item(s).\n\nPayment method: ${
        paymentMethod === 'paymongo' ? 'PayMongo (GCash/PayMaya)' : 'PayPal'
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed',
          onPress: () => {
            // TODO: call backend / supabase to create order & redirect to payment
            Alert.alert('Order Placed', 'Order created successfully (mock).');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Back button */}
          <View style={styles.backWrap}>
            <TouchableOpacity style={styles.backBtnSmall} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={18} color="#333" />
              <Text style={styles.backTextSmall}>Back to Cart</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#a81d1d" />
              <Text style={styles.loadingText}>Loading order details...</Text>
            </View>
          ) : (
            <View style={styles.infoWrap}>
              {/* Cart Items Summary */}
              <View style={styles.itemsCard}>
                <Text style={styles.sectionTitleLarge}>Order Items ({cartItems.length})</Text>
                {cartItems.map((item) => (
                  <View key={item.id} style={styles.cartItemRow}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={styles.cartItemImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.cartItemPlaceholder}>
                        <Ionicons name="image-outline" size={24} color="#ccc" />
                      </View>
                    )}
                    <View style={styles.cartItemDetails}>
                      <Text style={styles.cartItemName} numberOfLines={2}>{item.name}</Text>
                      {item.sku && <Text style={styles.cartItemSku}>SKU: {item.sku}</Text>}
                      <View style={styles.cartItemPriceRow}>
                        <Text style={styles.cartItemPrice}>₱{(item.price ?? 0).toFixed(2)}</Text>
                        <Text style={styles.cartItemQty}>x {item.qty ?? 1}</Text>
                      </View>
                    </View>
                    <Text style={styles.cartItemTotal}>₱{((item.price ?? 0) * (item.qty ?? 1)).toFixed(2)}</Text>
                  </View>
                ))}
              </View>

              {/* Checkout form */}
              <View style={styles.formCard}>
                <Text style={styles.reserveTitle}>Delivery & Payment Details</Text>

              <Text style={styles.formLabel}>Delivery Address *</Text>
              <TextInput
                placeholder="Enter delivery address"
                style={styles.input}
                value={address}
                onChangeText={setAddress}
              />

              <Text style={[styles.formLabel, { marginTop: 12 }]}>Store Branch *</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={branch} onValueChange={(v) => setBranch(v)} style={styles.picker}>
                  <Picker.Item label="Select Store Branch" value="" />
                  <Picker.Item label="Main Branch - Makati" value="makati" />
                  <Picker.Item label="North Branch - Quezon" value="quezon" />
                  <Picker.Item label="South Branch - Paranaque" value="paranaque" />
                </Picker>
              </View>

              <Text style={[styles.formLabel, { marginTop: 12 }]}>Special Instructions</Text>
              <TextInput
                placeholder="Any special requirements or notes..."
                multiline
                numberOfLines={3}
                style={[styles.input, { height: 84, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
              />

              <Text style={[styles.formLabel, { marginTop: 12 }]}>Payment Method</Text>
              <View style={styles.paymentMethods}>
                <TouchableOpacity style={styles.radioRow} onPress={() => setPaymentMethod('paymongo')}>
                  <View style={[styles.radio, paymentMethod === 'paymongo' && styles.radioActive]} />
                  <Text style={styles.radioLabel}>PayMongo - GCash & PayMaya ({formatCurrency(RESERVATION_FEE)})</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.radioRow} onPress={() => setPaymentMethod('paypal')}>
                  <View style={[styles.radio, paymentMethod === 'paypal' && styles.radioActive]} />
                  <Text style={styles.radioLabel}>PayPal ({formatCurrency(10)})</Text>
                </TouchableOpacity>
              </View>
            </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Order Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal ({cartItems.reduce((s, i) => s + (i.qty ?? 1), 0)} items):</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(totalProductValue)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Fee:</Text>
                  <Text style={styles.summaryValue}>TBD</Text>
                </View>
                <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8, marginTop: 8 }]}>
                  <Text style={[styles.summaryLabel, { fontWeight: '700', fontSize: 16 }]}>Total:</Text>
                  <Text style={[styles.summaryValue, { fontWeight: '700', fontSize: 18, color: '#a81d1d' }]}>
                    {formatCurrency(totalProductValue)}
                  </Text>
                </View>

                <TouchableOpacity style={styles.reserveBtn} onPress={onReserve}>
                  <Text style={styles.reserveBtnText}>Place Order & Pay</Text>
                </TouchableOpacity>
              </View>

              {/* small spacer to allow comfortable scroll above footer */}
              <View style={{ height: 24 }} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 14, paddingBottom: 32 },
  backWrap: { width: '100%', marginBottom: 8 },
  backBtnSmall: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 4 },
  backTextSmall: { marginLeft: 8, color: '#333', fontWeight: '600' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },

  infoWrap: { width: '100%' },
  itemsCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    elevation: 1,
  },
  sectionTitleLarge: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#222',
  },
  cartItemRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  cartItemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  cartItemPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartItemDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginBottom: 4,
  },
  cartItemSku: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  cartItemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartItemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#a81d1d',
    marginRight: 8,
  },
  cartItemQty: {
    fontSize: 13,
    color: '#666',
  },
  cartItemTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
    alignSelf: 'center',
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  productSku: { color: '#777' },

  priceBlock: { alignItems: 'flex-end' },
  price: { color: '#0b9f34', fontSize: 20, fontWeight: '700' },
  stockBadge: { marginTop: 6, backgroundColor: '#f1f5f4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  stockText: { color: '#444', fontSize: 12 },

  sectionTitle: { marginTop: 12, fontWeight: '700', fontSize: 14 },
  description: { marginTop: 6, color: '#444' },
  specsCard: { marginTop: 12, backgroundColor: '#fafafa', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#f0f0f0' },
  specsTitle: { fontWeight: '700', marginBottom: 8 },
  specsGrid: { marginTop: 8 },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  specLabel: { color: '#666' },
  specValue: { color: '#222', fontWeight: '600' },

  formCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#eee', shadowColor: '#000', shadowOpacity: 0.03, elevation: 1 },
  reserveTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },

  formLabel: { fontWeight: '700', marginBottom: 6, color: '#333' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  qtyBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#f6f6f6', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 20, fontWeight: '700' },
  qtyInput: { marginHorizontal: 12, borderBottomWidth: Platform.OS === 'web' ? 0 : 1, borderColor: '#ddd', padding: 8, width: 72, textAlign: 'center', borderRadius: 6 },

  input: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 10, backgroundColor: '#fff', marginBottom: 6 },
  pickerWrap: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, overflow: 'hidden', marginBottom: 6 },
  picker: { height: 44, width: '100%' },
  dimRow: { flexDirection: 'row', gap: 8, marginBottom: 8, marginTop: 6 },
  dimInput: { flex: 1 },

  paymentMethods: { marginTop: 8 },
  radioRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#ccc', marginRight: 8 },
  radioActive: { backgroundColor: '#a81d1d', borderColor: '#a81d1d' },
  radioLabel: { color: '#333', flexShrink: 1 },

  summaryCard: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#eee' },
  summaryTitle: { fontWeight: '700', marginBottom: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { color: '#666' },
  summaryValue: { fontWeight: '700' },

  reserveBtn: { marginTop: 12, backgroundColor: '#a81d1d', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  reserveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});